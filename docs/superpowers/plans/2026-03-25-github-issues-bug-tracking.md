# GitHub Issues Bug Tracking Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Notion bug tracking pipeline with GitHub Issues — bug reports create GitHub Issues, a Friday agent fixes them, and CI notifications also run as Friday in isolated context.

**Architecture:** The existing `/github` webhook endpoint is extended to route by `X-GitHub-Event` header — `workflow_run` goes to the updated CI handler (Friday persona, isolated), `issues` goes to the new `github-issues-webhook.ts`. The `/bugreport` endpoint creates GitHub Issues instead of Notion pages. `notion-webhook.ts` loses its bug-related handlers but keeps the Notion comment → task flow intact.

**Tech Stack:** Node.js 20+, TypeScript, native `fetch` for GitHub REST API, existing `createTask`/`getTaskById` from `src/db.ts`, existing HMAC verification pattern from `src/github-webhook.ts`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/index.ts` | Modify | Add `GITHUB_TOKEN`, `GITHUB_REPO` to `readEnvFile()` + `startWebhookServer()` call |
| `src/webhook-server.ts` | Modify | Update `WebhookServerConfig` + wiring for `githubToken`/`githubRepo` |
| `src/github-webhook.ts` | Modify | Add interface fields; add event router; update CI prompt to Friday/isolated |
| `src/github-issues-webhook.ts` | Create | Handle `issues.opened`; dispatch Friday task |
| `src/notion-webhook.ts` | Modify | Remove bug-related handlers; keep `comment.created` |
| `src/bugreport-webhook.ts` | Modify | Replace Notion page creation with GitHub Issue creation |

---

## Chunk 1: One-time label setup + env config

### Task 1: Create GitHub labels in YW_Core repo

**Files:**
- No source files changed — this is a one-time API setup step

- [ ] **Step 1: Create the 6 required labels via GitHub API**

Run (from nanoclaw dir, secrets loaded from .env):
```bash
cd /home/andrii-panasenko/nanoclaw
TOKEN=$(grep GITHUB_TOKEN .env | cut -d= -f2)
REPO="megadude000/YW_Core"
BASE="https://api.github.com/repos/$REPO/labels"
AUTH="Authorization: Bearer $TOKEN"

create_label() {
  curl -s -X POST "$BASE" \
    -H "$AUTH" -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -d "{\"name\":\"$1\",\"color\":\"$2\",\"description\":\"$3\"}" \
    | jq '{name, color, id}'
}

create_label "bug"              "d73a4a" "Bug report from BugReporter widget"
create_label "immediate"        "e4e669" "Fix now — Friday will auto-fix"
create_label "nightshift"       "0075ca" "Queue for night batch processing"
create_label "nightshift-queued" "cfd3d7" "Confirmed queued for Night Shift"
create_label "fixed"            "0e8a16" "Resolved by Friday"
create_label "needs-review"     "e4e669" "Needs human attention"
```

Expected: 6 JSON objects each with `name`, `color`, `id` fields. Labels already existing will return 422 — safe to ignore.

- [ ] **Step 2: Verify labels exist in repo**

```bash
TOKEN=$(grep GITHUB_TOKEN /home/andrii-panasenko/nanoclaw/.env | cut -d= -f2)
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/megadude000/YW_Core/labels \
  | jq '.[].name'
```

Expected: output includes `"bug"`, `"immediate"`, `"nightshift"`, `"nightshift-queued"`, `"fixed"`, `"needs-review"`.

---

### Task 2: Add GITHUB_REPO to .env

**Files:**
- Modify: `/home/andrii-panasenko/nanoclaw/.env`

- [ ] **Step 1: Add GITHUB_REPO to .env (idempotent)**

```bash
grep -q 'GITHUB_REPO=' /home/andrii-panasenko/nanoclaw/.env || \
  echo 'GITHUB_REPO=megadude000/YW_Core' >> /home/andrii-panasenko/nanoclaw/.env
