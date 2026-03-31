---
phase: 23-lore-mining-production-wiring
plan: 01
subsystem: cortex
tags: [lore-mining, reconciler, night-shift, openai, qdrant, tdd, vitest]

requires:
  - phase: 20-lore-protocol
    provides: mineLoreFromHistory() and MiningSummary from lore-mining.ts
  - phase: 21-nightshift-reconciliation
    provides: runReconciliation() and cortex_reconcile IPC handler in ipc.ts
  - phase: 16-embedding-pipeline
    provides: createOpenAIClient() from embedder.ts

provides:
  - runReconciliation() calls mineLoreFromHistory() as Step 4 when openai+repoDir provided
  - ReconciliationOptions.openai and ReconciliationOptions.repoDir optional fields
  - ReconciliationReport.loreSummary?: MiningSummary field
  - cortex_reconcile IPC handler passes { openai, repoDir } into runReconciliation
  - Graceful failure path for both OpenAI client creation and lore mining errors

affects: [night-shift, cortex-reconciliation, lore-mining, ipc-handler]

tech-stack:
  added: []
  patterns:
    - "Optional DI injection: openai? in ReconciliationOptions preserves backward compat while enabling new capability"
    - "Graceful degradation: two-level catch (client creation + mining) ensures reconciliation never fails due to lore mining"

key-files:
  created: []
  modified:
    - src/cortex/reconciler.ts
    - src/cortex/reconciler.test.ts
    - src/ipc.ts

key-decisions:
  - "openai optional in ReconciliationOptions — backward compat preserved, existing tests unchanged"
  - "createOpenAIClient() failure in IPC handler is caught — lore mining skips gracefully, reconciliation always continues"
  - "loreSummary always included in report object (undefined when mining not run) — type-safe access via optional chaining"

patterns-established:
  - "Step 4 in runReconciliation: optional capability gated on openai+repoDir — same graceful failure pattern as Qdrant Step 2"

requirements-completed: [LORE-02, LORE-03]

duration: 2min
completed: 2026-03-31
---

# Phase 23 Plan 01: Wire Lore Mining into Reconciler Production Cycle Summary

**mineLoreFromHistory() wired as Step 4 in runReconciliation() — git commit trailers (Constraint/Rejected/Directive) now mined into Cortex on every Night Shift cycle**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T12:07:11Z
- **Completed:** 2026-03-31T12:09:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended `runReconciliation()` with Step 4 lore mining, gated on `options.openai` and `options.repoDir`
- Added `loreSummary?: MiningSummary` to `ReconciliationReport` — lore stats available on every reconciliation report
- Wired `createOpenAIClient()` into `cortex_reconcile` IPC handler with graceful failure path
- 4 new TDD tests covering happy path, missing openai, mining failure, and backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend reconciler interfaces and add lore mining step** - `02529cf` (feat/test TDD)
2. **Task 2: Wire OpenAI client into cortex_reconcile IPC handler** - `763f172` (feat)

## Files Created/Modified
- `src/cortex/reconciler.ts` - Added OpenAI/lore-mining imports, extended ReconciliationOptions+Report, added Step 4 lore mining block
- `src/cortex/reconciler.test.ts` - Added vi.mock for lore-mining.js, 4 new tests in new describe block
- `src/ipc.ts` - Added createOpenAIClient import, try/catch OpenAI client creation, forward { openai, repoDir } to runReconciliation, lore stat in completion logger

## Decisions Made
- `openai` is optional in `ReconciliationOptions` — no breaking change to existing callers; all 17 pre-existing tests continue passing
- Double-catch pattern in IPC handler: outer catch for `createOpenAIClient()` failure (no API key), inner catch inside reconciler for mining failure (git errors) — both safe
- `loreSummary` set to `undefined` (not omitted) when mining skips — consistent field presence in ReconciliationReport for callers

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript build errors in `whatsapp.ts` and `task-scheduler.ts` (out of scope — not caused by our changes). Build errors in our target files: zero.
- Pre-existing test failures in `container-runner.test.ts`, `remote-control.test.ts`, `discord.test.ts` (out of scope — unrelated to lore mining). All 21 reconciler tests pass.

## User Setup Required
None — no external service configuration required. OPENAI_API_KEY is read from `.env` via `createOpenAIClient()` (already managed by OneCLI).

## Next Phase Readiness
- LORE-02 and LORE-03 are now closed — lore mining has a production call site
- Every Night Shift `cortex_reconcile` cycle will mine git commit trailers into Cortex vault automatically
- Lore atoms written by `writeLoreAtom()` will be picked up by the cortex watcher and embedded into Qdrant on next reconciliation cycle

---
*Phase: 23-lore-mining-production-wiring*
*Completed: 2026-03-31*

## Self-Check: PASSED
