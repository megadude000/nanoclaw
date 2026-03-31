---
phase: 19-knowledge-graph
plan: 02
subsystem: cortex
tags: [knowledge-graph, mcp-tools, ipc, graph-index, cortex-relate]

# Dependency graph
requires:
  - phase: 19-01
    provides: cortex-graph.ts with loadGraph, saveGraph, addEdge, buildIndex, getNeighbors
provides:
  - buildRelateHandler factory for cortex_relate MCP tool
  - cortex_relate tool registered in container MCP server
  - Host IPC handler for cortex_relate messages (edge persistence to cortex-graph.json)
  - Graph-augmented cortex_search results with 1-hop neighbors
affects: [21-nightshift-cross-link, container-agent-runner]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-graph-loading-in-container, graph-augmented-search-results]

key-files:
  created: []
  modified:
    - src/cortex/cortex-mcp-tools.ts
    - src/cortex/cortex-mcp-tools.test.ts
    - container/agent-runner/src/ipc-mcp-stdio.ts
    - src/ipc.ts

key-decisions:
  - "Inline graph loading in container (loadGraphIndex) since container cannot import host src/cortex/"
  - "Graph loaded once at MCP server startup, read-only stale during session (acceptable per Phase 19 design)"
  - "Related array only included when neighbors exist (empty arrays omitted for cleaner output)"
  - "Edge type cast to union literal in ipc.ts to satisfy TypeScript strict typing on Edge.type"

patterns-established:
  - "Graph-augmented search: semantic results enriched with related array from in-memory GraphIndex"
  - "Container graph loading: inline loadGraphIndex reads cortex-graph.json at startup, graceful empty on missing/invalid"

requirements-completed: [GRAPH-02, MCP-04]

# Metrics
duration: 4min
completed: 2026-03-31
---

# Phase 19 Plan 02: MCP Tools and IPC Wiring Summary

**cortex_relate MCP tool wired end-to-end (container IPC to host graph persistence) with graph-augmented cortex_search returning 1-hop neighbors**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T08:13:29Z
- **Completed:** 2026-03-31T08:17:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- buildRelateHandler factory exported from cortex-mcp-tools.ts with self-edge rejection and IPC delegation
- cortex_relate tool registered in container MCP server with 5 edge types (BUILT_FROM, REFERENCES, BLOCKS, CROSS_LINK, SUPERSEDES)
- Host-side IPC handler in src/ipc.ts processes cortex_relate messages via loadGraph/addEdge/saveGraph
- cortex_search in both host handler and container MCP enriches semantic results with related array from graph index
- All 115 cortex tests pass across 7 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: buildRelateHandler + graph-augmented buildSearchHandler (TDD)** - `c1cce4e` (test: RED) + `ededab5` (feat: GREEN)
2. **Task 2: Container MCP registration + host IPC handler** - `7a972ae` (feat)

**Plan metadata:** [pending] (docs: complete plan)

_Note: Task 1 used TDD with separate RED/GREEN commits_

## Files Created/Modified
- `src/cortex/cortex-mcp-tools.ts` - Added buildRelateHandler factory, graphIndex param to buildSearchHandler, getNeighbors import
- `src/cortex/cortex-mcp-tools.test.ts` - 7 new tests: 4 for buildRelateHandler (MCP-04), 3 for graph-augmented search (GRAPH-02)
- `container/agent-runner/src/ipc-mcp-stdio.ts` - Inline loadGraphIndex, graph-augmented cortex_search, cortex_relate tool registration
- `src/ipc.ts` - cortex_relate IPC handler with loadGraph/addEdge/saveGraph import

## Decisions Made
- Inline graph loading in container (loadGraphIndex) since container cannot import from host src/cortex/ -- consistent with Phase 17-02 decision
- Graph loaded once at MCP server startup, stale during session -- acceptable per Phase 19 design (container lifespan is short)
- Related array only included when neighbors exist (empty arrays omitted for cleaner output)
- Edge type cast to union literal in ipc.ts to satisfy TypeScript strict Edge.type typing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cast edge_type to union literal type in ipc.ts**
- **Found during:** Task 2 (host IPC handler)
- **Issue:** TypeScript error TS2322: `string` not assignable to Edge type union
- **Fix:** Cast `data.edge_type as 'BUILT_FROM' | 'REFERENCES' | 'BLOCKS' | 'CROSS_LINK' | 'SUPERSEDES'`
- **Files modified:** src/ipc.ts
- **Verification:** npm run build shows no new TypeScript errors
- **Committed in:** 7a972ae (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Trivial type cast needed for TypeScript strict mode. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired end-to-end.

## Next Phase Readiness
- Knowledge graph feature complete: agents can declare relationships (cortex_relate) and discover connected context (cortex_search with related array)
- Phase 21 Nightshift CROSS_LINK auto-discovery can now add edges to cortex-graph.json using the same addEdge API
- Container graph is read-only/stale during session -- if longer container sessions are needed later, consider a refresh mechanism

---
*Phase: 19-knowledge-graph*
*Completed: 2026-03-31*