```

- [ ] **Step 2: Verify — must be exactly one line**

```bash
grep GITHUB_REPO /home/andrii-panasenko/nanoclaw/.env
```

Expected: exactly one line: `GITHUB_REPO=megadude000/YW_Core`. If two lines appear, remove the duplicate with `sed -i '/^GITHUB_REPO=/d' .env` and re-run Step 1.

---

## Chunk 2: Config wiring — index.ts + webhook-server.ts

### Task 3: Update index.ts to load and pass GitHub config

**Files:**
- Modify: `src/index.ts` (around line 527)

- [ ] **Step 1: Read current readEnvFile block**

Read lines 524–540 of `src/index.ts` to confirm current shape before editing.

- [ ] **Step 2: Add GITHUB_TOKEN and GITHUB_REPO to readEnvFile call**

Find:
```ts
  const webhookEnv = readEnvFile([
    'NOTION_WEBHOOK_SECRET',
    'GITHUB_WEBHOOK_SECRET',
    'NOTION_API_KEY',
  ]);
```

Replace with:
```ts
  const webhookEnv = readEnvFile([
    'NOTION_WEBHOOK_SECRET',
    'GITHUB_WEBHOOK_SECRET',
    'NOTION_API_KEY',
    'GITHUB_TOKEN',
    'GITHUB_REPO',
  ]);
```

- [ ] **Step 3: Pass githubToken and githubRepo to startWebhookServer**

The block between the `readEnvFile` call and `startWebhookServer` contains this bridging line — **preserve it exactly as-is**:
```ts
  if (webhookEnv.NOTION_API_KEY)
    process.env.NOTION_API_KEY = webhookEnv.NOTION_API_KEY;
```

Find only the `startWebhookServer` call:
```ts
  const webhookServer = startWebhookServer({
    port: NOTION_WEBHOOK_PORT,
    notionSigningSecret: webhookEnv.NOTION_WEBHOOK_SECRET ?? '',
    githubSigningSecret: webhookEnv.GITHUB_WEBHOOK_SECRET ?? '',
    getRegisteredGroups: () => registeredGroups,
  });
```

Replace with:
```ts
  const webhookServer = startWebhookServer({
    port: NOTION_WEBHOOK_PORT,
    notionSigningSecret: webhookEnv.NOTION_WEBHOOK_SECRET ?? '',
    githubSigningSecret: webhookEnv.GITHUB_WEBHOOK_SECRET ?? '',
    githubToken: webhookEnv.GITHUB_TOKEN ?? '',
    githubRepo: webhookEnv.GITHUB_REPO ?? 'megadude000/YW_Core',
    getRegisteredGroups: () => registeredGroups,
  });
```

- [ ] **Step 4: Build to verify progress (intentional failure)**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1 | tail -20
```

Expected: TypeScript errors about missing `githubToken`/`githubRepo` fields in `WebhookServerConfig` — **this is intentional and correct**. Proceed to Task 4 to fix them.

---

### Task 4: Update WebhookServerConfig and wiring in webhook-server.ts

**Files:**
- Modify: `src/webhook-server.ts`

- [ ] **Step 1: Add githubToken and githubRepo to WebhookServerConfig interface**

Find:
```ts
export interface WebhookServerConfig {
  port: number;
  notionSigningSecret: string;
  githubSigningSecret: string;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}
```

Replace with:
```ts
export interface WebhookServerConfig {
  port: number;
  notionSigningSecret: string;
  githubSigningSecret: string;
  githubToken: string;
  githubRepo: string;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}
```

- [ ] **Step 2: Pass githubToken and githubRepo into githubConfig**

Find:
```ts
  const githubConfig: GitHubHandlerConfig = {
    signingSecret: config.githubSigningSecret,
    getRegisteredGroups: config.getRegisteredGroups,
  };
```

Replace with:
```ts
  const githubConfig: GitHubHandlerConfig = {
    signingSecret: config.githubSigningSecret,
    githubToken: config.githubToken,
    githubRepo: config.githubRepo,
    getRegisteredGroups: config.getRegisteredGroups,
  };
```

- [ ] **Step 3: Update bugReportConfig to use GitHub instead of Notion**

