---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  NanoClaw task scheduler - cron/interval/once tasks, script gate, routing_tag,
  health check reinstall
project: nanoclaw
tags:
  - nanoclaw
  - scheduler
  - cron
  - tasks
  - routing
  - script-gate
created: 2026-03-31T00:00:00.000Z
source_hash: 6c3e62f8dbf893be0dafa4c2051a52a6cb4eff0741f2bb817b3f881aec7e882c
embedding_model: text-embedding-3-small
---

# NanoClaw — Task Scheduler

## What the Scheduler Does

The task scheduler (`src/task-scheduler.ts`) runs scheduled agent tasks — the mechanism behind Night Shift crons, morning digests, health check reinstalls, and any other time-based automation. It polls the database every `SCHEDULER_POLL_INTERVAL` for tasks where `next_run <= now` and `status = 'pending'`.

Tasks run inside the same container infrastructure as regular message-triggered agents. The scheduler calls `runContainerAgent()` with the task's prompt and group context, so scheduled tasks have the same capabilities and isolation as interactive messages.

## Schedule Types

Three schedule types, stored in `schedule_type` + `schedule_value` columns:
- **`cron`**: standard cron expression (`schedule_value = "23 7 * * *"`). Next run computed via `CronExpressionParser.parse()` anchored to the configured timezone.
- **`interval`**: millisecond interval (`schedule_value = "3600000"` for 1 hour). Anchored to scheduled time (not `Date.now()`) to prevent cumulative drift.
- **`once`**: runs once, then `next_run = null`. Not re-queued.

For `interval` tasks, the next-run calculation skips past missed intervals so the next run always lands in the future (guards against a paused process creating a backlog of immediate runs on restart).

## Script Gate: `wakeAgent: true/false`

Tasks can have an optional `script` field. If present, the script is executed inside the container before the main prompt. The key use case: API credit conservation.

The script gate pattern:
```javascript
// task.script contains a check script
// If script output contains "SKIP", task is skipped without running the full prompt
// If script output contains "RUN", the main prompt executes
```

Night Shift uses the script gate for the planning cron at 21:03: if the shift plan already exists or the idea pool is empty, the script gate prevents the full LLM prompt from running, saving API credits. The `wakeAgent: true` flag in the task config bypasses the gate and always runs the prompt.

## routing_tag — Multi-Target Dispatch

Tasks can specify a `routing_tag` field. If present, `resolveTargets(routing_tag, groups)` maps the tag to one or more registered group JIDs (configured in `config/routing.json`). Task output is then sent to all resolved targets instead of (or in addition to) the task's `chat_jid`.

This is how morning digests route to the right channel: the digest task has `routing_tag: "morning-digest"`, and the routing config maps that tag to the appropriate Telegram/Discord JID. Changing which channel gets digests is a config change, not a code change.

## Auto-Expire + Health Check Reinstall Pattern

Cron tasks are deliberately set to auto-expire after 3 days (controlled by the task's `expires_at` field). The health monitor cron at 12:00 daily checks for expired crons and reinstalls them. Why:
- Auto-expiry prevents zombie crons from accumulating if NanoClaw is reconfigured
- The health check reinstall ensures crons are always active without requiring manual management
- If NanoClaw is down for more than 3 days, crons reinstall automatically on next health check run

## Context Modes

Tasks support two context modes (`context_mode`):
- **`isolated`** (default): task runs with a fresh session, no conversation history
- **`group`**: task runs with the group's current session ID, giving the agent access to recent conversation context

Night Shift execution tasks use `group` context so the agent can reference the current shift plan stored in the group's session history.

## Task Lifecycle States

`status` field values: `pending` → `running` → (`completed` | `failed` | `paused`). Paused tasks are excluded from the scheduler poll. Tasks are paused automatically if their `group_folder` is invalid (guard against malformed legacy rows causing retry loops).
