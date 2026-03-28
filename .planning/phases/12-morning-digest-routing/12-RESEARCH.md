# Phase 12: Morning Digest Routing - Research

**Researched:** 2026-03-28
**Domain:** Task scheduler routing, SQLite schema migration, routing.json config
**Confidence:** HIGH

## Summary

Phase 12 is a surgical routing change: the morning digest scheduled task must be redirected from the Telegram main chat to Discord #agents. The existing `config/routing.json` + `resolveTargets()` infrastructure already supports this pattern — it is used by github-issues, github-ci, notion, and bugreport webhooks today. The work extends that pattern to scheduled tasks by adding a `routing_tag` nullable column to `scheduled_tasks`, checking it in `task-scheduler.ts` after task completion, and adding a `"morning-digest"` entry to `config/routing.json`.

The codebase is well-understood. No new libraries are needed. Three files need code changes (db.ts, types.ts, task-scheduler.ts), one config file needs a new entry (config/routing.json), and the morning digest task row in SQLite needs its `routing_tag` set. There is no ambiguity in the approach — the CONTEXT.md decision is final: use `routing_tag` + `routing.json`, suppress Telegram when routed.

**Primary recommendation:** Implement host-side routing via `routing_tag` column. Add migration guard in `db.ts`, extend `ScheduledTask` type, check tag in `runTask()` to redirect output, update routing.json. Update the SQLite task row in a Wave 0 migration step.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add `routing_tag` column to scheduled_tasks table (nullable, defaults null)
- In task-scheduler, if `task.routing_tag` is set, resolve targets via webhook-router.ts
- Morning digest task gets `routing_tag: 'morning-digest'`
- config/routing.json gets `"morning-digest"` entry pointing to Discord #agents JID
- Telegram main chat no longer receives the digest output when routing_tag is set and targets found

### Claude's Discretion
- Whether to add the routing_tag column via migration or alter-table guard
- Whether to make Telegram suppression configurable or always suppress when routed

### Deferred Ideas (OUT OF SCOPE)
- Per-task routing config UI — defer to v2.1
- Multiple routing targets (both Telegram AND Discord) for digests — defer to v2.1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIGEST-01 | Morning Digest routes to #agents channel instead of Telegram main | routing_tag in ScheduledTask → resolveTargets() → sendMessage to Discord JID |
| DIGEST-02 | Morning Digest removed from Telegram main routing | Suppress deps.sendMessage(task.chat_jid) when routing_tag resolves to non-empty targets |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 11.10.0 | SQLite schema migration | Already in project; ALTER TABLE pattern established in db.ts |
| webhook-router.ts | (internal) | resolveTargets() function | Already handles routing.json parsing, JID resolution, fallback to main |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | RoutingConfigSchema validation | Already used in webhook-router.ts — no changes needed |
| vitest | (project) | Unit tests | Existing test infrastructure for db.ts and task-scheduler.ts |

### No Additional Libraries Needed
All required infrastructure exists in the project.

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure
No new files required. Changes are in:
```
src/
├── db.ts              # Add routing_tag column migration
├── types.ts           # Add routing_tag? to ScheduledTask
└── task-scheduler.ts  # Check routing_tag in runTask(), redirect output
config/
└── routing.json       # Add "morning-digest" entry
```

### Pattern 1: ALTER TABLE Migration Guard (established in db.ts)
**What:** Add nullable column with try/catch around ALTER TABLE. No-op if column already exists.
**When to use:** Every time a new column is added to an existing table in production.
**Example:**
```typescript
// Source: src/db.ts lines 87-108 (established pattern)
try {
  database.exec(
    `ALTER TABLE scheduled_tasks ADD COLUMN routing_tag TEXT`,
  );
} catch {
  /* column already exists */
}
```