Find:
```ts
  const bugReportConfig: BugReportHandlerConfig = {
    notionApiKey: process.env.NOTION_API_KEY ?? '',
  };
```

Replace with:
```ts
  const bugReportConfig: BugReportHandlerConfig = {
    githubToken: config.githubToken,
    githubRepo: config.githubRepo,
  };
```

- [ ] **Step 4: Build to verify progress (intentional failure)**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1 | tail -20
```

Expected: TypeScript errors about `GitHubHandlerConfig` missing `githubToken`/`githubRepo` and `BugReportHandlerConfig` missing fields — **intentional, fixed in subsequent tasks**.

---

## Chunk 3: github-webhook.ts — extend interface + event router + CI update

### Task 5: Extend GitHubHandlerConfig and add event router

**Files:**
- Modify: `src/github-webhook.ts`

- [ ] **Step 1: Add githubToken and githubRepo to GitHubHandlerConfig interface**

Find:
```ts
export interface GitHubHandlerConfig {
  signingSecret: string;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}
```

Replace with:
```ts
export interface GitHubHandlerConfig {
  signingSecret: string;
  githubToken: string;
  githubRepo: string;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}
```

- [ ] **Step 2: Add import for handleGitHubIssuesEvent at top of file**

After the existing imports, add:
```ts
import { handleGitHubIssuesEvent } from './github-issues-webhook.js';
```

- [ ] **Step 3: Replace the event routing in handleEvent()**

Find:
```ts
async function handleEvent(
  event: string,
  payload: Record<string, unknown>,
  config: GitHubHandlerConfig,
): Promise<void> {
  // Only process workflow_run completed events
  if (event !== 'workflow_run') return;
```

Replace the entire `handleEvent` function with:
```ts
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
```

> **Note:** After Step 3, the file calls `handleWorkflowRunEvent` which does not exist yet — Step 4 must immediately follow. Do not run a build check between Steps 3 and 4.

- [ ] **Step 4: Create handleWorkflowRunEvent() function**

Add the following new function after the updated `handleEvent`. This contains the same CI logic that was previously inside `handleEvent`, now named and with `context_mode` changed to `'isolated'`:

```ts
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
  const mainEntry = Object.entries(groups).find(([, g]) => g.isMain);
  if (!mainEntry) {
    logger.warn(
      'GitHub webhook: no main group registered, cannot dispatch task',
    );
    return;
  }

  const [mainJid, mainGroup] = mainEntry;

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

  logger.info(
    { repoFullName, runId, conclusion, headBranch, taskId },
    'GitHub CI task queued',
  );
}
```

Note: `context_mode` is changed from `'group'` to `'isolated'` — CI events are background notifications that should not inject into the main conversation history.

- [ ] **Step 5: Replace buildAgentPrompt with buildCIPrompt (Friday persona)**

The `CIRunInfo` interface (declared around line 176) stays **unchanged** — only the function is renamed and its body replaced.

Find:
```ts
function buildAgentPrompt(info: CIRunInfo): string {
  return `A GitHub Actions workflow just completed. Process it and notify the user.
```

Replace the entire function body only (keep `interface CIRunInfo` as-is above it):
```ts
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
```

- [ ] **Step 6: Build to check progress (intentional failure)**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1 | tail -20
```

Expected: TypeScript error about missing `github-issues-webhook` module or its exported `handleGitHubIssuesEvent` — **intentional**. The file is created in Chunk 4.

---

## Chunk 4: github-issues-webhook.ts (new file)

### Task 6: Create github-issues-webhook.ts

**Files:**
- Create: `src/github-issues-webhook.ts`

- [ ] **Step 1: Create the file with interface + exported handler**

```ts
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
```

- [ ] **Step 1b: Verify file was created** — run `ls src/github-issues-webhook.ts` — Expected: file listed

- [ ] **Step 2: Add the no-bug-label prompt builder**

```ts
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
```

- [ ] **Step 3: Add the bug fix prompt builder**

```ts
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
      "Fixed by Friday 🤖
      Commit: [hash]
      [brief description of what changed]
      Build: ✅ passed"
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
```

- [ ] **Step 4: Build to verify the new file compiles**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1 | tail -20
```

Expected: TypeScript errors from `bugreport-webhook.ts` about `notionApiKey` — intentional, fixed in Chunk 5.

---

## Chunk 5: bugreport-webhook.ts — replace Notion with GitHub Issues

### Task 7: Rewrite bugreport-webhook.ts to create GitHub Issues

**Files:**
- Modify: `src/bugreport-webhook.ts`

- [ ] **Step 0: Read the file before editing** — Read `src/bugreport-webhook.ts` to understand current structure before any changes.

- [ ] **Step 1: Update BugReportHandlerConfig interface**

Find:
```ts
export interface BugReportHandlerConfig {
  notionApiKey: string;
}
```

Replace with:
```ts
export interface BugReportHandlerConfig {
  githubToken: string;
  githubRepo: string;
}
```

- [ ] **Step 2: Remove the Notion database constant**

Find and delete:
```ts
// Notion Bugs database ID
const BUGS_DATABASE_ID = '32e9e7f6-c2ca-81e6-a351-fb49388565de';
```

- [ ] **Step 3: Update handleReport to call GitHub instead of Notion**

Find:
```ts
async function handleReport(
  report: BugReport,
  config: BugReportHandlerConfig,
): Promise<void> {
  const reportId = `bug-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // Normalize viewport - widget sends {w, h} but manual tests may send string
  if (typeof report.viewport === 'string') {
    const parts = (report.viewport as string).split('x');
    report.viewport = {
      w: parseInt(parts[0]) || 0,
      h: parseInt(parts[1]) || 0,
    };
  }

  // Save screenshot to disk
  let screenshotPath = '';
  if (report.screenshot?.startsWith('data:image/')) {
    const dir = path.join(process.cwd(), 'bug-reports');
    mkdirSync(dir, { recursive: true });
    const base64Data = report.screenshot.replace(
      /^data:image\/\w+;base64,/,
      '',
    );
    screenshotPath = path.join(dir, `${reportId}.png`);
    writeFileSync(screenshotPath, Buffer.from(base64Data, 'base64'));
    logger.info({ screenshotPath }, 'Bug report screenshot saved');
  }

  // Create a page in the Notion Bugs database
  const notionPage = await createNotionBugPage(
    report,
    reportId,
    screenshotPath,
    config.notionApiKey,
  );

  if (notionPage) {
    logger.info(
      {
        reportId,
        notionPageId: notionPage.id,
        url: report.url,
        fixMode: report.fixMode,
      },
      'Bug report created in Notion',
    );
  }
}
```

Replace with:
```ts
async function handleReport(
  report: BugReport,
  config: BugReportHandlerConfig,
): Promise<void> {
  const reportId = `bug-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // Normalize viewport - widget sends {w, h} but manual tests may send string
  if (typeof report.viewport === 'string') {
    const parts = (report.viewport as string).split('x');
    report.viewport = {
      w: parseInt(parts[0]) || 0,
      h: parseInt(parts[1]) || 0,
    };
  }

  // Save screenshot to disk
  let screenshotPath = '';
  if (report.screenshot?.startsWith('data:image/')) {
    const dir = path.join(process.cwd(), 'bug-reports');
    mkdirSync(dir, { recursive: true });
    const base64Data = report.screenshot.replace(
      /^data:image\/\w+;base64,/,
      '',
    );
    screenshotPath = path.join(dir, `${reportId}.png`);
    writeFileSync(screenshotPath, Buffer.from(base64Data, 'base64'));
    logger.info({ screenshotPath }, 'Bug report screenshot saved');
  }

  // Create a GitHub Issue in YW_Core
  const issue = await createGitHubIssue(
    report,
    reportId,
    screenshotPath,
    config,
  );

  if (issue) {
    logger.info(
      {
        reportId,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        url: report.url,
        fixMode: report.fixMode,
      },
      'Bug report created as GitHub Issue',
    );
  }
}
```

- [ ] **Step 3b: Confirm extractBrowser survives** — Run `grep -n "extractBrowser" src/bugreport-webhook.ts` — Expected: at least 2 occurrences (definition + usage). `extractBrowser` is a pre-existing utility helper unrelated to Notion — do NOT delete it.

- [ ] **Step 4: Replace createNotionBugPage with createGitHubIssue**

Delete the entire `createNotionBugPage` function, the `NotionPageResult` interface, and all Notion block helpers (`makeHeading`, `makeParagraph`).

Add in their place:

```ts
interface GitHubIssueResult {
  number: number;
  html_url: string;
}

async function createGitHubIssue(
  report: BugReport,
  reportId: string,
  screenshotPath: string,
  config: BugReportHandlerConfig,
): Promise<GitHubIssueResult | null> {
  const browserShort = extractBrowser(report.userAgent);
  const viewportStr = report.viewport
    ? `${report.viewport.w}x${report.viewport.h}`
    : 'N/A';
  const selectorStr = report.cssPath || 'N/A';

  const title = report.description.slice(0, 100);

  const body = `## Bug Report

**Affected Page URL:** ${report.url}
**Fix Mode:** ${report.fixMode}
**Browser:** ${browserShort}
**Viewport:** ${viewportStr}
**CSS Selector:** \`${selectorStr}\`

## Description

${report.description}

## Debug Info

- Report ID: ${reportId}
- Screenshot: ${screenshotPath || 'N/A'}
- Reported At: ${report.timestamp || new Date().toISOString()}
- User Agent: ${report.userAgent}`;

  const labels = ['bug', report.fixMode === 'immediate' ? 'immediate' : 'nightshift'];

  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.githubRepo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, body, labels }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        'GitHub API error creating issue',
      );
      return null;
    }

    const data = (await response.json()) as { number: number; html_url: string };
    return { number: data.number, html_url: data.html_url };
  } catch (err) {
    logger.error({ err, url: report.url }, 'Failed to create GitHub Issue');
    return null;
  }
}
```

- [ ] **Step 5: Build to verify bugreport-webhook.ts compiles cleanly**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1 | tail -20
```

