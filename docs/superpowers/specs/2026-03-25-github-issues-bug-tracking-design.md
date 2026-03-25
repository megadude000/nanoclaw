# GitHub Issues Bug Tracking — Design Spec

**Date:** 2026-03-25
**Project:** NanoClaw / YourWave
**Status:** Approved

---

## Overview

Replace the Notion bug tracking pipeline with GitHub Issues on `megadude000/YW_Core`. Bug reports flow from the BugReporter widget directly into GitHub Issues. A GitHub webhook triggers the Friday agent to fix or queue bugs. Notion integration remains for `comment.created` → scheduled task flow only.

---

## Architecture

### Files Changed

| File | Change |
|---|---|
| `src/index.ts` | Add `GITHUB_TOKEN`, `GITHUB_REPO` to `readEnvFile()` call; pass both to `startWebhookServer()` |
| `src/webhook-server.ts` | Add `githubToken`/`githubRepo` to `WebhookServerConfig`; update `githubConfig` and `bugReportConfig`; update health routes list |
| `src/github-webhook.ts` | Add `githubToken`/`githubRepo` to `GitHubHandlerConfig`; route by `X-GitHub-Event` header; dispatch `issues` → `handleGitHubIssuesEvent()`; update CI prompt to Friday persona + `context_mode: 'isolated'` |
| `src/github-issues-webhook.ts` | **NEW** — exports `handleGitHubIssuesEvent()`; handles `issues.opened`; dispatches Friday task (`context_mode: 'isolated'`) |
| `src/notion-webhook.ts` | Remove `handlePageEvent`, `buildBugFixPrompt`, and the `page.created`/`page.updated` branch in `handleEvent()`; `handleCommentCreated` and `buildAgentPrompt` (Notion task agent) are fully preserved |
| `src/bugreport-webhook.ts` | Replace `BugReportHandlerConfig.notionApiKey` with `githubToken`/`githubRepo`; replace Notion page creation with GitHub Issue creation |

### New Env Vars

| Var | Status | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | Already in `.env` | PAT with `issues:write` scope |
| `GITHUB_REPO` | **Add to `.env`** | Target repo, e.g. `megadude000/YW_Core` |

`GITHUB_WEBHOOK_SECRET` already in `.env` and wired.

### Webhook (already registered)

- **ID:** `602723482` on `megadude000/YW_Core`
- **URL:** `https://hooks.yourwave.uk/github`
- **Events:** `issues`, `workflow_run`, `ping`
- **Secret:** existing `GITHUB_WEBHOOK_SECRET`

### One-Time Label Setup