### Pattern 2: resolveTargets() for routing
**What:** Call `resolveTargets(routingTag, registeredGroups)` to get `RouteTarget[]`. Returns empty array only when config is missing AND no fallback groups exist. Otherwise falls back to mainJid.
**Critical detail:** `resolveTargets()` falls back to main group when the routing_tag key is not in routing.json. For task routing, this fallback is wrong — if the tag is set but unresolved, we should NOT send to main. The plan must handle this: only redirect when the tag resolves to at least one target AND none of those targets is the original chat_jid.
**When to use:** Whenever routing.json-driven delivery is needed.

### Pattern 3: Suppression of Original chatJid
**What:** The current `runTask()` sends output via `deps.sendMessage(task.chat_jid, streamedOutput.result)` inside the streaming callback (line 211) and also after the container completes (line ~229). Both call sites must be guarded.
**Critical detail:** The streaming callback fires BEFORE the task finishes. The routing decision (check `task.routing_tag`) can be made upfront at the start of `runTask()`, stored in a local variable, and used consistently across both send sites.

**Example of the routing guard:**
```typescript
// Determine routing targets upfront
const routingTargets = task.routing_tag
  ? resolveTargets(task.routing_tag, groups).filter(
      (t) => t.jid !== task.chat_jid, // exclude original if it appears
    )
  : [];
const isRouted = routingTargets.length > 0;

// In streaming callback:
if (streamedOutput.result) {
  result = streamedOutput.result;
  if (isRouted) {
    for (const t of routingTargets) {
      await deps.sendMessage(t.jid, streamedOutput.result);
    }
  } else {
    await deps.sendMessage(task.chat_jid, streamedOutput.result);
  }
  scheduleClose();
}
```

### Pattern 4: ScheduledTask Type Extension
**What:** Add `routing_tag?: string | null` to the `ScheduledTask` interface in `types.ts`.
**Why nullable:** SQLite column is TEXT (nullable). `better-sqlite3` returns `null` for NULL values. TypeScript should accept both `null` and `undefined`.

### Pattern 5: Updating the Morning Digest Task Row
**What:** The existing morning digest task row in SQLite needs `routing_tag = 'morning-digest'` set.
**How:** The plan should include an `updateTask()` call (or direct SQL UPDATE) run once at startup, or instruct the user. The `updateTask()` function in db.ts does NOT currently support updating `routing_tag` — it will need to be extended OR a separate db function added.
**Decision for planner:** Extend `updateTask()` to accept `routing_tag` OR add a dedicated `setTaskRoutingTag(id, tag)` helper. Either fits the pattern; the latter is simpler and avoids touching the multi-field update function.

### Anti-Patterns to Avoid
- **Do not use prompt engineering** to route the digest. The CONTEXT.md decision is explicit: use `routing_tag` column + host-side routing. Prompt-based routing is fragile.
- **Do not cache routing.json** in task-scheduler. `resolveTargets()` reads fresh on each call by design (webhooks are infrequent; scheduled tasks fire at most once a day for digest).
- **Do not suppress the Telegram message before checking that targets were resolved.** If `resolveTargets()` returns only the mainFallback (same as `task.chat_jid`), the output should still go to Telegram.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Routing config parsing | Custom JSON parser | `resolveTargets()` in webhook-router.ts | Already validated with Zod, handles missing file, falls back gracefully |
| SQLite migration | Dropping/recreating tables | ALTER TABLE try/catch guard | Established pattern; safe for production installs with existing data |
| JID resolution | Hardcoded channel IDs | routing.json entry | Config-driven, no code change needed to re-route later |

**Key insight:** The routing infrastructure was built in Phase 6 specifically for this kind of extension. Using it here keeps all routing logic in one place.

## Runtime State Inventory

> Included because this phase involves updating a live SQLite record.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `scheduled_tasks` table: morning digest row needs `routing_tag = 'morning-digest'` set on the existing record | data migration — SQL UPDATE on the task row; not auto-applied by ALTER TABLE |
| Live service config | routing.json on disk — updated as a code/config edit | code edit — add "morning-digest" entry |
| OS-registered state | None — nanoclaw runs as systemd user service, no task scheduler entries | None |
| Secrets/env vars | `DISCORD_AGENTS_CHANNEL_ID` already in .env (used by Phase 10) — no new env var needed | None |
| Build artifacts | None — TypeScript compile required after db.ts/types.ts/task-scheduler.ts changes | `npm run build` |