Expected: Clean build with no TypeScript errors. (notion-webhook.ts has not been touched yet.)

---

## Chunk 6: notion-webhook.ts — remove bug handlers

### Task 8: Strip bug-related code from notion-webhook.ts

**Files:**
- Modify: `src/notion-webhook.ts`

- [ ] **Step 0: Read notion-webhook.ts before editing** — Read `src/notion-webhook.ts` to confirm current structure.

- [ ] **Step 1: Remove the page.created/page.updated branch from handleEvent()**

Find:
```ts
  if (type === 'page.created' || type === 'page.updated') {
    return handlePageEvent(event, config, type);
  }
```

Delete those 3 lines entirely.

- [ ] **Step 2: Delete handlePageEvent function**

Find and delete the entire `handlePageEvent` function. It starts with `async function handlePageEvent(` and ends at the closing `}`. Do NOT delete `handleCommentCreated`.

- [ ] **Step 3: Delete buildBugFixPrompt function**

Find and delete the entire `buildBugFixPrompt` function. It starts with `function buildBugFixPrompt(` and ends at the closing `}`. It is the last large function in the file.

- [ ] **Step 4: Verify handleCommentCreated and buildAgentPrompt are intact**

Read `src/notion-webhook.ts` after changes. Confirm:
- `handleCommentCreated` function is present and unchanged
- `buildAgentPrompt` function (Notion task agent with YourWave context) is present and unchanged
- `handleEvent()` still handles `comment.created` correctly

