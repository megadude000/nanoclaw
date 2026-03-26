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
    logger.debug({ taskId }, 'GitHub issues webhook: duplicate event, skipping');
    return;
  }

  const groups = config.getRegisteredGroups();
  const mainEntry = Object.entries(groups).find(([, g]) => g.isMain);
  if (!mainEntry) {
    logger.warn('GitHub issues webhook: no main group registered');
    return;
  }

  const [mainJid, mainGroup] = mainEntry;
  const now = new Date().toISOString();

  // No bug label — send Telegram buttons and exit
  if (!labelNames.includes('bug')) {
    logger.info({ issueNumber, issueTitle, labelNames }, 'GitHub issue: no bug label, asking user');
    const prompt = buildNoBugLabelPrompt({ issueNumber, issueTitle, issueUrl });
    createTask({
      id: taskId,
      group_folder: mainGroup.folder,
      chat_jid: mainJid,
      prompt,
      schedule_type: 'once',
      schedule_value: now,
      context_mode: 'isolated',
      next_run: now,
      status: 'active',
      created_at: now,
    });
    return;
  }

  // Determine fix mode from labels; default to nightshift
  const fixMode: 'immediate' | 'nightshift' = labelNames.includes('immediate')
    ? 'immediate'
    : 'nightshift';

  logger.info({ issueNumber, issueTitle, fixMode, taskId }, 'GitHub bug issue task queued');

  const prompt = buildBugFixPrompt({
    issueNumber,
    issueTitle,
    issueBody,
    issueUrl,
    fixMode,
    githubRepo: config.githubRepo,
  });

  createTask({
    id: taskId,
    group_folder: mainGroup.folder,
    chat_jid: mainJid,
    prompt,
    schedule_type: 'once',
    schedule_value: now,
    context_mode: 'isolated',
    next_run: now,
    status: 'active',
    created_at: now,
  });
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
