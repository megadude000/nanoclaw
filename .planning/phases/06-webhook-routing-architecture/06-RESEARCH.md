# Phase 6: Webhook Routing Architecture - Research

**Researched:** 2026-03-26
**Domain:** Webhook routing abstraction, multi-platform message delivery
**Confidence:** HIGH

## Summary

Phase 6 replaces hardcoded `mainJid` lookups in four webhook handlers with a configurable routing layer. Each webhook type gets a config entry in `config/routing.json` specifying target platform(s) -- Telegram, Discord, or both. The routing resolver reads config fresh per invocation (webhooks are infrequent), validates with Zod, and returns an array of `{ jid, group }` targets. Dual-send is achieved naturally by listing multiple targets.

The existing codebase makes this straightforward: all four webhook handlers use the identical `Object.entries(groups).find(([, g]) => g.isMain)` pattern to find their target. Replacing this with a `resolveTargets(webhookType, groups)` call is a minimal, mechanical change. The progress tracker is already JID-agnostic (receives sendMsg/editMsg as function deps), so routing it to Discord only requires passing the correct JID at initialization.

**Primary recommendation:** Create a new `src/webhook-router.ts` module with `resolveTargets()` function, a Zod schema for `config/routing.json`, and update each webhook handler to use it. Fallback to mainJid when config is missing ensures backward compatibility.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: JSON config file (`config/routing.json`) -- declarative, matches Phase 5 pattern
- D-02: Config read fresh on every webhook invocation -- simplest approach, instant changes without restart
- D-03: Zod validation of config at load time -- same pattern as Phase 5 bootstrap
- D-04: Per webhook type routing -- one config entry per handler (github-issues, notion, progress, github-ci, bugreport)
- D-05: Each entry specifies `targets: ["telegram", "discord"]` or subset -- array allows dual-send naturally
- D-06: Discord target includes channel JID (`dc:{channelId}`) so routing knows which Discord channel
- D-07: Best-effort delivery -- send to all configured targets, log errors but don't block other targets
- D-08: Each target send wrapped in try/catch -- one platform failing doesn't prevent delivery to the other
- D-09: Pino logging for routing decisions and failures
- D-10: Single `resolveTargets(webhookType)` function that reads config and returns array of `{ jid, group }` entries
- D-11: Webhook handlers call `resolveTargets()` instead of `Object.entries(groups).find(([, g]) => g.isMain)`
- D-12: Default fallback -- if no config exists or webhook type not configured, fall back to mainJid (backward compatible)

### Claude's Discretion
- Exact JSON config schema structure and field names
- Whether resolveTargets returns JIDs or full group entries
- Helper function location (new file vs added to existing router.ts)
- Order of dual-send delivery (parallel vs sequential)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUT-01 | Webhook routing abstraction layer replacing hardcoded `mainJid` | New `src/webhook-router.ts` with `resolveTargets()` function + Zod config schema |
| ROUT-02 | GitHub Issues webhook routable to Discord `#bugs` channel | Modify `github-issues-webhook.ts` lines 43-50 to use resolveTargets('github-issues') |
| ROUT-03 | Notion webhook routable to Discord `#yw-tasks` channel | Modify `notion-webhook.ts` lines 138-145 to use resolveTargets('notion') |
| ROUT-04 | Progress tracker output routable to Discord `#progress` channel | Progress tracker is already JID-agnostic; pass resolved JID at `onMessageSent` call site in index.ts |
| ROUT-05 | Routing config supports targeting Telegram, Discord, or both per webhook | `config/routing.json` with per-type `targets` array containing platform + JID entries |
| ROUT-06 | Dual-send mode: same notification sent to both platforms during migration | Iterate over all targets from resolveTargets(), try/catch each send independently |
</phase_requirements>

## Standard Stack

### Core
No new libraries needed. This phase uses only existing project dependencies.

### Supporting (already in project)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| zod | ^4.3.6 | Config validation | Validate routing.json schema, matches Phase 5 pattern |
| pino | ^9.6.0 | Logging | Log routing decisions and delivery failures |
| better-sqlite3 | ^11.8.1 | Task creation | Webhook handlers create tasks via `createTask()` |