- [ ] **Step 5: Full build — must be clean**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1
```

Expected: Clean build with no TypeScript errors.

- [ ] **Step 6: Commit all changes**

```bash
cd /home/andrii-panasenko/nanoclaw
git add src/index.ts src/webhook-server.ts src/github-webhook.ts \
        src/github-issues-webhook.ts src/notion-webhook.ts src/bugreport-webhook.ts
git commit -m "feat: replace Notion bug tracking with GitHub Issues

- bugreport-webhook: create GitHub Issues instead of Notion pages
- github-webhook: route by X-GitHub-Event; CI runs as Friday (isolated)
- github-issues-webhook: new handler for issues.opened → Friday task
- notion-webhook: remove bug handlers; keep comment.created flow
- index/webhook-server: wire GITHUB_TOKEN + GITHUB_REPO through config"
```

---

## Chunk 7: Verification + restart

### Task 9: Add GITHUB_REPO to .env and restart nanoclaw

- [ ] **Step 1: Verify GITHUB_REPO is in .env**

```bash
grep GITHUB_REPO /home/andrii-panasenko/nanoclaw/.env
```

Expected: `GITHUB_REPO=megadude000/YW_Core`

- [ ] **Step 2: Restart nanoclaw**

```bash
systemctl --user restart nanoclaw
sleep 3
systemctl --user status nanoclaw --no-pager | head -20
```

Expected: `Active: active (running)`

- [ ] **Step 3: Check webhook server is accepting requests**

```bash
curl -s http://localhost:3456/health | jq .
```

Expected:
```json
{ "ok": true, "routes": ["/notion", "/github", "/bugreport"] }
```

### Task 10: End-to-end smoke test

- [ ] **Step 1: Simulate a bug report via /bugreport**

```bash
curl -s -X POST http://localhost:3456/bugreport \
  -H "Content-Type: application/json" \
  -d '{
    "description": "TEST: Hero button misaligned on mobile viewport",
    "url": "https://yourwave.uk",
    "viewport": {"w": 390, "h": 844},
    "cssPath": "#hero > .cta-button",
    "fixMode": "nightshift",
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }' | jq .
```

Expected: `{ "ok": true }`

- [ ] **Step 2: Verify GitHub Issue was created**

```bash
TOKEN=$(grep GITHUB_TOKEN /home/andrii-panasenko/nanoclaw/.env | cut -d= -f2)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/megadude000/YW_Core/issues?state=open&labels=bug&per_page=3" \
  | jq '.[] | {number, title, labels: [.labels[].name]}'
