---
phase: 18-knowledge-bootstrap
plan: "02"
subsystem: cortex
tags: [cortex, bootstrap, regex-extraction, vault, qdrant, embedding]

# Dependency graph
requires:
  - phase: 16-embedding-pipeline
    provides: embedEntry(), createOpenAIClient(), createQdrantClient(), gray-matter pipeline
  - phase: 17-search-mcp-tools
    provides: cortex_search/read/write MCP tools for container agents
provides:
  - scripts/bootstrap-cortex.ts for populating Cortex vault from source code
  - 53 vault entries under cortex/Areas/Projects/NanoClaw/ (48 per-module + 2 cross-cutting + 1 hub + 2 special)
  - env-vars.md aggregating all process.env references across codebase
  - ipc-contracts.md documenting IPC task types and MCP tool names
  - NanoClaw.md hub file (L40) linking all bootstrapped entries
affects: [19-cortex-relate, 22-multi-project-bootstrap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regex-based export extraction (EXPORT_FUNCTION/INTERFACE/TYPE/CLASS/CONST)"
    - "One vault entry per source module (not per export)"
    - "L10/L20 classification based on behavioral vs factual content"
    - "gray-matter.stringify for frontmatter generation"
    - "Cross-cutting entries aggregate data across all source files"

key-files:
  created:
    - scripts/bootstrap-cortex.ts
    - cortex/Areas/Projects/NanoClaw/NanoClaw.md
    - cortex/Areas/Projects/NanoClaw/src/env-vars.md
    - cortex/Areas/Projects/NanoClaw/src/ipc-contracts.md
  modified: []

key-decisions:
  - "Regex handles multi-line function params by scanning forward up to 10 lines after opening paren"
  - "Added --write-only flag for generating vault files without embedding (useful when OPENAI_API_KEY unavailable)"
  - "whatsapp-auth.ts excluded (0 exports) -- correct per plan skip rules"

patterns-established:
  - "Bootstrap entry template: frontmatter (cortex_level, confidence, domain, scope, type, tags, created, project) + markdown body with Exports sections"
  - "Vault path convention: src/foo/bar.ts maps to cortex/Areas/Projects/NanoClaw/src/foo/bar.md"

requirements-completed: [POP-01]

# Metrics
duration: 5min
completed: 2026-03-31
---

# Phase 18 Plan 02: Bootstrap Cortex Summary

**Regex-based bootstrap script generating 53 L10/L20/L40 vault entries from NanoClaw source code with cross-cutting env-vars and IPC contract aggregation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T07:31:16Z
- **Completed:** 2026-03-31T07:36:07Z
- **Tasks:** 2
- **Files modified:** 54

## Accomplishments
- Created scripts/bootstrap-cortex.ts with full extraction pipeline: regex export parsing, L10/L20 classification, frontmatter generation, vault writing, and Qdrant embedding
- Generated 53 vault entries: 48 per-module, 2 cross-cutting (env-vars.md, ipc-contracts.md), 1 hub (NanoClaw.md), and 2 additional (parser.md, agent-status-embeds.md recovered after regex fix)
- Dry-run mode validated without requiring Qdrant or OpenAI API key
- All entries have valid YAML frontmatter with required cortex_level, confidence, domain, scope fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/bootstrap-cortex.ts with full extraction and embedding pipeline** - `062d74a` (feat)
2. **Task 2: Run bootstrap script and verify generated entries** - `08575d3` (feat)

## Files Created/Modified
- `scripts/bootstrap-cortex.ts` - Bootstrap script: regex extraction, vault generation, embedding pipeline
- `cortex/Areas/Projects/NanoClaw/NanoClaw.md` - Hub file (L40) listing all 53 entries
- `cortex/Areas/Projects/NanoClaw/src/env-vars.md` - Cross-cutting: all process.env references
- `cortex/Areas/Projects/NanoClaw/src/ipc-contracts.md` - Cross-cutting: IPC task types + MCP tools
- `cortex/Areas/Projects/NanoClaw/src/*.md` - 48 per-module vault entries

## Decisions Made
- Regex handles multi-line function params by scanning forward (fixes parser.ts and agent-status-embeds.ts extraction)
- Added --write-only flag so files can be written without embedding (OPENAI_API_KEY not available in CI/worktree environment)
- Embedding deferred until OPENAI_API_KEY available -- dry-run validates all extraction logic

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed regex for multi-line function signatures**
- **Found during:** Task 2 (dry-run showed 51 entries instead of expected ~53)
- **Issue:** EXPORT_FUNCTION regex required closing paren on same line as `export function`. Files like parser.ts and agent-status-embeds.ts have params on next line.
- **Fix:** Changed regex to match just the opening paren, then gather params by scanning forward lines
- **Files modified:** scripts/bootstrap-cortex.ts
- **Verification:** Dry-run count increased from 51 to 53
- **Committed in:** 08575d3 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added --write-only mode**
- **Found during:** Task 2 (full run failed: OPENAI_API_KEY not in .env)
- **Issue:** Script could only dry-run or full-run (write + embed). No way to write vault files without embedding.
- **Fix:** Added --write-only flag that writes files then exits without attempting embedding
- **Files modified:** scripts/bootstrap-cortex.ts
- **Verification:** --write-only produces 53 files in cortex/Areas/Projects/NanoClaw/
- **Committed in:** 08575d3 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correct extraction count and usability. No scope creep.

## Issues Encountered
- OPENAI_API_KEY not available in .env -- embedding deferred. Vault files written via --write-only. Embedding can be run later with `npx tsx scripts/bootstrap-cortex.ts` when key is available.
- source_hash not present in generated entries (requires actual embedding run to be written by embedEntry)

## User Setup Required
None - no external service configuration required. Embedding requires OPENAI_API_KEY in .env and Qdrant at localhost:6333 (both already documented as prerequisites).

## Next Phase Readiness
- 53 vault entries ready for embedding when OPENAI_API_KEY is available
- Entries have valid frontmatter, ready for cortex_search via MCP tools
- Phase 19 (cortex_relate) can build on these entries once embedded

---
*Phase: 18-knowledge-bootstrap*
*Completed: 2026-03-31*