### No New Dependencies
This is a pure refactoring/routing layer phase. All needed capabilities exist in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
  webhook-router.ts          # NEW: resolveTargets() + Zod schema + config loader
  github-issues-webhook.ts   # MODIFY: replace mainEntry lookup with resolveTargets()
  github-webhook.ts          # MODIFY: replace mainEntry lookup with resolveTargets()
  notion-webhook.ts          # MODIFY: replace mainEntry lookup with resolveTargets()
  progress-tracker.ts        # NO CHANGE (already JID-agnostic)
  bugreport-webhook.ts       # NO CHANGE (creates GitHub issues, no chat routing)
  index.ts                   # MODIFY: pass routing config to progress tracker JID selection
config/
  routing.json               # NEW: per-webhook-type routing targets
  discord-server.json        # EXISTING: server structure (reference for channel names)
```

### Pattern 1: Routing Config Schema
**What:** JSON config with per-webhook-type target arrays
**When to use:** Every webhook invocation reads this to determine delivery targets

```typescript
// src/webhook-router.ts
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TargetSchema = z.object({
  platform: z.enum(['telegram', 'discord']),
  jid: z.string(),  // e.g. "tg:12345" or "dc:98765"
});

const WebhookRouteSchema = z.object({
  targets: z.array(TargetSchema).min(1),
});

const RoutingConfigSchema = z.record(z.string(), WebhookRouteSchema);

type RoutingConfig = z.infer<typeof RoutingConfigSchema>;

export interface RouteTarget {
  jid: string;
  group: RegisteredGroup;
}
```

### Pattern 2: resolveTargets Function
**What:** Reads config, validates, resolves JIDs to group entries, falls back to mainJid
**When to use:** Called by each webhook handler instead of the mainEntry lookup

```typescript
const CONFIG_PATH = resolve(__dirname, '..', 'config', 'routing.json');

export function resolveTargets(
  webhookType: string,
  groups: Record<string, RegisteredGroup>,
): RouteTarget[] {
  // Fallback helper
  const mainFallback = (): RouteTarget[] => {
    const mainEntry = Object.entries(groups).find(([, g]) => g.isMain);
    if (!mainEntry) return [];
    return [{ jid: mainEntry[0], group: mainEntry[1] }];
  };

  // D-12: If config doesn't exist, fall back to mainJid
  if (!existsSync(CONFIG_PATH)) {
    logger.debug({ webhookType }, 'routing: no config file, using mainJid fallback');
    return mainFallback();
  }

  let config: RoutingConfig;
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    config = RoutingConfigSchema.parse(JSON.parse(raw));
  } catch (err) {
    logger.warn({ err, webhookType }, 'routing: invalid config, using mainJid fallback');
    return mainFallback();
  }

  const route = config[webhookType];
  if (!route) {
    logger.debug({ webhookType }, 'routing: no entry for webhook type, using mainJid fallback');
    return mainFallback();
  }

  // Resolve JIDs to registered groups
  const resolved: RouteTarget[] = [];
  for (const target of route.targets) {
    const group = groups[target.jid];
    if (group) {
      resolved.push({ jid: target.jid, group });
    } else {
      logger.warn({ jid: target.jid, webhookType }, 'routing: target JID not registered, skipping');
    }
  }

  // If none resolved, fall back to main
  if (resolved.length === 0) {
    logger.warn({ webhookType }, 'routing: no targets resolved, using mainJid fallback');
    return mainFallback();
  }

  logger.info({ webhookType, targets: resolved.map(t => t.jid) }, 'routing: resolved targets');
  return resolved;
}
```

### Pattern 3: Webhook Handler Migration
**What:** Replace `mainEntry` lookup with `resolveTargets()` loop + try/catch per target
**When to use:** In each webhook handler that currently does `Object.entries(groups).find(([, g]) => g.isMain)`

```typescript
// BEFORE (github-issues-webhook.ts, lines 43-50):
const groups = config.getRegisteredGroups();
const mainEntry = Object.entries(groups).find(([, g]) => g.isMain);
if (!mainEntry) { logger.warn('...'); return; }
const [mainJid, mainGroup] = mainEntry;
// ... createTask({ chat_jid: mainJid, group_folder: mainGroup.folder, ... })

