---
cortex_level: L20
confidence: high
domain: system
scope: nanoclaw
tags:
  - nanoclaw
  - background-tasks
  - silent
  - kairos
  - autodream
  - decisions
updated: 2026-04-02T00:00:00.000Z
source_hash: 51bc460981fb30d4bf3006a4e872fc7a44985ad0b52585b09617e98b14af4d31
embedding_model: text-embedding-3-small
---

# Silent Flag for Background Tasks

## Decision
Background tasks (KAIROS-lite, autoDream) must have `silent: true` set in the DB so ProgressTracker skips the ⏳ typing indicator and ✅ Done messages. These were leaking into Telegram as noise.

## Implementation (2026-04-02)
- `types.ts` — added `silent?: boolean | null` to `ScheduledTask`
- `db.ts` — added `silent INTEGER DEFAULT 0` column + migration + INSERT/UPDATE handlers
- `task-scheduler.ts` — three `if (!task.silent)` guards around all ProgressTracker calls
- `ipc.ts` — `update_task` and `schedule_task` handlers accept `silent`; type cast `(data.silent as unknown) === 'true'` to handle string from agent-runner
- `agent-runner/ipc-mcp-stdio.ts` — `silent: z.boolean().optional()` added to both tool schemas

## Key Bug Fixed
Agent-runner sends `String(args.silent)` = `"true"` (string), not boolean. Host was comparing `=== true` strictly → always false → silent never set. Fixed with `(x === true || (x as unknown) === 'true')`.

## Discord Mini-Review
Both KAIROS-lite and autoDream now send a status summary to `#agents` (dc:1486971999543889972) after each run:
- `🤖 KAIROS pulse ✅ — all clear` or `⚡ — [what was done]`
- `🧠 autoDream ✅ — checked N, updated M` or `⚡ — [what was patched]`
- Only escalate to main user (tg:633706070) for critical/blocking issues

## IPC File Format
To set silent on an existing task via raw IPC file:
```json
{ "type": "update_task", "taskId": "<task-id>", "silent": true }
```
Note: field is `taskId` (camelCase), not `task_id`.
