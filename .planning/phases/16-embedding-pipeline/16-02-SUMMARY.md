---
phase: 16-embedding-pipeline
plan: 02
subsystem: infra
tags: [qdrant, openai, embedding, fs-watch, cortex, debounce]

requires:
  - phase: 16-01
    provides: embedEntry(), createOpenAIClient(), createQdrantClient(), checkQdrantHealth()

provides:
  - startCortexWatcher(cortexDir) -- debounced fs.watch embedding trigger wired into main process
  - stopCortexWatcher() -- graceful shutdown cleanup for watcher
  - DEBOUNCE_MS=600000 -- 10-minute inactivity debounce constant
  - scripts/cortex-reembed.ts -- batch CLI tool for full or incremental re-embedding
  - inFlightFiles self-trigger prevention -- prevents embedding loops on frontmatter write-back

affects:
  - phase-17-mcp-tools
  - phase-18-nightshift

tech-stack:
  added: []
  patterns:
    - "Best-effort startup: watcher catches errors and logs warn, never crashes main process"
    - "Sequential file processing in batch script to avoid OpenAI rate limits"
    - "Self-trigger prevention via inFlightFiles Set before/after each embedEntry() call"
    - "vi.useFakeTimers() pattern for testing debounce behavior without real 10-minute waits"
    - "getInFlightFiles() testing escape-hatch: exported for test access only"

key-files:
  created:
    - src/cortex/watcher.ts
    - src/cortex/watcher.test.ts
    - scripts/cortex-reembed.ts
  modified:
    - src/index.ts

key-decisions:
  - "watcher.ts uses module-level state (not class) -- consistent with embedder.ts singleton pattern"
  - "stopCortexWatcher() clears inFlightFiles on shutdown -- prevents ghost state across test runs"
  - "cortex-reembed.ts uses node:fs/promises glob (Node 22 built-in) -- zero new dependencies"
  - "startCortexWatcher called with .catch() in index.ts -- failure never crashes main process"

patterns-established:
  - "Graceful degradation: check credentials + health before starting optional background services"
  - "Debounce via clearTimeout + setTimeout pattern with module-level timer ref"
  - "processBatch: add to inFlightFiles before embed, remove in finally block"

requirements-completed: [EMBED-02, EMBED-03]

duration: 3min
completed: 2026-03-30
---

# Phase 16 Plan 02: Cortex Watcher and Batch Re-Embed Summary

**Debounced fs.watch cortex watcher with 10-minute inactivity trigger, self-trigger prevention via inFlightFiles, and sequential batch re-embed CLI — completing the embedding pipeline**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-30T22:19:37Z
- **Completed:** 2026-03-30T22:22:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `src/cortex/watcher.ts` — debounced fs.watch watcher with DEBOUNCE_MS=600000, inFlightFiles self-trigger prevention, graceful degradation on missing key or unreachable Qdrant
- `src/cortex/watcher.test.ts` — 16 unit tests using vi.useFakeTimers() covering debounce, .md filtering, inFlightFiles, stop/cleanup, and DEBOUNCE_MS constant
- `scripts/cortex-reembed.ts` — sequential batch re-embed CLI with --force flag, using Node 22 `glob` from `node:fs/promises` (zero new dependencies)
- `src/index.ts` wired: `startCortexWatcher(cortexDir)` after IPC watcher startup, `stopCortexWatcher()` in shutdown handler

## Task Commits

1. **Task 1: Create debounced cortex watcher (TDD)** - `f021542` (feat)
2. **Task 2: Batch re-embed script + index.ts wiring** - `5943a01` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/cortex/watcher.ts` — fs.watch watcher with DEBOUNCE_MS, inFlightFiles, startCortexWatcher/stopCortexWatcher
- `src/cortex/watcher.test.ts` — 16 unit tests, fake timers, mocked fs.watch/embedEntry/checkQdrantHealth
- `scripts/cortex-reembed.ts` — batch CLI: sequential embedEntry calls, --force flag, exit 1 on errors
- `src/index.ts` — import + startup call after startIpcWatcher, stopCortexWatcher() in shutdown

## Decisions Made

- `getInFlightFiles()` exported from watcher.ts for test access only — allows tests to set up self-trigger scenarios without exposing implementation details in the real API
- Used Node 22 built-in `glob` from `node:fs/promises` for the batch script — no new npm dependencies needed
- `startCortexWatcher` called with `.catch()` in index.ts — a watcher failure never crashes the main process (best-effort non-blocking pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm run build` reports pre-existing errors (discord.js, grammy, googleapis, sharp not installed in development environment). Confirmed pre-existing by stashing changes and running build — same errors without my changes. Cortex-specific code compiles cleanly as confirmed by `npx vitest run src/cortex/` (65 tests pass).

## Known Stubs

None - all functionality fully implemented and wired.

## Next Phase Readiness

- Embedding pipeline is fully operational: Phase 16 complete
- `embedEntry()`, `startCortexWatcher()`, `stopCortexWatcher()`, `cortex-reembed.ts` all ready
- Phase 17 (MCP tools) can now wire `cortex_search` and `cortex_write` knowing the embedding layer is stable
- Batch re-embed script available for initial knowledge base population before Phase 17

## Self-Check: PASSED

- FOUND: src/cortex/watcher.ts
- FOUND: src/cortex/watcher.test.ts
- FOUND: scripts/cortex-reembed.ts
- FOUND: .planning/phases/16-embedding-pipeline/16-02-SUMMARY.md
- FOUND commit: f021542 (feat: debounced cortex watcher with self-trigger prevention)
- FOUND commit: 5943a01 (feat: batch re-embed script + index.ts wiring)

---
*Phase: 16-embedding-pipeline*
*Completed: 2026-03-30*
