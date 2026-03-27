/**
 * GitHub webhook handler.
 *
 * Exported as a pure handler function — called by the unified webhook server.
 *
 * On workflow_run.completed events:
 *   - Extracts repo, branch, conclusion, run URL
 *   - Creates a one-time scheduled task in the DB
 *   - The task scheduler picks it up and runs the agent in main group context
 */
import crypto from 'crypto';
import { exec } from 'child_process';
import { IncomingMessage, ServerResponse } from 'http';

import { createTask, getTaskById } from './db.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';
import { handleGitHubIssuesEvent } from './github-issues-webhook.js';
import { resolveTargets } from './webhook-router.js';

export interface GitHubHandlerConfig {
  signingSecret: string;
  githubToken: string;
  githubRepo: string;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}

export function handleGitHubWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  rawBody: Buffer,
  config: GitHubHandlerConfig,
): void {
  const body = rawBody.toString('utf-8');

  // Verify HMAC signature when a signing secret is configured
  if (config.signingSecret) {
    const signature =
      (req.headers['x-hub-signature-256'] as string | undefined) ?? '';
    if (!signature) {
      logger.warn('GitHub webhook: missing x-hub-signature-256 header');
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    // GitHub sends: sha256=<hex>
    const sigHex = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature;
    const expected = crypto
      .createHmac('sha256', config.signingSecret)
      .update(rawBody)
      .digest('hex');

    let valid = false;
    try {
      valid = crypto.timingSafeEqual(
        Buffer.from(sigHex, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      /* malformed hex — stays invalid */
    }

    if (!valid) {
      logger.warn({ signature }, 'GitHub webhook: invalid signature');
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    logger.warn('GitHub webhook: invalid JSON body');
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const event = (req.headers['x-github-event'] as string | undefined) ?? '';
  logger.debug({ event }, 'GitHub webhook event received');

  // Ping event — GitHub sends this when webhook is first configured
  if (event === 'ping') {
    logger.info('GitHub webhook: ping received — webhook is active');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'pong' }));
    return;
  }

  // Acknowledge immediately — GitHub retries on non-2xx
  res.writeHead(200);
  res.end('OK');

  // Process asynchronously so we never block the HTTP response
  handleEvent(event, payload, config).catch((err) =>
    logger.error({ err, event }, 'GitHub webhook handler error'),
  );
}

async function handleEvent(
  event: string,
  payload: Record<string, unknown>,
  config: GitHubHandlerConfig,
): Promise<void> {
  if (event === 'workflow_run') {
    return handleWorkflowRunEvent(payload, config);
  }

  if (event === 'issues') {
    return handleGitHubIssuesEvent(payload, {
      githubToken: config.githubToken,
      githubRepo: config.githubRepo,
      getRegisteredGroups: config.getRegisteredGroups,
    });
  }

}

async function handleWorkflowRunEvent(
  payload: Record<string, unknown>,
  config: GitHubHandlerConfig,
): Promise<void> {
  const action = payload.action as string | undefined;
  if (action !== 'completed') return;

  const workflowRun = payload.workflow_run as
    | Record<string, unknown>
    | undefined;
  if (!workflowRun) return;

  const groups = config.getRegisteredGroups();
  const targets = resolveTargets('github-ci', groups);
  if (targets.length === 0) {
    logger.warn('GitHub webhook: no routing targets available');
    return;
  }

  const runId = workflowRun.id as number;
  const conclusion = workflowRun.conclusion as string;
  const headBranch = workflowRun.head_branch as string;
  const workflowName = workflowRun.name as string;
  const htmlUrl = workflowRun.html_url as string;
  const displayTitle = (workflowRun.display_title as string) ?? '';

  const repo = payload.repository as Record<string, unknown> | undefined;
  const repoFullName = (repo?.full_name as string) ?? 'unknown';

  const taskId = `github-ci-${runId}`;

  if (getTaskById(taskId)) {
    logger.debug({ taskId }, 'GitHub webhook: duplicate event, skipping');
    return;
  }

  // Deploy on CI pass for main branch
  if (
    conclusion === 'success' &&
    (headBranch === 'main' || headBranch === 'master')
  ) {
    const repoName = repoFullName.split('/')[1] || 'YW_Core';
    deployAfterCI(repoName, repoFullName, displayTitle, runId, config);
  }

  const now = new Date().toISOString();
  const prompt = buildCIPrompt({
    runId,
    conclusion,
    headBranch,
    workflowName,
    htmlUrl,
    displayTitle,
    repoFullName,
  });

  for (const target of targets) {
    const targetTaskId =
      targets.length === 1 ? taskId : `${taskId}@${target.jid}`;
    try {
      createTask({
        id: targetTaskId,
        group_folder: target.group.folder,
        chat_jid: target.jid,
        prompt,
        schedule_type: 'once',
        schedule_value: now,
        context_mode: 'isolated',
        next_run: now,
        status: 'active',
        created_at: now,
      });
      logger.info(
        {
          repoFullName,
          runId,
          conclusion,
          headBranch,
          taskId: targetTaskId,
          jid: target.jid,
        },
        'GitHub CI task created for target',
      );
    } catch (err) {
      logger.error(
        { err, taskId: targetTaskId, jid: target.jid },
        'GitHub CI webhook: failed to create task for target',
      );
    }
  }
}

function deployAfterCI(
  repoName: string,
  repoFullName: string,
  displayTitle: string,
  runId: number,
  config: GitHubHandlerConfig,
): void {
  const repoDir = `/home/andrii-panasenko/${repoName}`;
  const deployId = `github-deploy-ci-${runId}`;

  if (getTaskById(deployId)) return;

  logger.info(
    { repoFullName, runId, displayTitle },
    'CI passed on main — starting deploy',
  );

  const deployScript = [
    'export NVM_DIR="$HOME/.nvm"',
    '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"',
    `cd ${repoDir}`,
    'git stash --include-untracked',
    'git pull --rebase',
    'git stash pop || true',
    'npm install --prefer-offline --no-audit',
    'systemctl --user restart yw-dev',
    'systemctl --user restart yw-storybook',
  ].join(' && ');

  const deployStart = Date.now();

  exec(deployScript, { timeout: 120_000, shell: '/bin/bash' }, (err, _stdout, stderr) => {
    const elapsed = ((Date.now() - deployStart) / 1000).toFixed(1);
    const groups = config.getRegisteredGroups();
    const targets = resolveTargets('github-ci', groups);
    const now = new Date().toISOString();

    if (err) {
      logger.error({ err, stderr: stderr.slice(0, 500), runId }, 'Deploy failed');
      const failPrompt = `Send this message exactly (no research, no extra text):

❌ **Deploy failed** after CI pass — \`${repoFullName}\`
> ${displayTitle.split('\n')[0]}
Error: ${(err.message || 'unknown').slice(0, 200)}
Duration: ${elapsed}s`;

      for (const target of targets) {
        createTask({
          id: `${deployId}-fail@${target.jid}`,
          group_folder: target.group.folder,
          chat_jid: target.jid,
          prompt: failPrompt,
          schedule_type: 'once',
          schedule_value: now,
          context_mode: 'isolated',
          next_run: now,
          status: 'active',
          created_at: now,
        });
      }
      return;
    }

    logger.info({ runId, elapsed }, 'Deploy succeeded after CI pass');
    const successPrompt = `Send this message exactly (no research, no extra text):

🚀 **Deployed** after CI ✅ — \`${repoFullName}\`
> ${displayTitle.split('\n')[0]}
Duration: ${elapsed}s | Services restarted: yw-dev, yw-storybook`;

    for (const target of targets) {
      createTask({
        id: `${deployId}-ok@${target.jid}`,
        group_folder: target.group.folder,
        chat_jid: target.jid,
        prompt: successPrompt,
        schedule_type: 'once',
        schedule_value: now,
        context_mode: 'isolated',
        next_run: now,
        status: 'active',
        created_at: now,
      });
    }
  });
}

interface CIRunInfo {
  runId: number;
  conclusion: string;
  headBranch: string;
  workflowName: string;
  htmlUrl: string;
  displayTitle: string;
  repoFullName: string;
}

function buildCIPrompt(info: CIRunInfo): string {
  return `You are Friday — a CI monitor bot for YourWave.

IMPORTANT: Send ALL messages using mcp__nanoclaw__send_message with sender set to "Friday". Keep messages short. Use ONLY Telegram formatting: single *asterisks* for bold, \`backticks\` for code. No markdown headings.

## CI Run Details
- **Repository:** ${info.repoFullName}
- **Branch:** ${info.headBranch}
- **Workflow:** ${info.workflowName}
- **Commit:** ${info.displayTitle}
- **Conclusion:** ${info.conclusion}
- **URL:** ${info.htmlUrl}
- **Run ID:** ${info.runId}

## Instructions

${
  info.conclusion === 'success'
    ? `The CI run *passed* ✅.
1. React with ✅ to the last message in the group
2. Send (as Friday): "✅ CI passed: ${info.displayTitle} (${info.headBranch})" — one line, brief.`
    : `The CI run *failed* ❌.
1. React with ❌ to the last message in the group
2. Send (as Friday): "❌ *CI failed:* ${info.workflowName} on ${info.headBranch}"
3. Run: \`cd /workspace/host/${info.repoFullName.split('/')[1] || 'YW_Core'} && gh run view ${info.runId} --log-failed\`
4. Identify which job(s) and test(s) failed
5. Send (as Friday) a concise failure summary:
   - Which job failed
   - Root cause (1-2 sentences)
   - Suggested fix if obvious
6. If the fix is straightforward (e.g., a test selector issue), go ahead and fix it, commit, and push. Then send: "🔧 *Fixed CI:* [what changed]"`
}`;
}
