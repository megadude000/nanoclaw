---
phase: 17-search-mcp-tools
plan: 01
subsystem: testing
tags: [vitest, cortex, mcp-tools, qdrant, openai, tdd, red-state]

# Dependency graph
requires:
  - phase: 16-embedding-pipeline
    provides: embedder.ts patterns for vi.hoisted() + vi.mock() test pattern
  - phase: 14-cortex-schema-standard
    provides: CortexFieldsStrict field names (cortex_level, confidence, domain, scope)
  - phase: 15-qdrant-infrastructure
    provides: QdrantClient search/scroll API signatures

provides:
  - "Failing test scaffold (RED) for all 6 Phase 17 requirement IDs"
  - "Factory pattern contract: buildSearchHandler/buildReadHandler/buildWriteHandler"
  - "Pure helper contract: isVaultPath, checkConfidenceFirewall"
  - "27 test cases covering hybrid routing, confidence firewall, path traversal, filter params, IPC write"

affects: [17-search-mcp-tools-plan-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() + vi.mock() for QdrantClient, OpenAI, node:fs — same pattern as embedder.test.ts"
    - "Factory pattern: build*Handler({ qdrant, openai, vaultRoot }) returns async (args) => result"
    - "Dependency injection for qdrant/openai/writeIpc in handlers enables unit testing without live services"

key-files:
  created:
    - src/cortex/cortex-mcp-tools.test.ts
  modified: []

key-decisions:
  - "Factory pattern for handlers: buildSearchHandler/buildReadHandler/buildWriteHandler take deps as constructor args — enables DI without full module mock"
  - "writeIpc passed as explicit argument to buildWriteHandler — allows mock verification of IPC call"
  - "checkConfidenceFirewall signature takes qdrant as param (same DI pattern as embedder.ts)"

patterns-established:
  - "Pattern: handlers built via factory functions accepting { qdrant, openai, vaultRoot } deps for full testability"
  - "Pattern: checkConfidenceFirewall returns boolean — true = blocked, false = allowed"

requirements-completed:
  - SEARCH-01
  - SEARCH-02
  - SEARCH-03
  - MCP-01
  - MCP-02
  - MCP-03

# Metrics
duration: 1min
completed: 2026-03-30
---

# Phase 17 Plan 01: Search & MCP Tools — Test Scaffold Summary

**27 failing tests in RED state: vi.hoisted/vi.mock scaffold for cortex_search hybrid routing, cortex_read path traversal guard, cortex_write confidence firewall, and filter param builder**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-30T20:46:36Z
- **Completed:** 2026-03-30T20:48:01Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `src/cortex/cortex-mcp-tools.test.ts` with 27 failing tests in RED state
- All 6 requirement IDs covered: SEARCH-01, SEARCH-02, SEARCH-03, MCP-01, MCP-02, MCP-03
- Factory pattern (buildSearchHandler/buildReadHandler/buildWriteHandler) established as the test contract
- Pure helper tests for `isVaultPath` and `checkConfidenceFirewall` included

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing test scaffold for all 6 requirement IDs** - `74d3b86` (test)

**Plan metadata:** TBD (docs: complete plan — added after this summary)

## Files Created/Modified

- `src/cortex/cortex-mcp-tools.test.ts` — 27 failing tests for all Phase 17 MCP tool requirements; RED state (module-not-found)

## Decisions Made

- Factory pattern for handlers: `buildSearchHandler({ qdrant, openai, vaultRoot })` returns `async (args) => result` — enables dependency injection without full module mocking
- `writeIpc` passed explicitly to `buildWriteHandler` — allows mock call verification in tests without mocking the entire IPC file system
- `checkConfidenceFirewall(level, domain, qdrant)` takes qdrant as 3rd param (same DI pattern as `embedEntry()` in embedder.ts)

## Deviations from Plan

None - plan executed exactly as written. The test file follows the exact vi.hoisted() + vi.mock() pattern from embedder.test.ts. RED state confirmed with `Cannot find module '/src/cortex/cortex-mcp-tools.js'`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Test scaffold ready for Plan 02 (GREEN implementation of `src/cortex/cortex-mcp-tools.ts`)
- 27 tests will drive the implementation of `buildSearchHandler`, `buildReadHandler`, `buildWriteHandler`, `isVaultPath`, `checkConfidenceFirewall`
- No blockers.

---
*Phase: 17-search-mcp-tools*
*Completed: 2026-03-30*
