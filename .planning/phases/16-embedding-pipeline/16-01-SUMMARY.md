---
phase: 16-embedding-pipeline
plan: 01
subsystem: cortex
tags: [openai, qdrant, embeddings, vector-db, gray-matter, vitest]

# Dependency graph
requires:
  - phase: 14-cortex-schema-standard
    provides: parseCortexEntry() with SHA-256 body hash, Zod validation, ParsedCortexEntry type
  - phase: 15-qdrant-infrastructure
    provides: cortex-entries collection (1536-dim cosine, payload indexes on cortex_level/domain/project/status)

provides:
  - openai@^6.33.0 and @qdrant/js-client-rest@^1.17.0 installed as production dependencies
  - createQdrantClient() factory — returns QdrantClient(localhost:6333), no singleton caching
  - checkQdrantHealth(client) — 5-retry loop with 2s backoff, returns true/false
  - COLLECTION_NAME = 'cortex-entries' constant for reuse
  - embedEntry(filePath, openai, qdrant, options?) — full embed pipeline with skip/error paths
  - EmbedResult interface — status: embedded/skipped/error, filePath, reason?
  - createOpenAIClient() — reads OPENAI_API_KEY from .env via readEnvFile, throws if missing
  - deterministicId(filePath) — MD5 of cortex-relative path formatted as UUID
  - updateFrontmatter(filePath, updates) — gray-matter read/stringify/write for source_hash + embedding_model

affects:
  - 16-02 (watcher and batch command: imports embedEntry from this plan)
  - 17 (cortex_write MCP tool: imports embedEntry directly for post-write embedding)
  - 21 (nightshift reconciliation: batch re-embed uses embedEntry with force:true)

# Tech tracking
tech-stack:
  added:
    - openai@^6.33.0 (OpenAI Embeddings API client — handles retries, rate limits, type safety)
    - "@qdrant/js-client-rest@^1.17.0 (Qdrant REST client — type-safe point operations)"
  patterns:
    - "Dependency injection for testability: embedEntry accepts openai and qdrant clients as parameters rather than creating them internally"
    - "Content-hash skip pattern: compare frontmatter.source_hash against parseCortexEntry().sourceHash before calling OpenAI"
    - "Deterministic UUID from file path: MD5(relative-path-from-cortex/) formatted as 8-4-4-4-12 UUID"
    - "vi.hoisted() for mock variables that need to be referenced inside vi.mock() factories"

key-files:
  created:
    - src/cortex/qdrant-client.ts
    - src/cortex/qdrant-client.test.ts
    - src/cortex/embedder.ts
    - src/cortex/embedder.test.ts
  modified:
    - package.json (added openai, @qdrant/js-client-rest)
    - package-lock.json

key-decisions:
  - "Dependency injection for openai/qdrant clients in embedEntry() — enables unit testing without live services"
  - "vi.hoisted() required for gray-matter.stringify static method mock in vitest — factory closures are hoisted before variable declarations"
  - "deterministicId strips prefix before cortex/ so vault files get the same ID regardless of absolute path prefix (different machines, home dirs)"
  - "updateFrontmatter uses gray-matter.stringify — may reorder YAML keys but Obsidian handles reformatting fine (Pitfall 5 accepted)"
  - "MIN_CONTENT_LENGTH=50 guards against embedding stub/template files with no meaningful content"

patterns-established:
  - "Pattern: inject OpenAI and QdrantClient as function parameters, not module-level globals — all callers (watcher, batch, cortex_write) pass their own client instances"
  - "Pattern: content-hash skip before API call — parseCortexEntry.sourceHash vs frontmatter.source_hash, bypassed with force:true"
  - "Pattern: embedder returns EmbedResult discriminated union (embedded/skipped/error) — callers aggregate results without throwing"

requirements-completed: [EMBED-01, EMBED-04]

# Metrics
duration: 10min
completed: 2026-03-30
---

# Phase 16 Plan 01: Embedding Pipeline Foundation Summary

**OpenAI text-embedding-3-small + Qdrant upsert pipeline with content-hash dedup, deterministic point IDs, and frontmatter write-back — 49 cortex tests green**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-30T20:03:25Z
- **Completed:** 2026-03-30T20:12:42Z
- **Tasks:** 2
- **Files modified:** 6 (2 source files, 2 test files, package.json, package-lock.json)

## Accomplishments

