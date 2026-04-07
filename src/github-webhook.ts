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
// exec removed — no longer running local deploys
import { IncomingMessage, ServerResponse } from 'http';

import { createTask, getTaskById } from './db.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';
import { handleGitHubIssuesEvent } from './github-issues-webhook.js';
import { resolveTargets } from './webhook-router.js';

// In-memory dedup for success events (no DB task created for those)
const postedRunIds = new Set<number>();

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

  // Deduplicate — check both DB tasks (for failure agents) and in-memory set (for success posts)
  if (getTaskById(taskId) || postedRunIds.has(runId)) {
    logger.debug({ taskId }, 'GitHub webhook: duplicate event, skipping');
    return;
  }
  postedRunIds.add(runId);


  const now = new Date().toISOString();
  const repoName = repoFullName.split('/')[1] || 'YW_Core';

  if (conclusion === 'success') {
    // Success: post directly to Discord — no agent needed
    const message = `✅ **CI passed** — ${repoFullName}\n\`${displayTitle}\`\nBranch: \`${headBranch}\` | [View run](${htmlUrl})`;
    const discordToken = process.env.DISCORD_BOT_TOKEN;
    for (const target of targets) {
      const channelId = target.jid.startsWith('dc:') ? target.jid.slice(3) : null;
      if (!channelId || !discordToken) continue;
      try {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bot ${discordToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: message }),
        });
        logger.info({ repoFullName, runId, headBranch, channelId }, 'GitHub CI: success posted to Discord');
      } catch (err) {
        logger.error({ err, channelId }, 'GitHub CI: failed to post to Discord');
      }
    }
  } else {
    // Failure: spawn agent to investigate, fix, and report
    const failPrompt = buildCIFailurePrompt({ runId, headBranch, workflowName, htmlUrl, displayTitle, repoFullName, repoName });
    for (const target of targets) {
      const targetTaskId = targets.length === 1 ? taskId : `${taskId}@${target.jid}`;
      try {
        createTask({
          id: targetTaskId,
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
        logger.info({ repoFullName, runId, headBranch, taskId: targetTaskId }, 'GitHub CI: failure agent task created');
      } catch (err) {
        logger.error({ err, taskId: targetTaskId }, 'GitHub CI: failed to create failure task');
      }
    }
  }
}

function buildCIFailurePrompt(info: {
  runId: number;
  headBranch: string;
  workflowName: string;
  htmlUrl: string;
  displayTitle: string;
  repoFullName: string;
  repoName: string;
}): string {
  return `You are Friday — a CI monitor bot for YourWave.

IMPORTANT: Send ALL messages using mcp__nanoclaw__send_message with sender set to "Friday". Keep messages short. Use ONLY Discord formatting: **bold**, \`code\`. No markdown headings.

## CI Failure Details
- **Repository:** ${info.repoFullName}
- **Branch:** ${info.headBranch}
- **Workflow:** ${info.workflowName}
- **Commit:** ${info.displayTitle}
- **URL:** ${info.htmlUrl}
- **Run ID:** ${info.runId}

## Instructions

The CI run *failed* ❌.

1. Send (as Friday): "❌ **CI failed:** ${info.workflowName} on \`${info.headBranch}\`\\n\`${info.displayTitle}\`\\n[View run](${info.htmlUrl})"
2. Run: \`cd /home/andrii-panasenko/${info.repoName} && /tmp/gh_2.65.0_linux_amd64/bin/gh run view ${info.runId} --log-failed 2>&1 | tail -50\`
3. Identify which job(s) and test(s) failed
4. Send (as Friday) a concise failure summary:
   - Which job failed
   - Root cause (1-2 sentences)
   - Suggested fix if obvious
5. If the fix is straightforward (e.g., a lint issue, formatting, missing import), go ahead and fix it:
   - \`cd /home/andrii-panasenko/${info.repoName}\`
   - Make the fix
   - Run \`npm run build\` to verify
   - Set git identity: \`git config user.name "Andrii Panasenko" && git config user.email "tru.bazinga@gmail.com"\`
   - Commit and push: \`git add -A && git commit --no-verify -m "fix(ci): [what changed]" && git push origin ${info.headBranch}\`
   - Send: "🔧 **Fixed CI:** [what changed]"
6. If the fix is complex or unclear, just report the diagnosis — don't attempt a fix.`;
}

// deployAfterCI and buildCIPrompt removed — Vercel handles deploys, Discord gets direct API posts