**Stored data note:** The morning digest task was created before Phase 12. Its `routing_tag` column will be NULL after the ALTER TABLE migration runs. The plan MUST include an explicit step to UPDATE the task row. The task ID is not known at planning time — the plan should use a SQL UPDATE by prompt pattern match or provide user instructions.

## Common Pitfalls

### Pitfall 1: resolveTargets() Fallback Hides Misconfiguration
**What goes wrong:** If `"morning-digest"` is missing from routing.json, `resolveTargets()` returns the mainJid fallback (Telegram). The digest silently goes back to Telegram. No error is logged visibly.
**Why it happens:** The fallback behavior is intentional for webhook handlers but wrong for task routing.
**How to avoid:** In `runTask()`, after calling `resolveTargets()`, check whether the returned JIDs differ from `task.chat_jid`. Log a warning if `task.routing_tag` is set but all resolved targets match `task.chat_jid` (indicating fallback was used).
**Warning signs:** Digest still appears in Telegram after the change.

### Pitfall 2: updateTask() Does Not Support routing_tag
**What goes wrong:** The `updateTask()` function in db.ts accepts a specific set of fields (prompt, script, schedule_type, schedule_value, next_run, status, model). It does not accept `routing_tag`. Passing it would be silently ignored.
**Why it happens:** The field was not present when `updateTask()` was written.
**How to avoid:** Either extend `updateTask()` to include `routing_tag` in its `Partial<Pick<ScheduledTask, ...>>` signature, or add `setTaskRoutingTag(id: string, tag: string | null)` as a dedicated db function.

### Pitfall 3: Two Send Sites in runTask()
**What goes wrong:** Output can be sent in two places: (1) the streaming callback at line 211, and (2) after `runContainerAgent()` returns at line ~229. If only one is guarded, the digest may still reach Telegram.
**Why it happens:** The streaming callback handles real-time output; the post-run block handles the final result. Both may fire.
**How to avoid:** Resolve routing once at the top of `runTask()` and use the `isRouted` flag in both send sites.

### Pitfall 4: Morning Digest Task Row Not Updated
**What goes wrong:** The ALTER TABLE guard adds the `routing_tag` column with NULL default. Existing task rows keep NULL. The routing never activates.
**Why it happens:** Schema migration adds the column; it does not backfill existing rows.
**How to avoid:** The plan must include an explicit step to UPDATE the morning digest task row with `routing_tag = 'morning-digest'`. This can be a startup migration in `createSchema()` that runs UPDATE WHERE prompt LIKE '%morning%digest%' AND routing_tag IS NULL, or a user instruction.

## Code Examples

### Existing sendMessage call in runTask() streaming callback (lines 207-213)
```typescript
// Source: src/task-scheduler.ts line 207-213
async (streamedOutput: ContainerOutput) => {
  if (streamedOutput.result) {
    result = streamedOutput.result;
    // Forward result to user (sendMessage handles formatting)
    await deps.sendMessage(task.chat_jid, streamedOutput.result);
    scheduleClose();
  }
```

### resolveTargets() signature (webhook-router.ts)
```typescript
// Source: src/webhook-router.ts line 63-66
export function resolveTargets(
  webhookType: string,
  groups: Record<string, RegisteredGroup>,
): RouteTarget[] {
```

### Existing routing.json entry format (config/routing.json)
```json
{
  "morning-digest": {
    "targets": [
      { "platform": "discord", "jid": "dc:CHANNEL_ID_HERE", "enabled": true }
    ]
  }
}
```
The Discord #agents channel JID is constructed as `dc:${DISCORD_AGENTS_CHANNEL_ID}`. The value of `DISCORD_AGENTS_CHANNEL_ID` is already in `.env` (wired in Phase 10). The planner should use `dc:${agentsChannelId}` format with the actual value from the env.

