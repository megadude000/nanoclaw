---
phase: 20-lore-protocol
plan: 02
subsystem: cortex
tags: [lore-protocol, git-trailers, mining, heuristics, night-shift]

requires:
  - phase: 20-lore-protocol-01
    provides: parseLoreFromGit, writeLoreAtom, indexLoreAtoms, LoreAtom type
provides:
  - Lore Protocol convention documented in CLAUDE.md for agent adoption
  - mineLoreFromHistory() extracts implicit decisions from commit history
  - Classification engine for Constraint/Rejected/Directive from body text
  - Over-extraction guard (40 entry cap) prevents Cortex pollution
affects: [night-shift-wiring, agent-commit-conventions, cortex-search-quality]

tech-stack:
  added: []
  patterns: [decision-heuristic-mining, keyword-classification, over-extraction-guard]

key-files:
  created:
    - src/cortex/lore-mining.ts
    - src/cortex/lore-mining.test.ts
  modified:
    - CLAUDE.md

key-decisions:
  - "Forward-only convention: agents add trailers to new commits, never rewrite existing (D-01)"
  - "Mining capped at 40 entries when >50 candidates found -- quality over quantity (Pitfall 4)"
  - "Classification priority: Rejected > Directive > Constraint > default Constraint"
  - "Bullet-only mining: only lines starting with '- ' are candidates -- reduces false positives"
  - "Minimum 15-char threshold on bullet text to skip trivial entries"

patterns-established:
  - "Lore trailer convention: Constraint:/Rejected:/Directive: in commit message trailers"
  - "Mining heuristic: keyword-based classification with over-extraction guard"
  - "Mined entries always get { mined: true } option for confidence: low tracking"

requirements-completed: [LORE-01, LORE-03]

duration: 3min
completed: 2026-03-31
---

# Phase 20 Plan 02: Lore Convention Docs + Mining Script Summary

**CLAUDE.md documents the Lore Protocol trailer convention and Night Shift mining script extracts implicit decisions from commit history with keyword classification and over-extraction guard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T10:11:39Z
- **Completed:** 2026-03-31T10:14:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Documented Lore Protocol convention in CLAUDE.md with three trailer keys, good/bad examples, and forward-only rule
- Built mineLoreFromHistory() that heuristically extracts decisions from commit body bullets
- Classification engine maps keyword patterns to Constraint/Rejected/Directive categories
- Over-extraction guard caps at 40 entries when >50 candidates found (Pitfall 4)
- Full TDD cycle: 5 tests (RED) then implementation (GREEN), all passing
- Full test suite: 252 tests across 20 files, all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Document Lore Protocol convention in CLAUDE.md** - `adbeeeb` (feat)
2. **Task 2 RED: Add failing test scaffold for lore mining** - `2dd911a` (test)
3. **Task 2 GREEN: Implement Night Shift mining script** - `1e95927` (feat)

## Files Created/Modified
- `CLAUDE.md` - Added Lore Protocol section with trailer keys, examples, and rules
- `src/cortex/lore-mining.ts` - Mining script: extracts decisions from git history, classifies, writes vault files
- `src/cortex/lore-mining.test.ts` - 5 unit tests covering extraction, classification, skip logic, mined flag, over-extraction

## Decisions Made
- Forward-only convention per D-01: agents add trailers to new commits, never rewrite existing
- Mining capped at 40 entries (sorted by text length for specificity) when >50 candidates found
- Classification priority: Rejected patterns checked first, then Directive, then Constraint, default Constraint
- Only bullet-point lines (starting with "- ") are mining candidates to reduce false positives
- Minimum 15-character threshold on bullet text to skip trivial entries
- Mining script not wired into task-scheduler.ts -- Phase 21 handles Night Shift integration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- lore-parser.ts from Plan 01 was on a different worktree branch; cherry-picked files to satisfy import dependency. No code changes needed.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is complete and wired.

## Next Phase Readiness
- Lore Protocol convention is documented; agents reading CLAUDE.md will know to add trailers
- Mining script is ready to be called from Night Shift task (Phase 21 wiring)
- All lore atoms (explicit and mined) flow through the existing Cortex embedding pipeline

## Self-Check: PASSED

All files created, all commits verified, all tests green (252/252).

---
*Phase: 20-lore-protocol*
*Completed: 2026-03-31*
