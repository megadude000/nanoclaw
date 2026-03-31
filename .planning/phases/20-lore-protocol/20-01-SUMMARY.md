---
phase: 20-lore-protocol
plan: 01
subsystem: cortex
tags: [git-trailers, lore-atom, gray-matter, execSync, embedding]

requires:
  - phase: 16-embedding-pipeline
    provides: embedEntry() function for indexing vault files into Qdrant
provides:
  - parseLoreFromGit() extracts Constraint/Rejected/Directive trailers from git history
  - writeLoreAtom() creates vault files in cortex/Lore/ with lore-atom frontmatter
  - indexLoreAtoms() embeds lore vault files via embedEntry()
  - LoreAtom type and LORE_KEYS constant for downstream consumers
affects: [20-02-lore-protocol, night-shift-mining, agent-instructions]

tech-stack:
  added: []
  patterns: [git-trailer-parsing, vault-file-generation, idempotent-writes]

key-files:
  created:
    - src/cortex/lore-parser.ts
    - src/cortex/lore-parser.test.ts
  modified: []

key-decisions:
  - "Native git parsing with execSync and %(trailers) format -- no external CLI dependency (D-03)"
  - "10MB maxBuffer for git log to handle large repo histories safely"
  - "Trailing null byte cleanup in trailer parsing -- git format %(trailers) leaves trailing \\x00"
  - "Vault file naming: {7-char-hash}-{key-lowercase}.md for uniqueness and readability"
  - "Idempotent writes: existsSync check before writing prevents duplicate vault files"

patterns-established:
  - "Lore atom vault files: type lore-atom, cortex_level L20, domain nanoclaw"
  - "Mined entries get confidence: low and lore_mined: true to distinguish from explicit trailers"
  - "Git trailer format: Constraint:/Rejected:/Directive: as standard capitalized trailers"

requirements-completed: [LORE-02, LORE-03]

duration: 3min
completed: 2026-03-31
---

# Phase 20 Plan 01: Lore Parser Summary

**Git trailer parser extracting Constraint/Rejected/Directive atoms from commit history into Cortex vault files via native execSync**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T10:06:10Z
- **Completed:** 2026-03-31T10:09:14Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Built parseLoreFromGit() that extracts lore trailers from git log using %(trailers) format
- Built writeLoreAtom() that creates Cortex vault files with lore-atom frontmatter in cortex/Lore/
- Built indexLoreAtoms() that embeds vault files into Qdrant via existing embedEntry()
- Full TDD cycle: 8 tests (RED) then implementation (GREEN), all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD test scaffold for lore parser** - `bdf52cc` (test)
2. **Task 2: Implement lore-parser.ts** - `cf1364f` (feat)

## Files Created/Modified
- `src/cortex/lore-parser.ts` - Git trailer extraction, vault file writing, embedding pipeline
- `src/cortex/lore-parser.test.ts` - 8 unit tests covering parse/write/index with mocked dependencies

## Decisions Made
- Used native execSync with %(trailers) format per D-03 (no external CLI)
- Set 10MB maxBuffer to safely handle large git histories
- Strip trailing null bytes from git format output to prevent value corruption
- Vault files named {7-char-hash}-{key-lowercase}.md for uniqueness
- existsSync guard makes writeLoreAtom idempotent (safe for repeated runs)
- Mined entries distinguished by confidence: low and lore_mined: true

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Trailing null byte in trailer values**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** git log %(trailers) format leaves trailing \x00 on the last field, causing trailer values to include a null byte suffix
- **Fix:** Added `.replace(/\x00+$/, '')` to strip trailing null bytes from joined trailer text
- **Files modified:** src/cortex/lore-parser.ts
- **Verification:** Test 2 (multiple trailers) passes with exact string matching
- **Committed in:** cf1364f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness. No scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Lore parser module ready for plan 20-02 (CLAUDE.md instructions, Night Shift mining task)
- cortex/Lore/ directory will be created on first writeLoreAtom() call
- indexLoreAtoms() requires running Qdrant and OPENAI_API_KEY (existing infrastructure)

---
*Phase: 20-lore-protocol*
*Completed: 2026-03-31*
