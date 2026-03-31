---
phase: 18-knowledge-bootstrap
plan: 01
subsystem: knowledge
tags: [cortex, mcp, agent-instructions, knowledge-base]

# Dependency graph
requires:
  - phase: 17-search-mcp-tools
    provides: cortex_search/cortex_read/cortex_write MCP tools in ipc-mcp-stdio.ts
provides:
  - Global agent instruction to auto-query Cortex before every task
affects: [18-02-bootstrap-script, 19-cortex-relate, all-future-agent-invocations]

# Tech tracking
tech-stack:
  added: []
  patterns: [cortex-auto-query-before-task]

key-files:
  created: []
  modified: [groups/global/CLAUDE.md]

key-decisions:
  - "Cortex query threshold set to 0.7 score -- balances relevance vs recall"
  - "Agents extract 2-3 key concepts rather than full prompt -- prevents poor semantic matches"
  - "Skip query for purely conversational tasks -- avoids unnecessary API calls"

patterns-established:
  - "Cortex auto-query: agents call cortex_search before any technical task"

requirements-completed: [POP-03]

# Metrics
duration: 1min
completed: 2026-03-31
---

# Phase 18 Plan 01: Update Global CLAUDE.md Summary

**Cortex auto-query instruction added to global CLAUDE.md -- agents now search knowledge base before every technical task using cortex_search/cortex_read MCP tools**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-31T07:30:49Z
- **Completed:** 2026-03-31T07:31:43Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added "Cortex Knowledge Base" section to groups/global/CLAUDE.md
- All container agents now auto-query Cortex before starting any technical task
- Instruction includes concrete example query and score threshold (0.7)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Cortex Knowledge Base section to global CLAUDE.md** - `77ab95a` (feat)

**Plan metadata:** [pending final commit] (docs: complete plan)

## Files Created/Modified
- `groups/global/CLAUDE.md` - Added Cortex Knowledge Base section with auto-query instruction (12 lines)

## Decisions Made
- Score threshold of 0.7 chosen to balance relevance vs recall
- Agents instructed to extract 2-3 key concepts (not full prompt) for better semantic matching
- Conversational tasks exempt from Cortex query to avoid unnecessary API calls
- Used MCP tool names (cortex_search, cortex_read) not import paths -- containers use MCP tools

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - no stubs or placeholders in the changes.

## Next Phase Readiness
- Auto-query instruction is live for all future agent invocations
- Ready for Plan 02 (bootstrap script) which will populate the knowledge base with entries for agents to find
- Ready for Plan 03 (end-to-end verification) which will test that an agent actually queries and retrieves results

---
*Phase: 18-knowledge-bootstrap*
*Completed: 2026-03-31*
