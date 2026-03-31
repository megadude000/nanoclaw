---
phase: 21-nightshift-reconciliation
plan: 02
subsystem: cortex
tags: [ipc, reconciliation, discord-embeds, nightshift]

requires:
  - phase: 21-nightshift-reconciliation-01
    provides: ReconciliationReport type, runReconciliation function
provides:
  - cortex_reconcile IPC handler wired in ipc.ts
  - buildReconciliationEmbed function in agent-status-embeds.ts
  - Night Shift planner prompt with Cortex maintenance fallback
affects: [nightshift-execution, cortex-maintenance, agents-channel]

tech-stack:
  added: []
  patterns: [dynamic-import-qdrant, ipc-handler-with-embed-post]

key-files:
  created: []
  modified:
    - src/ipc.ts
    - src/agent-status-embeds.ts
    - src/agent-status-embeds.test.ts
    - cortex/Areas/Projects/NightShift/NightShift.md

key-decisions:
  - "Dynamic import of QdrantClient in IPC handler for graceful degradation when Qdrant unavailable"
  - "No new cron entries -- cortex_reconcile integrates into existing Night Shift planning/execution cycle (per D-01/D-03)"

patterns-established:
  - "IPC-to-embed pattern: IPC handler runs host-side operation then posts result embed to #agents via sendToAgents"

requirements-completed: [NIGHT-01, NIGHT-02, NIGHT-03, NIGHT-04]

duration: 3min
completed: 2026-03-31
---

# Phase 21 Plan 02: IPC Wiring + Night Shift Prompt Summary

**cortex_reconcile IPC handler calls runReconciliation on host side and posts purple summary embed to #agents; Night Shift planner prompt updated with Cortex maintenance as fallback activity**

## What Was Built

### Task 1: buildReconciliationEmbed (TDD)
- Added `buildReconciliationEmbed` to `src/agent-status-embeds.ts`
- Purple embed (0x9b59b6) with "Cortex Reconciliation" title
- Description shows stale entries, new CROSS_LINKs, orphans, and duration
- Timestamp set from `report.runAt`, agent meta via `withAgentMeta` (Cortex/progress)
- 8 new unit tests covering all fields -- 60 total tests pass
- Commit: `56eb37b`

### Task 2: cortex_reconcile IPC handler + Night Shift prompt
- Added `cortex_reconcile` IPC handler in `src/ipc.ts` after `cortex_relate` handler
- Dynamic import of `@qdrant/js-client-rest` to avoid loading when Qdrant unavailable
- Handler calls `runReconciliation(cortexDir, graphPath, qdrant)` and posts embed to #agents
- Updated `cortex/Areas/Projects/NightShift/NightShift.md` with "Cortex Maintenance (Fallback Activity)" section
- Instructs agents to send `cortex_reconcile` IPC when idea pool is empty
- No new cron entries (per D-01/D-03)
- Commit: `fc23198`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] discord.js not installed in main project**
- **Found during:** Task 1 (RED phase)
- **Issue:** Tests import discord.js but it was not installed (feature skill dependency)
- **Fix:** Installed discord.js as dev dependency to enable test execution
- **Files modified:** package.json, package-lock.json (not committed -- pre-existing optional dep)

## Known Stubs

None -- all functions are fully wired with real implementations.

## Verification

- `npx vitest run src/agent-status-embeds.test.ts` -- 60 tests pass
- `npx tsc --noEmit` -- no errors in modified files (pre-existing errors from optional skill deps only)
- `grep cortex_reconcile src/ipc.ts` -- handler present
- `grep "Cortex Maintenance" cortex/Areas/Projects/NightShift/NightShift.md` -- section present