// AFTER:
const groups = config.getRegisteredGroups();
const targets = resolveTargets('github-issues', groups);
if (targets.length === 0) { logger.warn('...'); return; }

for (const target of targets) {
  try {
    createTask({
      id: `${taskId}-${target.jid}`,  // unique per target
      group_folder: target.group.folder,
      chat_jid: target.jid,
      prompt,
      // ... rest same
    });
  } catch (err) {
    logger.error({ err, jid: target.jid }, 'routing: failed to create task for target');
  }
}
```

### Pattern 4: Dual-Send Task ID Uniqueness
**What:** When sending to multiple targets, task IDs must be unique per target
**When to use:** Any webhook handler creating tasks for multiple targets

```typescript
// Task IDs include the target JID to avoid SQLite unique constraint violations
const baseTaskId = `github-issue-${issueNumber}`;
// For dedup check, use the base ID (check if ANY target already processed)
if (getTaskById(baseTaskId) || getTaskById(`${baseTaskId}-dc:${channelId}`)) {
  return; // Already processed
}

// For task creation, suffix with target JID
for (const target of targets) {
  const taskId = targets.length === 1 ? baseTaskId : `${baseTaskId}-${target.jid}`;
  createTask({ id: taskId, chat_jid: target.jid, ... });
}
```

### Pattern 5: Progress Tracker Routing
**What:** Progress tracker is already JID-agnostic; routing happens at the call site in index.ts
**When to use:** When initializing progress tracking for a webhook-triggered task

The `ProgressTracker` class receives `chatJid` via `onMessageSent(chatJid, groupFolder)`. The routing decision must happen at the call site in `index.ts` where the tracker is invoked, not inside the tracker itself. For ROUT-04, the progress tracker needs to be started for each target JID separately when a task runs.

### Anti-Patterns to Avoid
- **Creating a message router inside webhook handlers:** Put routing logic in ONE module (`webhook-router.ts`), not duplicated in each handler
- **Modifying progress-tracker.ts for routing:** The tracker is already JID-agnostic; routing belongs in the caller
- **Using platform names as JIDs:** Always use actual JID format (`dc:123456`, `tg:-100123`), never "discord" or "telegram"
- **Blocking delivery on one target's failure:** D-07 requires best-effort; wrap each target in its own try/catch
- **Caching the config:** D-02 says read fresh every invocation (webhooks are infrequent)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config validation | Manual JSON field checking | Zod schema validation | Matches Phase 5 pattern, type-safe, descriptive errors |
| Config file reading | Custom file watcher or caching | `readFileSync` per invocation | D-02: webhooks infrequent, simplest approach |
| Platform routing | Channel-specific routing logic | JID-based routing via `resolveTargets()` | JIDs already encode platform (dc: vs tg:) |
| Error isolation | Global try/catch | Per-target try/catch in loop | D-07/D-08: best-effort per target |

## Common Pitfalls

### Pitfall 1: Task ID Collisions in Dual-Send
**What goes wrong:** Two tasks for the same webhook event with the same ID causes SQLite UNIQUE constraint violation
**Why it happens:** Original handlers use `github-issue-${issueNumber}` as taskId; dual-send creates two tasks
**How to avoid:** Suffix task ID with target JID when multiple targets exist
**Warning signs:** "UNIQUE constraint failed" errors in logs when dual-send is enabled

### Pitfall 2: Duplicate Event Processing
**What goes wrong:** `getTaskById(taskId)` dedup check fails to catch dual-send tasks
**Why it happens:** The dedup check uses the base task ID, but dual-send tasks have suffixed IDs
**How to avoid:** Check for the base task ID existence before creating any targets. Use a consistent dedup strategy: check base ID first, then create suffixed tasks.
**Warning signs:** Same notification appearing twice on each platform

### Pitfall 3: Progress Tracker Multi-Target Complexity
**What goes wrong:** Progress tracker tries to edit messages on multiple platforms simultaneously, causing race conditions
**Why it happens:** Progress tracker uses `chatJid` as the map key and tracks one progress message per JID
**How to avoid:** For progress tracker, routing is simpler: the task itself runs in ONE group context, but the progress indicator can be shown on multiple JIDs. Since `ProgressTracker.onMessageSent()` is called per chatJid, call it once per target JID. The tracker already handles per-JID state.
**Warning signs:** Progress messages appearing on only one platform in dual-send mode

### Pitfall 4: Unregistered Discord Channel JIDs
**What goes wrong:** `routing.json` references a Discord channel JID that isn't registered as a NanoClaw group
**Why it happens:** Discord channels from Phase 5 bootstrap exist on the server but may not be registered as groups (Phase 4 auto-registers only channels the bot interacts with)
**How to avoid:** `resolveTargets()` checks that each target JID exists in `registeredGroups` and warns if not. Fallback to mainJid when no targets resolve.
**Warning signs:** "target JID not registered, skipping" warnings in logs

### Pitfall 5: Config File Missing on Fresh Install
**What goes wrong:** NanoClaw crashes or webhook delivery stops because `config/routing.json` doesn't exist
**Why it happens:** New installation hasn't created the routing config yet
**How to avoid:** D-12 mandates fallback to mainJid when config is missing. `resolveTargets()` returns mainJid fallback gracefully.
**Warning signs:** All webhooks routing to Telegram only despite Discord being connected

## Code Examples

### Example routing.json Config
```json
{
  "github-issues": {
    "targets": [
      { "platform": "telegram", "jid": "tg:-1001234567890" },
      { "platform": "discord", "jid": "dc:1234567890123456" }
    ]
  },
  "github-ci": {
    "targets": [
      { "platform": "discord", "jid": "dc:1234567890123457" }
    ]
  },
  "notion": {
    "targets": [
      { "platform": "telegram", "jid": "tg:-1001234567890" },
      { "platform": "discord", "jid": "dc:1234567890123458" }
    ]
  },
  "progress": {
    "targets": [
      { "platform": "discord", "jid": "dc:1234567890123459" }
    ]
  },
  "bugreport": {
    "targets": [
      { "platform": "discord", "jid": "dc:1234567890123456" }
    ]
  }
}
```

### Webhook Handler Modification Pattern (github-webhook.ts workflow_run)
```typescript
// In handleWorkflowRunEvent():
const groups = config.getRegisteredGroups();
const targets = resolveTargets('github-ci', groups);
if (targets.length === 0) {
  logger.warn('GitHub webhook: no routing targets, cannot dispatch task');
  return;
}