Run once to create required labels in `megadude000/YW_Core`. Script provided in implementation plan. Labels: `bug` (#d73a4a), `immediate` (#e4e669), `nightshift` (#0075ca), `nightshift-queued` (#cfd3d7), `fixed` (#0e8a16), `needs-review` (#e4e669).

---

## Interface Changes

### `index.ts` (updated)

```ts
const webhookEnv = readEnvFile([
  'NOTION_WEBHOOK_SECRET',
  'GITHUB_WEBHOOK_SECRET',
  'NOTION_API_KEY',
  'GITHUB_TOKEN',   // new
  'GITHUB_REPO',    // new
]);

const webhookServer = startWebhookServer({
  port: NOTION_WEBHOOK_PORT,
  notionSigningSecret: webhookEnv.NOTION_WEBHOOK_SECRET ?? '',
  githubSigningSecret: webhookEnv.GITHUB_WEBHOOK_SECRET ?? '',
  githubToken: webhookEnv.GITHUB_TOKEN ?? '',             // new
  githubRepo: webhookEnv.GITHUB_REPO ?? 'megadude000/YW_Core', // new
  getRegisteredGroups: () => registeredGroups,
});
```

### `WebhookServerConfig` (updated)

```ts
export interface WebhookServerConfig {
  port: number;
  notionSigningSecret: string;
  githubSigningSecret: string;
  githubToken: string;   // new
  githubRepo: string;    // new
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}
```

### `GitHubHandlerConfig` (updated)

```ts
export interface GitHubHandlerConfig {
  signingSecret: string;
  githubToken: string;   // new — passed to issues handler
  githubRepo: string;    // new — passed to issues handler
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}
```

`webhook-server.ts` constructs this from `WebhookServerConfig` fields.

### `BugReportHandlerConfig` (updated)

```ts
export interface BugReportHandlerConfig {
  githubToken: string;  // replaces notionApiKey
  githubRepo: string;
}
```

### `GitHubIssuesHandlerConfig` (new)

```ts
export interface GitHubIssuesHandlerConfig {
  githubToken: string;
  githubRepo: string;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}
```

### `github-webhook.ts` routing

After HMAC verification, dispatch by `X-GitHub-Event` header:

```ts
if (event === 'workflow_run') handleWorkflowRunEvent(payload, config);
if (event === 'issues')       handleGitHubIssuesEvent(payload, {
  githubToken: config.githubToken,
  githubRepo: config.githubRepo,
  getRegisteredGroups: config.getRegisteredGroups,
});
```

`handleGitHubIssuesEvent` imported from `./github-issues-webhook.js`.

---

## Data Flow

### Bug Reporting (new)

```
BugReporter widget (Ctrl+Shift+Alt+B)
  → POST /bugreport
  → save screenshot to disk (unchanged)
  → POST https://api.github.com/repos/{githubRepo}/issues
      title: first 100 chars of description
      body: structured markdown (see Issue Body Format)
      labels: ["bug", "immediate"] or ["bug", "nightshift"]
  → GitHub fires issues.opened → hooks.yourwave.uk/github
  → HMAC verify → github-webhook.ts → dispatch to github-issues-webhook.ts
  → label check → Friday task created (context_mode: 'isolated')
  → Friday agent investigates + fixes or queues
  → Friday posts GitHub comment + closes issue (or adds nightshift-queued label)
  → Friday sends Telegram notification as "Friday"
```

### CI (updated — now Friday persona, isolated context)

```
GitHub Actions completes
  → workflow_run.completed → hooks.yourwave.uk/github
  → HMAC verify → github-webhook.ts CI handler
  → createTask (context_mode: 'isolated') with Friday persona prompt
  → Friday analyzes logs, reports/fixes, sends Telegram as "Friday"
```

Rationale for `context_mode: 'isolated'` on CI: CI events are background notifications, not part of the main conversation thread. Friday should handle them without injecting into the group conversation history.

### Notion Comments (unchanged)

```
comment.created → /notion → createTask (context_mode: 'isolated') → Notion task agent
```

---

## GitHub Issue Body Format

`Affected Page URL` = the YourWave site URL from `BugReport.url` (where the bug occurred in the browser) — not a Notion URL.

```markdown
## Bug Report

**Affected Page URL:** https://yourwave.uk/...
**Fix Mode:** immediate
**Browser:** Chrome 123
**Viewport:** 1440x900
**CSS Selector:** `#hero > .button`

## Description

[user description]

## Debug Info

- Report ID: bug-1234567890-abcd
- Screenshot: /nanoclaw/bug-reports/bug-1234567890-abcd.png
- Reported At: 2026-03-25T21:00:00.000Z
- User Agent: Mozilla/5.0...
```

Labels applied at creation: `bug` + `immediate` or `nightshift`.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Issue opened without `bug` label | Friday sends Telegram buttons to main group (found via `getRegisteredGroups()`): "Fix it 🔧" / "Skip ⏭". Agent exits. User's button tap arrives as a normal inbound message and triggers a new agent session with issue URL as context. |
| `immediate` or `nightshift` label missing | Default to `nightshift` |
| GitHub API failure in `/bugreport` | Log error, return 200 to widget; screenshot still saved to disk |
| Duplicate `issues.opened` event | Dedup via `github-issue-${issue.number}` (the human-readable issue number from `payload.issue.number`, not `payload.issue.id`) |
| Build fails after fix | Friday investigates root cause, attempts to fix build, retries. Adds `needs-review` label and comments only if still failing after investigation. |
| Risky / unclear fix | Friday posts GitHub comment with reason + recommendation, adds `needs-review` label, skips auto-fix, sends Telegram warning |

---

## Agent Prompt Design

All Friday prompts use `mcp__nanoclaw__send_message` with `sender="Friday"` — same pattern as the existing Notion bug-fix prompt.

### Friday — Issues Handler (`context_mode: 'isolated'`)

Receives: `issue.number`, `issue.title`, `issue.body` (full structured markdown), `issue.labels`, `issue.html_url`.

**Step 1 — Announce:**
```
🐛 *New bug:* [title]
URL: [affected page url] | [immediate/nightshift]
CSS: `[css path]`
🔗 [github issue link]
Investigating...
```

**Step 2 — Research:**
- Read YW_Core source files relevant to CSS path + affected page URL
- Targeted lookup — not a full codebase scan

**Step 3a — Immediate fix:**
1. Send: `🛠 *Fixing:* [what needs changing] | Blast radius: [what could break]`
2. Make the fix
3. Run: `cd ~/YW_Core && npm run build`
4. If build fails → investigate failure, fix it, retry. If still failing after investigation → add `needs-review`, post GitHub comment, send Telegram warning, stop.
5. If build passes → commit, push
6. Take Playwright screenshot of fixed page
7. Post GitHub comment: `Fixed by Friday 🤖\nCommit: [hash]\n[description]\nBuild: ✅`
8. Apply label `fixed`, close issue
9. Send: `✅ *Fixed:* [title]\nCommit: \`[hash]\`\n[1-2 sentences]`

**Step 3b — Nightshift:**
1. Add label `nightshift-queued`
2. Post GitHub comment: `Queued for Night Shift 🌙`
3. Send: `📋 *Queued for Night Shift:* [title]`

**Step 3c — Risky/unclear:**
1. Post GitHub comment with reason
2. Add label `needs-review`
3. Send: `⚠️ *Bug needs attention:* [title]\nReason: [why]\nRecommendation: [what]`

**No `bug` label — buttons flow:**
```
❓ *New issue #[N]:* [title]
No bug label. What should I do?
[Fix it 🔧] [Skip ⏭]
```
Agent sends buttons to main group (via `getRegisteredGroups()`) and exits. User's tap triggers a new session.

### Friday — CI Handler (`context_mode: 'isolated'`)

**On failure:**
1. React ❌, send as Friday: `❌ *CI failed:* [workflow] on [branch]`
2. Run `gh run view [runId] --log-failed`
3. Identify failing job + root cause
4. If fix obvious → fix, commit, push, send: `🔧 *Fixed CI:* [what changed]`
5. If not → send: `⚠️ *CI needs attention:* [root cause]\nRecommendation: [fix]`

**On success:**
- React ✅, send as Friday: `✅ CI passed: [commit] ([branch])`

---

## Health Route Update

`webhook-server.ts` health response routes list stays `['/notion', '/github', '/bugreport']` — no route additions. The `/github` route internally handles multiple event types but that is not exposed in the health check.

---

## What Is NOT Changing

- `/notion` endpoint and Notion HMAC verification
- `handleCommentCreated` and `buildAgentPrompt` in `notion-webhook.ts` (Notion task agent — fully preserved)
- Screenshot saving to `/nanoclaw/bug-reports/`
- `/bugreport` CORS headers
- Dedup logic pattern (same `getTaskById` + `createTask` flow, new task ID prefix)