```

Expected: The test issue appears with labels `["bug", "nightshift"]`.

- [ ] **Step 3: Wait for webhook delivery then verify task queued** — GitHub webhook delivery is async. Wait 10 seconds then check logs:

```bash
sleep 10
journalctl --user -u nanoclaw -n 100 --no-pager | grep "github-issue"
```

Expected: Log line `GitHub bug issue task queued` with `issueNumber`, `fixMode: nightshift`.

- [ ] **Step 4: Clean up test issue**

```bash
TOKEN=$(grep GITHUB_TOKEN /home/andrii-panasenko/nanoclaw/.env | cut -d= -f2)
ISSUE_NUM=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/megadude000/YW_Core/issues?state=open&labels=bug&per_page=1" \
  | jq '.[0].number')
curl -s -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/megadude000/YW_Core/issues/$ISSUE_NUM" \
  -d '{"state":"closed","state_reason":"not_planned"}' | jq '{number, state}'
```

Expected: `{ "number": N, "state": "closed" }`

- [ ] **Step 5: Smoke test no-bug-label path**

Send an issue.opened payload without the "bug" label via the webhook endpoint directly (simulating GitHub):

```bash
cd /home/andrii-panasenko/nanoclaw
SECRET=$(grep GITHUB_WEBHOOK_SECRET .env | cut -d= -f2)
PAYLOAD='{"action":"opened","issue":{"number":99999,"title":"TEST: unlabeled issue","body":"test body","html_url":"https://github.com/megadude000/YW_Core/issues/99999","labels":[]}}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/.*= //')
curl -s -X POST http://localhost:3456/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issues" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$PAYLOAD"
```

Then check logs:
```bash
journalctl --user -u nanoclaw -n 30 --no-pager | grep "no bug label"
```

Expected: log line "GitHub issue: no bug label, asking user" with issueNumber 99999.

- [ ] **Step 6: Verify comment.created still routes (notion-webhook preserved)**

Check that handleCommentCreated is exported/callable in the compiled output:
```bash
grep -l "handleCommentCreated" /home/andrii-panasenko/nanoclaw/dist/notion-webhook.js 2>/dev/null && echo "present" || echo "MISSING"
```
Expected: "present"