### updateTask() current signature (must be extended)
```typescript
// Source: src/db.ts line 429-443
export function updateTask(
  id: string,
  updates: Partial<
    Pick<
      ScheduledTask,
      | 'prompt'
      | 'script'
      | 'schedule_type'
      | 'schedule_value'
      | 'next_run'
      | 'status'
      | 'model'
    >
  >,
): void {
```
`routing_tag` is absent — must add it or use a dedicated helper.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded mainJid in webhook handlers | routing.json + resolveTargets() | Phase 6 | All routing is config-driven |
| No scheduled task routing | routing_tag column + resolveTargets() call | Phase 12 (new) | Scheduled tasks can route to any channel |

## Open Questions

1. **What is the actual ID of the morning digest task in SQLite?**
   - What we know: Task was created at some point; its `group_folder` is the main group and its `prompt` contains "morning" or "digest".
   - What's unclear: Exact task ID (not in source code — it's a runtime SQLite value).
   - Recommendation: The backfill step should use `UPDATE scheduled_tasks SET routing_tag = 'morning-digest' WHERE prompt LIKE '%morning%' AND routing_tag IS NULL` rather than a hardcoded ID. This is safe — it only applies to tasks not yet tagged.

2. **What is the actual DISCORD_AGENTS_CHANNEL_ID value for the routing.json entry?**
   - What we know: It is in .env as `DISCORD_AGENTS_CHANNEL_ID`. The Phase 10 code reads it as `agentsChannelId`.
   - What's unclear: The numeric value at planning time (a Discord snowflake).
   - Recommendation: The routing.json entry should use the actual value from `.env`. The plan should read it with `readEnvFile(['DISCORD_AGENTS_CHANNEL_ID'])` or instruct the agent to substitute at execution time.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond existing project stack — Node.js, SQLite, TypeScript already confirmed operational)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-standard) |
| Config file | vitest.config.ts or package.json (project-level) |
| Quick run command | `npm test -- --reporter=verbose src/task-scheduler.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIGEST-01 | runTask() sends output to routing_tag targets when tag is set | unit | `npm test -- src/task-scheduler.test.ts` | Wave 0 — needs new test case |
| DIGEST-02 | runTask() does NOT send to task.chat_jid when routing targets resolve | unit | `npm test -- src/task-scheduler.test.ts` | Wave 0 — needs new test case |
| schema | routing_tag column added by createSchema() on fresh and existing DB | unit | `npm test -- src/db.test.ts` | Wave 0 — needs new test case |

### Sampling Rate
- **Per task commit:** `npm test -- src/task-scheduler.test.ts src/db.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test case in `src/task-scheduler.test.ts` — covers DIGEST-01: task with routing_tag routes to resolved target JID
- [ ] New test case in `src/task-scheduler.test.ts` — covers DIGEST-02: task.chat_jid NOT called when routing targets resolve
- [ ] New test case in `src/db.test.ts` — covers schema: routing_tag column exists after migration

## Sources

### Primary (HIGH confidence)
- Direct source code inspection: `src/task-scheduler.ts`, `src/db.ts`, `src/types.ts`, `src/webhook-router.ts`, `src/index.ts`, `src/env.ts`
- Direct config inspection: `config/routing.json`
- Direct test inspection: `src/task-scheduler.test.ts`, `src/db.test.ts`

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions (2026-03-28) — authoritative for implementation choices

### Tertiary (LOW confidence)
- None — all findings are from direct code inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from direct code reading, no external dependencies
- Architecture: HIGH — patterns copied from existing implementations in the same codebase
- Pitfalls: HIGH — identified from direct reading of the two send sites in runTask() and the updateTask() signature gap

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable codebase — only changes if task-scheduler.ts or db.ts are modified by another phase)