const baseTaskId = `github-ci-${runId}`;
if (getTaskById(baseTaskId)) {
  logger.debug({ taskId: baseTaskId }, 'GitHub webhook: duplicate event, skipping');
  return;
}

const now = new Date().toISOString();
const prompt = buildCIPrompt({ ... });

for (const target of targets) {
  const taskId = targets.length === 1 ? baseTaskId : `${baseTaskId}@${target.jid}`;
  try {
    createTask({
      id: taskId,
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
    logger.info({ taskId, jid: target.jid }, 'Webhook task created for target');
  } catch (err) {
    logger.error({ err, taskId, jid: target.jid }, 'Failed to create webhook task for target');
  }
}
```

### Notion Handler Modification
```typescript
// In handleCommentCreated():
const groups = config.getRegisteredGroups();
const targets = resolveTargets('notion', groups);
if (targets.length === 0) {
  logger.warn('Notion webhook: no routing targets');
  return;
}

// Dedup using base ID
const baseTaskId = `notion-comment-${commentId}`;
if (getTaskById(baseTaskId)) {
  logger.debug({ taskId: baseTaskId }, 'Notion webhook: duplicate event, skipping');
  return;
}

const now = new Date().toISOString();
const prompt = buildAgentPrompt(pageId, commentId);

for (const target of targets) {
  const taskId = targets.length === 1 ? baseTaskId : `${baseTaskId}@${target.jid}`;
  try {
    createTask({
      id: taskId,
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
  } catch (err) {
    logger.error({ err, taskId, jid: target.jid }, 'Notion routing: failed to create task');
  }
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (no test framework detected in project) |
| Config file | none |
| Quick run command | `npm run build` |
| Full suite command | `npm run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUT-01 | resolveTargets returns correct targets from config | smoke | Manual: create routing.json, verify logs | N/A |
| ROUT-02 | GitHub Issues routes to Discord #bugs | smoke | Trigger test issue, check Discord channel | N/A |
| ROUT-03 | Notion routes to Discord #yw-tasks | smoke | Trigger Notion comment, check Discord channel | N/A |
| ROUT-04 | Progress tracker shows in Discord #progress | smoke | Trigger agent task, check progress in Discord | N/A |
| ROUT-05 | Per-webhook config works | unit-like | Load different routing.json configs, verify resolveTargets output | N/A |
| ROUT-06 | Dual-send delivers to both platforms | smoke | Configure both targets, trigger webhook, verify both receive | N/A |

### Sampling Rate
- **Per task commit:** `npm run build` (TypeScript compilation)
- **Per wave merge:** Build + manual smoke test with test webhook
- **Phase gate:** All webhook types verified with dual-send enabled

### Wave 0 Gaps
None -- no test framework in project. Validation is build success + manual smoke testing.

## Handlers Inventory

| Handler File | Current Routing | webhookType Key | Target Discord Channel |
|-------------|----------------|-----------------|----------------------|
| `github-issues-webhook.ts` | `mainEntry` lookup (line 44) | `github-issues` | `#bugs` |
| `github-webhook.ts` (workflow_run) | `mainEntry` lookup (line 134) | `github-ci` | `#dev-alerts` |
| `notion-webhook.ts` | `mainEntry` lookup (line 139) | `notion` | `#yw-tasks` |
| `progress-tracker.ts` | JID passed via `onMessageSent(chatJid)` | `progress` | `#progress` |
| `bugreport-webhook.ts` | No chat routing (creates GitHub issue only) | `bugreport` | Optional: `#bugs` |

## Design Decisions (Claude's Discretion)

### resolveTargets Location: New File
**Recommendation:** Create `src/webhook-router.ts` as a new module.
**Rationale:** `src/router.ts` handles message formatting and outbound delivery -- a different concern. Webhook routing is a separate concern (config-driven target resolution). Keeping them separate follows single-responsibility and avoids bloating router.ts.

### resolveTargets Return Type: `{ jid, group }` Objects
**Recommendation:** Return `RouteTarget[]` with both JID and RegisteredGroup.
**Rationale:** Handlers need both: `jid` for `chat_jid` field, `group.folder` for `group_folder` field in `createTask()`.

### Dual-Send Order: Sequential (for loop)
**Recommendation:** Sequential delivery via `for...of` loop.
**Rationale:** Task creation is synchronous (SQLite), so `Promise.all` adds no benefit. Sequential is simpler and easier to debug. Error in one target doesn't affect the next (each wrapped in try/catch).

### Task ID Separator: `@` character
**Recommendation:** Use `@` as separator between base task ID and target JID: `github-issue-42@dc:123456`.
**Rationale:** Visually distinct, not present in webhook IDs or JIDs, easily parseable in logs.

## Sources

### Primary (HIGH confidence)
- Source code analysis of all 5 webhook handler files
- Source code analysis of `src/types.ts` (RegisteredGroup, Channel interfaces)
- Source code analysis of `src/router.ts` (existing routing patterns)
- Source code analysis of `src/discord-server-manager.ts` (Zod config pattern)
- `config/discord-server.json` (existing config pattern, channel names)
- Phase 6 CONTEXT.md (12 locked decisions)

### Secondary (MEDIUM confidence)
- Zod v4 API (z.record, z.enum, z.object, z.array) -- standard usage patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all patterns exist in codebase
- Architecture: HIGH - direct code analysis of all files to modify, mechanical replacement pattern
- Pitfalls: HIGH - identified from code analysis (task ID uniqueness, dedup logic, unregistered JIDs)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- internal refactoring with no external dependencies)
