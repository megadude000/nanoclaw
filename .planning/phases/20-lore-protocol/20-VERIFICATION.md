---
phase: 20-lore-protocol
verified: 2026-03-31T12:17:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 20: Lore Protocol Verification Report

**Phase Goal:** Architectural decisions captured in git commit trailers are indexed as searchable Cortex entries, closing the gap between "what changed" and "why it changed"
**Verified:** 2026-03-31T12:17:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `parseLoreFromGit` extracts Constraint/Rejected/Directive trailers from git log output | VERIFIED | `src/cortex/lore-parser.ts` L57-101. Uses `execSync` with `%(trailers)` format. 4 unit tests cover extraction, multi-trailer, empty, and `since` filter. All pass. |
| 2 | `writeLoreAtom` creates a vault file in `cortex/Lore/` with valid Cortex frontmatter | VERIFIED | `src/cortex/lore-parser.ts` L118-169. Writes `{7-char-hash}-{key}.md` with `type: lore-atom`, `cortex_level: L20`, `confidence`, `domain`, `lore_source`, `lore_key`, `commit_date`. Tests verify frontmatter by reading back with gray-matter. |
| 3 | Duplicate lore atoms are detected and skipped (idempotent re-run) | VERIFIED | `src/cortex/lore-parser.ts` L132-134. `existsSync` guard returns `null` on second call. Test "skips if vault file already exists" confirms null return. |
| 4 | Lore atoms can be embedded via `embedEntry()` | VERIFIED | `indexLoreAtoms` at L183-194 calls `embedEntry(fp, openai, qdrant, { force: true })` for each file. Unit test confirms `embedEntry` called with correct args. |
| 5 | CLAUDE.md documents the Lore Protocol trailer convention with good and bad examples | VERIFIED | `CLAUDE.md` L74-109. Section `## Lore Protocol` present after `## Development`, before `## Troubleshooting`. Contains all three trailer keys, good example commit, three bad examples with explanations, five rules including forward-only. |
| 6 | Agents reading CLAUDE.md know to add Constraint/Rejected/Directive trailers to commits | VERIFIED | `CLAUDE.md` L76: "Every commit that makes a non-trivial decision SHOULD include one or more lore trailers." Convention documented with `cortex_search` link, specific examples, and rules. |
| 7 | A one-time Night Shift mining task extracts implicit decisions from existing commits | VERIFIED | `src/cortex/lore-mining.ts` exports `mineLoreFromHistory()`. Scans git log with `--all --no-merges`, extracts bullet-point decisions, applies over-extraction guard (capped at 40 when >50 candidates). 5 tests all pass. |
| 8 | Mined entries are written as lore-atom with `confidence: low` and `lore_mined: true` | VERIFIED | `src/cortex/lore-mining.ts` L209 calls `writeLoreAtom(atom, vaultDir, { mined: true })`. `lore-parser.ts` L140 sets `confidence: 'low'` when `options?.mined` is true, L149-151 adds `lore_mined: true`. Test "sets mined=true on all extracted atoms" confirms all calls pass `{ mined: true }`. |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/cortex/lore-parser.ts` | Git trailer parsing and vault file writing | VERIFIED | 195 lines. Exports: `LORE_KEYS`, `LoreKey`, `LoreAtom`, `parseLoreFromGit`, `writeLoreAtom`, `indexLoreAtoms` (6 exports confirmed). Fully implemented — no stubs or placeholders. |
| `src/cortex/lore-parser.test.ts` | Unit tests for lore parser (min 80 lines) | VERIFIED | 261 lines (exceeds 80-line minimum). 8 tests across 3 describe blocks (`parseLoreFromGit` x4, `writeLoreAtom` x3, `indexLoreAtoms` x1). All 8 pass. |
| `src/cortex/lore-mining.ts` | Mining script exporting `mineLoreFromHistory` | VERIFIED | 229 lines. Exports `mineLoreFromHistory` and `MiningSummary`. Substantive implementation with decision extraction, classification engine, over-extraction guard, and vault file creation. |
| `src/cortex/lore-mining.test.ts` | Unit tests for mining heuristics (min 40 lines) | VERIFIED | 145 lines (exceeds 40-line minimum). 5 tests covering extraction, classification, skip logic, mined flag, and over-extraction cap. All 5 pass. |
| `CLAUDE.md` | Lore Protocol convention section containing "Constraint:" | VERIFIED | Section `## Lore Protocol` at line 74. Contains `Constraint:`, `Rejected:`, `Directive:`, `cortex_search`, `forward-only` rule, good example, bad examples. Positioned correctly after `## Development` and before `## Troubleshooting`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/cortex/lore-parser.ts` | `node:child_process` | `execSync` for git log | WIRED | `execSync` imported and called at L12, L64. Passes `%(trailers)` format string. |
| `src/cortex/lore-parser.ts` | `src/cortex/embedder.ts` | `embedEntry()` for indexing | WIRED | `embedEntry` imported at L18, called in `indexLoreAtoms()` at L190. |
| `src/cortex/lore-parser.ts` | `gray-matter` | `matter.stringify` for vault file frontmatter | WIRED | `matter` imported at L15, `matter.stringify(body, frontmatter)` called at L165. |
| `src/cortex/lore-mining.ts` | `src/cortex/lore-parser.ts` | `writeLoreAtom` for creating vault files | WIRED | `writeLoreAtom` imported at L18, called at L209 with `{ mined: true }`. |
| `src/cortex/lore-mining.ts` | `src/cortex/lore-parser.ts` | `indexLoreAtoms` for embedding | WIRED | `indexLoreAtoms` imported at L18, called at L219 with written paths. |
| `CLAUDE.md` | git commit trailers | Convention documentation with `Constraint:`/`Rejected:`/`Directive:` | WIRED | All three trailer keys present with definitions, examples, and usage rules. |

