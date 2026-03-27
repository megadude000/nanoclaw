/**
 * GitHub Issues webhook handler.
 *
 * Called by github-webhook.ts when X-GitHub-Event: issues is received.
 * On issues.opened:
 *   - If issue has "bug" label → dispatch Friday task based on fix mode label
 *   - If no "bug" label → send Telegram buttons asking what to do
 */
import { createTask, getTaskById } from './db.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';
import { resolveTargets } from './webhook-router.js';

export interface GitHubIssuesHandlerConfig {
  githubToken: string;
  githubRepo: string;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}

export async function handleGitHubIssuesEvent(
  payload: Record<string, unknown>,
  config: GitHubIssuesHandlerConfig,
): Promise<void> {
  const action = payload.action as string | undefined;

  // Handle label changes on existing issues (e.g. adding "immediate" to trigger fix)
  if (action === 'labeled') {
    return handleGitHubIssuesLabeled(payload, config);
  }

  if (action !== 'opened') return;

  const issue = payload.issue as Record<string, unknown> | undefined;
  if (!issue) return;

  const issueNumber = issue.number as number;
  const issueTitle = (issue.title as string) ?? '';
  const issueBody = (issue.body as string) ?? '';
  const issueUrl = (issue.html_url as string) ?? '';
  const labels = (issue.labels as Array<Record<string, unknown>>) ?? [];
  const labelNames = labels.map((l) => (l.name as string) ?? '');

  const taskId = `github-issue-${issueNumber}`;

  if (getTaskById(taskId)) {
    logger.debug(
      { taskId },
      'GitHub issues webhook: duplicate event, skipping',
    );
    return;
  }

  const groups = config.getRegisteredGroups();
  const targets = resolveTargets('github-issues', groups);
  if (targets.length === 0) {
    logger.warn('GitHub issues webhook: no routing targets available');
    return;
  }

  const now = new Date().toISOString();

  // No bug label — send Telegram buttons and exit
  if (!labelNames.includes('bug')) {
    logger.info(
      { issueNumber, issueTitle, labelNames },
      'GitHub issue: no bug label, asking user',
    );
    const prompt = buildNoBugLabelPrompt({ issueNumber, issueTitle, issueUrl });
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
          { taskId: targetTaskId, jid: target.jid },
          'GitHub issues webhook: task created for target',
        );
      } catch (err) {
        logger.error(
          { err, taskId: targetTaskId, jid: target.jid },
          'GitHub issues webhook: failed to create task for target',
        );
      }
    }
    return;
  }

  // Determine fix mode from labels; default to nightshift
  const fixMode: 'immediate' | 'nightshift' = labelNames.includes('immediate')
    ? 'immediate'
    : 'nightshift';

  logger.info(
    { issueNumber, issueTitle, fixMode, taskId },
    'GitHub bug issue task queued',
  );

  const prompt = buildBugFixPrompt({
    issueNumber,
    issueTitle,
    issueBody,
    issueUrl,
    fixMode,
    githubRepo: config.githubRepo,
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
        { taskId: targetTaskId, jid: target.jid },
        'GitHub issues webhook: task created for target',
      );
    } catch (err) {
      logger.error(
        { err, taskId: targetTaskId, jid: target.jid },
        'GitHub issues webhook: failed to create task for target',
      );
    }
  }
}

async function handleGitHubIssuesLabeled(
  payload: Record<string, unknown>,
  config: GitHubIssuesHandlerConfig,
): Promise<void> {
  const issue = payload.issue as Record<string, unknown> | undefined;
  if (!issue) return;

  const label = payload.label as Record<string, unknown> | undefined;
  const labelName = (label?.name as string) ?? '';

  // Only react to "immediate" label being added
  if (labelName !== 'immediate') return;

  // Skip if issue was just created — the "opened" handler already processed it
  // GitHub sends both "opened" and "labeled" events when an issue is created with labels
  const issueCreatedAt = new Date(issue.created_at as string).getTime();
  if (Date.now() - issueCreatedAt < 30_000) {
    logger.debug({ issueNumber: issue.number }, 'GitHub issues webhook: skipping labeled event for freshly opened issue');
    return;
  }

  const issueNumber = issue.number as number;
  const issueTitle = (issue.title as string) ?? '';
  const issueBody = (issue.body as string) ?? '';
  const issueUrl = (issue.html_url as string) ?? '';
  const labels = (issue.labels as Array<Record<string, unknown>>) ?? [];
  const labelNames = labels.map((l) => (l.name as string) ?? '');

  // Must also have "bug" label
  if (!labelNames.includes('bug')) return;

  const taskId = `github-issue-${issueNumber}-immediate`;

  if (getTaskById(taskId)) {
    logger.debug({ taskId }, 'GitHub issues webhook: duplicate labeled event, skipping');
    return;
  }

  const groups = config.getRegisteredGroups();
  const targets = resolveTargets('github-issues', groups);
  if (targets.length === 0) {
    logger.warn('GitHub issues webhook: no routing targets for labeled event');
    return;
  }

  const now = new Date().toISOString();
  const prompt = buildBugFixPrompt({
    issueNumber,
    issueTitle,
    issueBody,
    issueUrl,
    fixMode: 'immediate',
    githubRepo: config.githubRepo,
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
        { issueNumber, taskId: targetTaskId, jid: target.jid },
        'GitHub issues webhook: immediate fix triggered via label',
      );
    } catch (err) {
      logger.error(
        { err, taskId: targetTaskId, jid: target.jid },
        'GitHub issues webhook: failed to create labeled task',
      );
    }
  }
}