- openai@^6.33.0 and @qdrant/js-client-rest@^1.17.0 installed as production dependencies
- Qdrant client factory with 5-retry health check using 2-second backoff (handles Pitfall 6: container startup delay)
- Full embed pipeline in embedEntry(): parse -> validate -> content-length guard -> hash check -> OpenAI embed -> Qdrant upsert -> frontmatter write-back
- 49 tests across 4 cortex test files, all green (6 qdrant-client + 15 embedder + 23 schema + 5 parser)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create Qdrant client singleton** - `0282abf` (feat)
2. **Task 2: Create shared embedEntry() function with unit tests** - `6b9019a` (feat)

## Files Created/Modified

- `src/cortex/qdrant-client.ts` — createQdrantClient(), checkQdrantHealth(), COLLECTION_NAME constant
- `src/cortex/qdrant-client.test.ts` — 6 tests: COLLECTION_NAME, constructor args, singleton check, health check scenarios
- `src/cortex/embedder.ts` — embedEntry(), EmbedResult, createOpenAIClient(), deterministicId(), updateFrontmatter(), EMBEDDING_MODEL, MIN_CONTENT_LENGTH
- `src/cortex/embedder.test.ts` — 15 tests covering all 6 TDD behaviors (embedded, skipped-hash, skipped-short, error-validation, error-openai, force-bypass)
- `package.json` — added openai@^6.33.0 and @qdrant/js-client-rest@^1.17.0
- `package-lock.json` — updated lockfile

## Decisions Made

- Used dependency injection (openai and qdrant passed as params) instead of module-level singletons — enables mocking in tests without complex module teardown
- Used `vi.hoisted()` for the gray-matter stringify mock — vitest hoists `vi.mock()` factory calls to the top of the file, which means the factory closure runs before any `const` declarations in the module. `vi.hoisted()` is the correct vitest pattern for creating mock variables referenced inside `vi.mock()` factories.
- deterministicId strips the absolute prefix before `cortex/` — ensures the same vault file produces the same Qdrant point ID regardless of where the vault is mounted (e.g., different home directory on a new machine)
- Gray-matter stringify reordering accepted — Obsidian handles YAML key reordering fine, and the alternative (targeted string regex replacement) would be fragile and add complexity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `this` implicit any type in qdrant-client.test.ts mock constructor**
- **Found during:** Task 1 verification (TypeScript compilation check)
- **Issue:** `vi.fn().mockImplementation(function() { this.getCollections = ... })` caused TS2683 because `this` had no type annotation in the mock function
- **Fix:** Added `this: Record<string, unknown>` type annotation to the mock implementation function
- **Files modified:** src/cortex/qdrant-client.test.ts
- **Verification:** `npx tsc --noEmit | grep src/cortex` returns no errors
- **Committed in:** 6b9019a (merged into Task 2 commit as part of test cleanup)

**2. [Rule 1 - Bug] Fixed vi.mock hoisting issue with gray-matter.stringify**
- **Found during:** Task 2 (embedder test run)
- **Issue:** Declaring `const mockMatterStringify = vi.fn()` outside `vi.mock()` then referencing it inside the factory caused "Cannot access 'mockMatterStringify' before initialization" — vitest hoists `vi.mock()` calls to the top of the file before variable declarations
- **Fix:** Used `vi.hoisted()` to declare the mock variables so they are available when the hoisted `vi.mock()` factory runs
- **Files modified:** src/cortex/embedder.test.ts
- **Verification:** All 15 embedder tests pass
- **Committed in:** 6b9019a

---

**Total deviations:** 2 auto-fixed (2 × Rule 1 - Bug)
**Impact on plan:** Both fixes required for TypeScript correctness and test functionality. No scope creep.

## Issues Encountered

- gray-matter default export mock needed the `.stringify` static method attached to the mock function — non-obvious vitest pattern resolved with `vi.hoisted()` + manual property assignment on the mock function reference

## Known Stubs

None — embedEntry() is fully wired to real OpenAI and Qdrant APIs. Integration requires live services (OpenAI API key in .env and Qdrant running).

## Next Phase Readiness

- embedEntry() is ready for import by the watcher (Plan 16-02) and batch re-embed command (Plan 16-02)
- Phase 17 cortex_write MCP tool can import embedEntry directly from src/cortex/embedder.ts
- No blockers: all exports verified, TypeScript clean in cortex files, 49 tests green

## Self-Check: PASSED

- FOUND: src/cortex/qdrant-client.ts
- FOUND: src/cortex/embedder.ts
- FOUND: src/cortex/embedder.test.ts
- FOUND: commit 0282abf (Task 1)
- FOUND: commit 6b9019a (Task 2)

---
*Phase: 16-embedding-pipeline*
*Completed: 2026-03-30*
