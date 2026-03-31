---
phase: 21-nightshift-reconciliation
plan: 01
subsystem: cortex
tags: [reconciler, staleness, cross-link, orphan-detection, qdrant, knowledge-graph]

requires:
  - phase: 19-knowledge-graph
    provides: cortex-graph.ts with addEdge/saveGraph/buildIndex/getNeighbors
  - phase: 16-embedding-pipeline
    provides: Qdrant embedding pipeline and cortex-entries collection
provides:
  - checkStaleness function for TTL-based staleness detection
  - discoverCrossLinks function for semantic cross-linking via Qdrant
  - findOrphans function for unconnected low-quality entry detection
  - runReconciliation orchestrator returning typed ReconciliationReport
affects: [21-02-nightshift-reconciliation, task-scheduler]

tech-stack:
  added: []
  patterns: [DI pattern (deps as params), globSync for sync file enumeration, graceful Qdrant failure handling]

key-files:
  created: [src/cortex/reconciler.ts, src/cortex/reconciler.test.ts]
  modified: []

key-decisions:
  - "globSync from node:fs for synchronous cortex directory scanning -- simpler than async glob for scan-only operations"
  - "Orphan detection requires ALL 3 conditions (no edges + bad frontmatter + short content) to avoid false positives"
  - "Graceful Qdrant failure: runReconciliation returns partial report with empty newLinks on connection error"
  - "MAX_LINKS_PER_ENTRY=3 cap prevents graph explosion from high-similarity clusters"

patterns-established:
  - "Reconciler DI pattern: pure functions with deps as params, same as lore-mining.ts"
  - "Three-condition orphan gate: no edges AND invalid frontmatter AND short content"

requirements-completed: [NIGHT-02, NIGHT-03, NIGHT-04]

duration: 3min
completed: 2026-03-31
---

# Phase 21 Plan 01: Cortex Reconciler Summary

**Pure function reconciler with staleness TTL checks, Qdrant-based cross-link discovery (0.85 cosine threshold), and three-condition orphan detection -- all orchestrated by runReconciliation with graceful Qdrant failure handling.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T10:31:50Z
- **Completed:** 2026-03-31T10:35:00Z
- **Tasks:** 1/1
- **Files created:** 2

## Accomplishments

### Task 1: Reconciler module + test scaffold (TDD)

Created `src/cortex/reconciler.ts` with 4 exported functions following the lore-mining.ts DI pattern:

1. **checkStaleness** -- scans cortex directory, reads frontmatter `updated`/`last_updated`/`created` dates (never file mtime per Pitfall 2), compares against STALENESS_TTLS per cortex_level. Entries without date fields flagged with Infinity.

2. **discoverCrossLinks** -- scrolls all Qdrant points, searches each vector at 0.85 threshold, filters self-matches and existing CROSS_LINK edges via hasEdge, respects MAX_LINKS_PER_ENTRY=3 cap, saves graph only when new edges found.

3. **findOrphans** -- requires all 3 conditions: no graph edges (via getNeighbors), missing/invalid frontmatter, AND content < 50 chars. Entries with any edges or valid frontmatter are not flagged.

4. **runReconciliation** -- orchestrates all 3 steps, wraps discoverCrossLinks in try/catch for graceful Qdrant failure, returns typed ReconciliationReport with timing.

Created `src/cortex/reconciler.test.ts` with 17 unit tests covering all functions, edge cases, and the Qdrant unavailability path.

| Commit | Hash | Files |
|--------|------|-------|
| feat(21-01): add cortex reconciler | 8dc8a23 | src/cortex/reconciler.ts, src/cortex/reconciler.test.ts |

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all functions are fully implemented with real logic.

## Self-Check: PASSED
