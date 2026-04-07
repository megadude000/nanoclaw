---
cortex_level: L20
confidence: high
domain: nightshift
scope: automation-system
tags:
  - kairos
  - autodream
  - observation-log
  - proactive-agent
  - silent-tasks
created: 2026-04-02T00:00:00.000Z
updated: 2026-04-02T17:10:00.000Z
status: live — all three features active, silent flag implemented
---

# KAIROS-inspired Features — NanoClaw Implementation

## Context

Inspired by patterns revealed in the Claude Code source leak (2026-03-31). Implemented from scratch — no leaked code used. Three features added to complement the existing night shift architecture.

## Feature 1: KAIROS-lite — Proactive Tick Pulse

**Cron:** `*/30 9-20 * * *` (every 30 min during the day)
**Task ID:** `task-1775141607741-l5q0h6`
**Silent:** `true`

Script-gate checks GitHub for **new bug issues created in last 24h**. If found → agent wakes and handles them proactively. If none → `wakeAgent: false`, zero API cost. Fully silent — no typing indicator, no "Done in Xs" messages.

## Feature 2: autoDream — Idle Cortex Consolidation

**Cron:** `0 */2 10-18 * * *` (every 2h between 10:00–18:00)
**Task ID:** `task-1775141595490-76ng8n`
**Silent:** `true`

Script-gate checks last message timestamp in DB. If user has been idle > 90 min → agent wakes and runs lightweight Cortex sync. Silent — no user notification.

## Feature 3: Observation Log

**Format:** `/workspace/group/observations/YYYY-MM-DD.md`

All agents (night shift execution v9+) append raw one-liners throughout their work. autoDream distills these into Cortex during the next idle window.

## `silent` Flag — Implementation

Added `silent?: boolean` to the nanoclaw task system (2026-04-02):

**Files changed:**
- `src/types.ts` — added `silent?: boolean | null` to `ScheduledTask`
- `src/db.ts` — DB migration (adds `silent INTEGER DEFAULT 0` column) + INSERT + updateTask
- `src/task-scheduler.ts` — skips `progressTracker.onMessageSent/onResponseReceived/onContainerStopped` when `task.silent === true`
- `src/ipc.ts` — passes `silent` through IPC data type
- `container/agent-runner/src/ipc-mcp-stdio.ts` — exposes `silent` param in `schedule_task` and `update_task` MCP tools

**Usage:** `mcp__nanoclaw__schedule_task({ ..., silent: true })` — suppresses all progress messages (⏳ typing, ✅ Done in Xs). Perfect for background maintenance tasks.

## Architecture

```
Day: KAIROS-lite (*/30, silent)  → script-gate → act on new bugs
Day: autoDream (*/2h, silent)    → idle check  → Cortex consolidation
Night: execution cron            → write observations → Cortex sync at wrap-up
Weekly: cleanup cron (silent)    → purge old completed tasks from DB
Daily: Gemini check (script-gate) → alert only if key broken
```

## Decision Log

- `2026-04-02` — KAIROS-lite gates on *new* issues only (24h window) to avoid re-triggering on stale open issues
- `2026-04-02` — autoDream idle threshold: 90 min to avoid triggering during lunch breaks
- `2026-04-02` — Observation log is append-only raw signal; distillation happens async via autoDream
- `2026-04-02` — `silent` flag added to suppress ProgressTracker for background tasks; both builds pass (host + agent-runner)