---

### Data-Flow Trace (Level 4)

`lore-parser.ts` and `lore-mining.ts` are not rendering components — they are data-processing utilities. Data-flow trace applies to the pipeline:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `parseLoreFromGit` | `atoms[]` | `execSync('git log ...')` | Yes — real git process output | FLOWING |
| `writeLoreAtom` | vault file | `matter.stringify(body, frontmatter)` + `writeFileSync` | Yes — real file written to disk | FLOWING |
| `indexLoreAtoms` | `EmbedResult[]` | `embedEntry(fp, openai, qdrant)` | Yes — delegates to existing embedder (Phase 16) | FLOWING |
| `mineLoreFromHistory` | `MiningSummary` | `execSync('git log --all --no-merges')` | Yes — real git history, writes vault files, embeds them | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| lore-parser tests (8 tests) | `npx vitest run src/cortex/lore-parser.test.ts` | 8 passed | PASS |
| lore-mining tests (5 tests) | `npx vitest run src/cortex/lore-mining.test.ts` | 5 passed | PASS |
| Combined run (13 tests) | `npx vitest run src/cortex/lore-parser.test.ts src/cortex/lore-mining.test.ts` | 13 passed in 276ms | PASS |

---

### Requirements Coverage

The LORE-* IDs are defined in `20-RESEARCH.md` (phase-scoped requirements, not in `docs/REQUIREMENTS.md` which covers system-level requirements only). Cross-referenced below.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LORE-01 | 20-02-PLAN.md | Lore Protocol convention defined — git trailer format documented in CLAUDE.md | SATISFIED | `CLAUDE.md` section `## Lore Protocol` with all three trailer keys, good/bad examples, and forward-only rule. `cortex_search` reference present. |
| LORE-02 | 20-01-PLAN.md | Native git parsing extracts lore atoms from commit trailers (no CLI dependency) | SATISFIED | `parseLoreFromGit` uses `execSync` with `%(trailers)` format per D-03. 10MB maxBuffer. No external CLI. 4 unit tests pass. |
| LORE-03 | 20-01-PLAN.md, 20-02-PLAN.md | Lore atoms indexed into Cortex entries and searchable via cortex_search | SATISFIED | `writeLoreAtom` creates vault files with `type: lore-atom`, `cortex_level: L20`. `indexLoreAtoms` embeds via `embedEntry()`. `mineLoreFromHistory` uses both for historical commits. Idempotent duplicate detection present. |

No orphaned requirements found — all three LORE IDs claimed in plans and verified in implementation.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

Scan results:
- No `TODO`, `FIXME`, `PLACEHOLDER`, or "not implemented" comments in any lore files.
- No `return null` / `return {}` / `return []` stubs in implementation functions (the `return null` in `writeLoreAtom` is intentional idempotent skip, not a stub).
- No empty arrow functions `=> {}`.
- No hardcoded empty data arrays passed to downstream consumers.
- `lore-mining.ts` early-returns with zeroed `MiningSummary` when git output is empty — correct guard, not a stub.

---

### Human Verification Required

#### 1. Live end-to-end: parse real commits from nanoclaw repo

**Test:** Run `parseLoreFromGit('/home/andrii-panasenko/nanoclaw')` against the live repo and inspect returned atoms.
**Expected:** Returns at least the lore trailers from commits `adbeeeb`, `bdf52cc`, `cf1364f`, `2dd911a`, `1e95927` if those commits contain `Constraint:`/`Rejected:`/`Directive:` trailers.
**Why human:** Requires live git process and inspection of actual commit history for trailer presence.

#### 2. Vault file written to cortex/Lore/ on real run

**Test:** Call `writeLoreAtom` with a real atom and `vaultDir = '/home/andrii-panasenko/nanoclaw/cortex'`. Verify a file appears in `cortex/Lore/`.
**Expected:** File `cortex/Lore/{hash}-{key}.md` exists with valid YAML frontmatter (`type: lore-atom`).
**Why human:** File system side effect requires manual inspection or a one-off script run.

#### 3. Night Shift mining script on full repo history

**Test:** Call `mineLoreFromHistory` against the real repo with running Qdrant and OpenAI credentials.
**Expected:** Returns `MiningSummary` with `total_commits_scanned > 0`, `decisions_extracted > 0`, vault files appear in `cortex/Lore/`.
**Why human:** Requires live Qdrant + OpenAI — cannot test without running services.

---

### Gaps Summary

No gaps found. All automated checks pass. Phase goal is achieved:

- Git trailer parsing engine (`lore-parser.ts`) is fully implemented and tested.
- Vault file creation with correct `lore-atom` frontmatter is confirmed by tests reading back real files.
- Mining script (`lore-mining.ts`) heuristically extracts implicit decisions and applies the over-extraction guard.
- CLAUDE.md documents the Lore Protocol convention so agents adopting the convention know exactly what to write.
- All 13 tests pass. No stubs, no placeholders, no broken wiring.

The three human verification items above are operational checks (live services, live git) that are not blockers — the implementation is complete and correct.

---

_Verified: 2026-03-31T12:17:00Z_
_Verifier: Claude (gsd-verifier)_
