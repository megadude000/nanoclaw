---
phase: 14-cortex-schema-standard
verified: 2026-03-30T19:51:30Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 14: Cortex Schema Standard Verification Report

**Phase Goal:** A locked YAML frontmatter standard exists that all downstream components (embedder, MCP tools, reconciler) can depend on without risk of breaking changes
**Verified:** 2026-03-30T19:51:30Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Cortex entry with valid frontmatter (cortex_level, confidence, domain, scope) passes strict validation | VERIFIED | `validateFrontmatter(strict)` wired to `CortexFrontmatterStrict.safeParse()`. 23 unit tests pass including "strict valid" test. |
| 2 | A Cortex entry with missing or invalid Cortex fields fails strict validation with a clear error naming the bad field | VERIFIED | Error mapping uses `i.path.join('.')` to surface field name. Tests "strict missing cortex_level" and "invalid confidence" confirm error messages contain field names. |
| 3 | An existing vault file with no Cortex fields passes permissive validation with defaults inferred from file path | VERIFIED | `inferDefaults()` maps path patterns to cortex_level. Permissive path merges defaults first, raw overrides. Tests cover Session-Logs->L50, Calendar/Daily->L40, System->L10. |
| 4 | source_hash is computed from markdown body only (frontmatter changes do not change the hash) | VERIFIED | `createHash('sha256').update(content).digest('hex')` where `content` is gray-matter's extracted body after stripping frontmatter. Parser test "source_hash excludes frontmatter" explicitly validates this boundary. |
| 5 | L10-L50 knowledge pyramid levels are documented with definitions, examples, and staleness TTLs | VERIFIED | `cortex/System/cortex-schema.md` contains full table with Name, Definition, Examples, and Staleness TTL columns for all 5 levels. "14 days" and "180 days" confirmed present. Schema Lock Notice present. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/cortex/schema.ts` | Zod schemas (CortexFrontmatterStrict, CortexFrontmatterPermissive), validateFrontmatter(), inferDefaults() | VERIFIED | 245 lines. Exports: CortexLevelSchema, ConfidenceSchema, CortexFieldsStrict, EmbeddingMeta, ExistingFields, CortexFrontmatterStrict, CortexFrontmatterPermissive, inferDefaults, validateFrontmatter. 3 z.enum calls, 3 passthrough() calls. |
| `src/cortex/types.ts` | TypeScript types derived from Zod schemas | VERIFIED | 62 lines. Exports: CortexLevel, Confidence, CortexFrontmatter, ValidationResult, InferredDefaults, ParsedCortexEntry, STALENESS_TTLS. All 6 required types present. STALENESS_TTLS = {L10:14, L20:30, L30:60, L40:90, L50:180}. |
| `src/cortex/parser.ts` | gray-matter wrapper: parseCortexEntry(filePath) -> ParsedCortexEntry | VERIFIED | 39 lines. Exports parseCortexEntry. Imports: matter from 'gray-matter', createHash from 'node:crypto', validateFrontmatter from './schema.js'. sourceHash computed from body only. |
| `src/cortex/schema.test.ts` | Unit tests for schema validation (strict + permissive + inference), min 80 lines | VERIFIED | 210 lines, 23 it() test cases covering strict valid, missing field errors, invalid enum, passthrough, permissive defaults, path inference for all vault patterns, domain priority rules, TTL lookup. |
| `src/cortex/parser.test.ts` | Unit tests for parser (source_hash boundary, gray-matter integration), min 30 lines | VERIFIED | 87 lines, 5 it() test cases covering hash-excludes-frontmatter, hash-changes-with-body, no-frontmatter permissive, real vault file permissive, real vault strict failure. |
| `cortex/System/cortex-schema.md` | Knowledge pyramid documentation visible in Obsidian, contains "L10" | VERIFIED | 74 lines. Valid YAML frontmatter with cortex_level: L10, confidence: high, domain: nanoclaw, scope: cortex schema specification. Sections: Required Fields, Embedding Metadata, Knowledge Pyramid table, Validation Modes, Path-Based Inference, Existing Fields, Schema Lock Notice. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/cortex/schema.ts` | zod | `import { z } from 'zod'` | WIRED | Line 11: `import { z } from 'zod';`. z.enum used on lines 25, 28 (CortexLevelSchema, ConfidenceSchema). z.object, z.string, z.array, z.union used throughout. |
| `src/cortex/parser.ts` | gray-matter | `import matter from 'gray-matter'` | WIRED | Line 9: `import matter from 'gray-matter';`. Called on line 27: `const { data, content } = matter(raw);`. |
| `src/cortex/parser.ts` | `src/cortex/schema.ts` | `import { validateFrontmatter } from './schema.js'` | WIRED | Line 12: `import { validateFrontmatter } from './schema.js';`. Called on line 32: `const validation = validateFrontmatter(data as Record<string, unknown>, filePath, mode);`. |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces a validation library and documentation, not a component that renders dynamic data. The artifacts are utility modules (schema validation, parsing) consumed by downstream phases.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All schema and parser tests pass | `npx vitest run src/cortex/` | 28 tests passed (23 schema + 5 parser), 0 failures, 266ms | PASS |
| cortex/ files compile without TypeScript errors | `npx tsc --noEmit 2>&1 \| grep "src/cortex"` | No output (zero errors in cortex files) | PASS |
| gray-matter installed in package.json | `grep "gray-matter" package.json` | `"gray-matter": "^4.0.3"` | PASS |

Note: `npm run build` produces errors in other modules (discord.js, @whiskeysockets/baileys, sharp — missing optional dependencies), but zero errors in `src/cortex/`. These are pre-existing project issues unrelated to phase 14.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SCHEMA-01 | 14-01-PLAN.md | Cortex YAML frontmatter standard defined with cortex_level (L10-L50), confidence, domain, scope fields | SATISFIED | schema.ts defines CortexFrontmatterStrict with cortex_level, confidence, domain, scope. types.ts exports CortexLevel type. cortex-schema.md documents all fields. 28 tests validate the standard. REQUIREMENTS.md shows [x] checked at line 12, Phase 14 listed as Complete in requirements table. |

No orphaned requirements found for Phase 14.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/cortex/parser.ts` | 63 | Hardcoded absolute path in test file | Info | `/home/andrii-panasenko/nanoclaw/cortex/Areas/Projects/YourWave/YourWave.md` in parser.test.ts — guarded by `existsSync` check that skips on missing file, so not a portability blocker. |

No TODO/FIXME/placeholder comments found. No empty implementations. No stub patterns. All return values are real computed data.

### Human Verification Required

None — all behaviors are programmatically verifiable for a validation library phase. Visual or UI verification is not applicable.

### Gaps Summary

No gaps. All 5 observable truths are verified against the actual codebase:

- Schema validation logic is fully implemented (not stubbed) with 245 lines of real Zod code
- Path-based inference covers all 7 documented vault path patterns with correct level mappings
- source_hash boundary is enforced by gray-matter's content extraction before hashing
- 28 unit tests run green with zero failures
- Knowledge pyramid documentation is complete and valid in Obsidian vault
- SCHEMA-01 is marked complete in REQUIREMENTS.md and satisfactorily implemented
- Git history confirms 3 atomic commits (ecd0479, 5c38da8, 14f43ff) for the 3 tasks

The schema is locked and ready for downstream phases (embedding pipeline, MCP tools, reconciler).

---

_Verified: 2026-03-30T19:51:30Z_
_Verifier: Claude (gsd-verifier)_
