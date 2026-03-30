---
phase: 14-cortex-schema-standard
plan: 01
subsystem: cortex
tags: [zod, gray-matter, schema-validation, knowledge-pyramid, frontmatter]

requires:
  - phase: none
    provides: first phase of v3.0 milestone
provides:
  - Zod schemas for Cortex YAML frontmatter (strict + permissive)
  - validateFrontmatter() function with path-based default inference
  - parseCortexEntry() function with gray-matter + SHA-256 body hashing
  - Knowledge pyramid L10-L50 documentation with staleness TTLs
  - TypeScript types (CortexFrontmatter, ValidationResult, ParsedCortexEntry)
affects: [14-02-embedding-pipeline, 15-qdrant, 16-bootstrap, 17-mcp-tools]

tech-stack:
  added: [gray-matter ^4.0.3, zod ^4.3.6]
  patterns: [layered-zod-validation, path-based-inference, body-only-hashing]

key-files:
  created:
    - src/cortex/schema.ts
    - src/cortex/types.ts
    - src/cortex/parser.ts
    - src/cortex/schema.test.ts
    - src/cortex/parser.test.ts
    - cortex/System/cortex-schema.md
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Zod passthrough() applied after merge() to preserve unknown existing fields"
  - "Domain inference uses project field first, path inference only as fallback"
  - "Existing domain field in raw frontmatter never overwritten by inference (Pitfall 2)"
  - "source_hash = SHA-256 of body only, frontmatter excluded (Pitfall 4)"
  - "Staleness TTLs: L10=14d, L20=30d, L30=60d, L40=90d, L50=180d"

patterns-established:
  - "Layered Zod validation: CortexFrontmatterStrict for writes, CortexFrontmatterPermissive for reads"
  - "Path-based default inference via inferDefaults() for existing vault files"
  - "Body-only hashing via gray-matter content extraction + node:crypto SHA-256"

requirements-completed: [SCHEMA-01]

duration: 15min
completed: 2026-03-30
---

# Phase 14 Plan 01: Cortex Schema Standard Summary

**Zod v4 validation for Cortex YAML frontmatter with L10-L50 knowledge pyramid, path-based default inference, and SHA-256 body hashing**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-30T17:20:21Z
- **Completed:** 2026-03-30T17:35:36Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Zod schemas validate strict (all fields required) and permissive (defaults inferred) modes
- Path-based inference produces correct cortex_level for all vault path patterns (Session-Logs->L50, Calendar/Daily->L40, System->L10, Projects hub->L40, sub->L20)
- gray-matter parser computes source_hash from body only (frontmatter changes do not trigger re-embedding)
- Knowledge pyramid documented in Obsidian vault with its own valid Cortex frontmatter (dogfooding)
- 28 unit tests covering schema validation, path inference, hash boundary, and real vault file parsing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install gray-matter and create Zod schema + validation module with tests** - `ecd0479` (feat)
2. **Task 2: Create parser module with source_hash and integration tests** - `5c38da8` (feat)
3. **Task 3: Create knowledge pyramid documentation in Obsidian vault** - `14f43ff` (docs)

## Files Created/Modified

- `src/cortex/types.ts` - TypeScript types: CortexLevel, Confidence, CortexFrontmatter, ValidationResult, ParsedCortexEntry, STALENESS_TTLS
- `src/cortex/schema.ts` - Zod v4 schemas + validateFrontmatter() + inferDefaults()
- `src/cortex/parser.ts` - gray-matter wrapper with SHA-256 body hashing
- `src/cortex/schema.test.ts` - 23 unit tests for schema validation and inference
- `src/cortex/parser.test.ts` - 5 unit tests for parser and hash boundary
- `cortex/System/cortex-schema.md` - Knowledge pyramid docs visible in Obsidian
- `package.json` - Added gray-matter ^4.0.3 and zod ^4.3.6 dependencies
- `package-lock.json` - Lock file updated

## Decisions Made

- **Passthrough after merge:** Zod v4 requires `.passthrough()` called after `.merge()` to preserve unknown fields. Applied to both strict and permissive schemas.
- **Domain inference priority:** project field (lowercased) > path inference > "general" fallback. Existing domain field never overwritten.
- **Staleness TTLs:** L10=14d (code changes fast), L20=30d, L30=60d, L40=90d, L50=180d (experiential stays relevant longest). Configurable per deployment.
- **Schema location:** `src/cortex/` directory for all Cortex modules, following existing `src/` convention.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data sources wired, no placeholder values.

## Next Phase Readiness

- Schema is locked: `cortex_level`, `confidence`, `domain`, `scope`, `source_hash`, `embedding_model` field names and types are final
- `validateFrontmatter()` ready for embedding pipeline (Phase 15+) and `cortex_write` MCP tool (Phase 17)
- `parseCortexEntry()` ready for vault indexing/bootstrap (Phase 16)
- `STALENESS_TTLS` ready for nightshift reconciliation staleness cascade

## Self-Check: PASSED

All 7 created files verified on disk. All 3 task commits found in git log.

---
*Phase: 14-cortex-schema-standard*
*Completed: 2026-03-30*