interface NoBugLabelInfo {
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
}

function buildNoBugLabelPrompt(info: NoBugLabelInfo): string {
  return `You are Friday — a bot for YourWave.

IMPORTANT: Send messages using mcp__nanoclaw__send_message with sender set to "Friday".

A new GitHub issue was opened but has no "bug" label. Ask the user what to do.

Issue #${info.issueNumber}: ${info.issueTitle}
URL: ${info.issueUrl}

Send this message with two inline buttons:
Message: "❓ *New issue #${info.issueNumber}:* ${info.issueTitle}\\nNo bug label. What should I do?"
Buttons: [{ label: "Fix it 🔧", data: "fix-issue-${info.issueNumber}" }, { label: "Skip ⏭", data: "skip-issue-${info.issueNumber}" }]

Then exit. The user's button tap will trigger a new session.`;
}

interface BugFixInfo {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  issueUrl: string;
  fixMode: 'immediate' | 'nightshift';
  githubRepo: string;
}

function buildBugFixPrompt(info: BugFixInfo): string {
  const ghBase = `https://api.github.com/repos/${info.githubRepo}/issues/${info.issueNumber}`;

  return `You are Friday — a dedicated bug-fixing bot for YourWave. You work AUTONOMOUSLY on bugs reported via GitHub Issues.

IMPORTANT: Send ALL messages using mcp__nanoclaw__send_message with sender set to "Friday". Keep messages short (2-4 sentences max). Use ONLY Telegram formatting: single *asterisks* for bold, _underscores_ for italic, \`backticks\` for code. No markdown headings.

## Bug Details

Issue #${info.issueNumber}: ${info.issueTitle}
URL: ${info.issueUrl}
Fix Mode: ${info.fixMode}

## Full Issue Body
${info.issueBody}

## GitHub API (use fetch with Authorization: Bearer process.env.GITHUB_TOKEN)
- Post comment: POST ${ghBase}/comments  body: { "body": "..." }
- Add label: POST ${ghBase}/labels  body: { "labels": ["label-name"] }
- Close issue: PATCH ${ghBase}  body: { "state": "closed" }

## Your Workflow

1. **Announce** (sender: "Friday"):
   "🐛 *New bug:* ${info.issueTitle}
   Fix Mode: ${info.fixMode}
   🔗 ${info.issueUrl}
   Investigating..."

2. **Research the bug:**
   - Parse the issue body to find: Affected Page URL, CSS Selector, Screenshot path, Description
   - Read the relevant YW_Core source files (at ~/YW_Core) for the CSS path + page URL
   - Do a targeted lookup — do NOT scan the entire codebase

${
  info.fixMode === 'immediate'
    ? `3. **Fix the bug (Immediate mode):**
   a. Send (as Friday): "🛠 *Fixing:* [what needs changing] | Blast radius: [what could break]"
   b. Make the fix in ~/YW_Core
   c. Run: \`cd ~/YW_Core && npm run build\`
   d. If build fails:
      - Investigate the build error
      - Fix the build failure and retry
      - If still failing after investigation → post GitHub comment explaining reason, add label "needs-review", send Telegram warning, stop
   e. If build passes → commit with descriptive message, push
   f. Take a Playwright screenshot of the fixed page (navigate to the Affected Page URL)
   g. Post GitHub comment:
      Commit: [hash]
      [brief description of what changed]
      Build: ✅ passed
   h. Add label "fixed" to the issue, then close it
   i. Send (as Friday): "✅ *Fixed:* ${info.issueTitle}\\nCommit: \`[hash]\`\\n[1-2 sentences about the fix]"`
    : `3. **Queue for Night Shift:**
   a. Post GitHub comment: "Queued for Night Shift 🌙"
   b. Add label "nightshift-queued" to the issue
   c. Send (as Friday): "📋 *Queued for Night Shift:* ${info.issueTitle}"`
}

4. **If fix is risky or unclear (either mode):**
   - Do NOT auto-fix
   - Post GitHub comment explaining why (what makes it risky, what would need to happen)
   - Add label "needs-review"
   - Send (as Friday): "⚠️ *Bug needs attention:* ${info.issueTitle}\\nReason: [why]\\nRecommendation: [what]"

## Safety Rules
Never deploy. Never force push. Never delete files. Simple fixes go to main directly. Complex fixes use a branch.`;
}
