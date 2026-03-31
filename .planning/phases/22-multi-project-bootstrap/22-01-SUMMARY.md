---
phase: 22-multi-project-bootstrap
plan: "01"
subsystem: cortex
tags:
  - cortex
  - bootstrap
  - multi-project
  - qdrant
  - embedding
dependency_graph:
  requires:
    - "16-embedding-pipeline (embedEntry, createOpenAIClient)"
    - "15-qdrant (cortex-entries collection)"
    - "14-cortex-schema (CortexFrontmatterSchema)"
  provides:
    - "L10/L20 vault entries for YourWave, ContentFactory, NightShift"
    - "generateProjectEntries() reusable function"
    - "Multi-project Qdrant filter scoping via project field"
  affects:
    - "cortex/Areas/Projects/YourWave/bootstrap/ (25 entries)"
    - "cortex/Areas/Projects/ContentFactory/bootstrap/ (4 entries)"
    - "cortex/Areas/Projects/NightShift/bootstrap/ (5 entries)"
tech_stack:
  added:
    - "gray-matter for frontmatter stripping in pure function"
  patterns:
    - "Pure generation function in src/cortex/ with I/O in scripts/"
    - "L10/L20 classification by filename keyword"
    - "MAX_CONTENT_LENGTH=24000 truncation before embedding"
key_files:
  created:
    - src/cortex/multi-project-bootstrap.ts
    - src/cortex/multi-project-bootstrap.test.ts
    - scripts/bootstrap-multi-project.ts
    - cortex/Areas/Projects/YourWave/bootstrap/ (25 files)
    - cortex/Areas/Projects/ContentFactory/bootstrap/ (4 files)
    - cortex/Areas/Projects/NightShift/bootstrap/ (5 files)
  modified: []
decisions:
  - "Pure logic extracted to src/cortex/multi-project-bootstrap.ts -- keeps rootDir constraint and enables unit testing without I/O"
  - "MAX_CONTENT_LENGTH=24000 chars truncation -- prevents 8192 token limit errors for large source docs like nightshift.architecture.md"
  - "One-doc-one-entry model -- simpler than splitting large docs, truncation note added to oversized entries"
metrics:
  duration: "6 minutes"
  completed: "2026-03-31"
  tasks_completed: 3
  files_changed: 65
---

# Phase 22 Plan 01: Multi-Project Bootstrap Summary

Bootstrap script generates L10/L20 Cortex vault entries for YourWave, ContentFactory, and NightShift from existing vault markdown docs, with correct project field for Qdrant filter scoping and 31 entries embedded (53→84 Qdrant points).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Test scaffold for multi-project bootstrap (RED) | 564dab1 | src/cortex/multi-project-bootstrap.test.ts |
| 2 | Bootstrap script + implementation (GREEN) | bcfb33d | scripts/bootstrap-multi-project.ts, src/cortex/multi-project-bootstrap.ts, test updated |
| 3 | Write vault entries and embed | 4e19514 | 62 files: 31 bootstrap entries, source docs, truncation fix |

## Verification Results

1. `npx vitest run src/cortex/multi-project-bootstrap.test.ts` — 23/23 tests pass
2. `npx tsx scripts/bootstrap-multi-project.ts --dry-run` — exits 0, 34 entries printed
3. Vault file count: 31 files across 3 bootstrap directories
4. `grep "project:" .../YourWave/bootstrap/YourWave.md` → `project: yourwave` ✓
5. TypeScript: 0 errors in bootstrap files

## Decisions Made

**1. Pure logic in src/cortex/multi-project-bootstrap.ts**
- Reason: TypeScript `rootDir: ./src` constraint prevents test files in `src/` from importing `scripts/`
- Impact: Clean separation of concerns — I/O in `scripts/`, testable logic in `src/`

**2. MAX_CONTENT_LENGTH truncation at 24,000 chars**
- Reason: `nightshift.architecture.md` (37KB, 5,106 words) exceeded OpenAI 8192 token limit
- Fix: Added `MAX_CONTENT_LENGTH = 24_000` constant, body truncated with `[truncated]` notice
- Impact: All 31 entries embed successfully; oversized docs note truncation at end

**3. One-doc-one-entry model**
- Reason: Simpler to implement, easier to trace entries back to source docs
- Impact: Large docs get truncated rather than split — acceptable for bootstrap phase

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript rootDir import violation**
- **Found during:** Task 1 (test imports `scripts/bootstrap-multi-project.ts` from `src/`)
- **Issue:** `tsconfig.json rootDir: ./src` means `src/` test files cannot import from `scripts/`
- **Fix:** Extracted pure `generateProjectEntries()` function to `src/cortex/multi-project-bootstrap.ts`; test imports from local module; `scripts/` re-exports for CLI use
- **Files modified:** src/cortex/multi-project-bootstrap.ts (new), src/cortex/multi-project-bootstrap.test.ts (import updated), scripts/bootstrap-multi-project.ts (imports from src/)
- **Commit:** bcfb33d

**2. [Rule 1 - Bug] OpenAI 8192 token limit exceeded for nightshift.architecture.md**
- **Found during:** Task 3 (full embedding run)
- **Issue:** `nightshift.architecture.md` is 37KB / 5,106 words — exceeds OpenAI token limit, embedding fails with HTTP 400
- **Fix:** Added `MAX_CONTENT_LENGTH = 24_000` constant in `src/cortex/multi-project-bootstrap.ts`; body truncated at 24K chars with explanatory note
- **Files modified:** src/cortex/multi-project-bootstrap.ts, all NightShift bootstrap entries rewritten
- **Commit:** 4e19514

## Known Stubs

None — all generated entries have real content from source vault documents.

## Self-Check: PASSED
