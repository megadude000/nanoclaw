---
phase: 16-embedding-pipeline
verified: 2026-03-30T22:30:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Live integration: embedEntry() calls OpenAI API and upserts to running Qdrant"
    expected: "New vector appears in cortex-entries collection with correct 1536-dim vector and payload"
    why_human: "Requires live OPENAI_API_KEY in .env and Qdrant running at localhost:6333 — cannot verify without external services"
  - test: "Watcher fires after genuine 10-minute idle following a real file edit"
    expected: "Edited .md file is embedded and its frontmatter gains source_hash and embedding_model fields"
    why_human: "Real timer (600000ms) cannot be triggered programmatically in a static check"
---

# Phase 16: Embedding Pipeline Verification Report

**Phase Goal:** Cortex entries are automatically converted to searchable vectors whenever content changes, with no redundant API calls for unchanged content
**Verified:** 2026-03-30T22:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | embedEntry() calls OpenAI text-embedding-3-small and upserts a 1536-dim vector to Qdrant cortex-entries collection | VERIFIED | `embedder.ts` lines 170-204: `openai.embeddings.create({ model: EMBEDDING_MODEL })` + `qdrant.upsert(COLLECTION_NAME, { wait:true, points:[...] })`. Test "returns embedded status after successful OpenAI call + Qdrant upsert" asserts both calls. |
| 2 | embedEntry() skips embedding when file content hash matches source_hash in frontmatter | VERIFIED | `embedder.ts` line 163: `if (!options?.force && entry.frontmatter.source_hash === entry.sourceHash)` returns `{ status: 'skipped', reason: 'content unchanged' }`. Covered by embedder test "returns skipped when source_hash matches". |
| 3 | embedEntry() with force:true embeds even when hash matches | VERIFIED | Same guard at line 163 is bypassed when `options?.force` is truthy. Covered by embedder test "embeds even when hash matches when force:true is passed". |
| 4 | embedEntry() writes source_hash and embedding_model back to file frontmatter after successful embed | VERIFIED | `embedder.ts` lines 207-210: `updateFrontmatter(filePath, { source_hash: entry.sourceHash, embedding_model: EMBEDDING_MODEL })`. Covered by embedder test "writes source_hash and embedding_model back to frontmatter after successful embed". |
| 5 | Files with body content shorter than 50 chars are skipped with a warning | VERIFIED | `embedder.ts` lines 157-159: `if (entry.content.trim().length < MIN_CONTENT_LENGTH)` returns `{ status: 'skipped', reason: 'content too short' }`. MIN_CONTENT_LENGTH=50. Covered by test "returns skipped when content body is shorter than 50 chars". |
| 6 | File changes in cortex/ directory trigger embedding after 10 minutes of inactivity | VERIFIED | `watcher.ts` lines 35, 147-155: DEBOUNCE_MS=600000, setTimeout fires processBatch after no new changes. 16 watcher tests use vi.useFakeTimers() to confirm debounce behavior. |
| 7 | The watcher ignores non-.md files | VERIFIED | `watcher.ts` line 133: `if (!filename.endsWith('.md')) return;`. Covered by test "ignores non-.md files". |
| 8 | The watcher ignores files currently being written by the embedder (self-trigger prevention) | VERIFIED | `watcher.ts` lines 138, 78-86: inFlightFiles Set checked in watcher callback; file added before embedEntry, removed in finally block. Covered by "ignores files that are currently in the inFlightFiles set". |
| 9 | Running npx tsx scripts/cortex-reembed.ts processes all cortex .md files | VERIFIED | `scripts/cortex-reembed.ts` lines 59-83: glob pattern `${cortexDir}/**/*.md`, sequential embedEntry loop. --force flag passed at line 83. |
| 10 | Running npx tsx scripts/cortex-reembed.ts --force re-embeds all files regardless of hash | VERIFIED | Line 26: `const force = process.argv.includes('--force')`. Passed to `embedEntry(filePath, openai, qdrant, { force })` at line 83. force:true bypasses hash check in embedder (Truth 3). |
| 11 | The watcher starts alongside other services in src/index.ts main() | VERIFIED | `src/index.ts` lines 64, 731-733: import at line 64, `startCortexWatcher(cortexDir).catch(...)` called in main() after startIpcWatcher. |
| 12 | Watcher gracefully degrades if Qdrant is unavailable at startup | VERIFIED | `watcher.ts` lines 119-124: `checkQdrantHealth(qdrant)` — if false, logs warn and returns. Covered by test "does not start watcher when Qdrant health check fails". |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/cortex/qdrant-client.ts` | QdrantClient singleton factory and health check | VERIFIED | 56 lines. Exports `createQdrantClient`, `checkQdrantHealth`, `COLLECTION_NAME='cortex-entries'`. Substantive: retry loop with 2s backoff, 5 attempts. |
| `src/cortex/embedder.ts` | Shared embedEntry() function and EmbedResult type | VERIFIED | 219 lines. Exports `embedEntry`, `EmbedResult`, `createOpenAIClient`, `deterministicId`, `updateFrontmatter`, `EMBEDDING_MODEL`, `MIN_CONTENT_LENGTH`. Full pipeline wired. |
| `src/cortex/embedder.test.ts` | Unit tests for embedder with mocked OpenAI and Qdrant | VERIFIED | 361 lines (min_lines: 80). 15 tests covering all behaviors. All pass. |
| `src/cortex/watcher.ts` | Debounced fs.watch cortex watcher with self-trigger prevention | VERIFIED | 184 lines. Exports `startCortexWatcher`, `stopCortexWatcher`, `DEBOUNCE_MS=600000`, `getInFlightFiles`. |
| `src/cortex/watcher.test.ts` | Unit tests for watcher debounce and filtering | VERIFIED | 328 lines (min_lines: 50). 16 tests. All pass. |
| `scripts/cortex-reembed.ts` | CLI batch re-embed command | VERIFIED | 121 lines. Contains "cortex-reembed" in comment header and output string. --force flag, sequential processing, exit codes. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/cortex/embedder.ts` | `src/cortex/parser.ts` | `import parseCortexEntry` | WIRED | Line 18: `import { parseCortexEntry } from './parser.js'`; called at embedder.ts line 145. |
| `src/cortex/embedder.ts` | `src/cortex/qdrant-client.ts` | `import createQdrantClient` | WIRED | Line 19: `import { COLLECTION_NAME } from './qdrant-client.js'`; used at upsert call. (createQdrantClient injected by callers — DI pattern.) |
| `src/cortex/embedder.ts` | `openai` | `openai.embeddings.create()` | WIRED | Line 13: `import OpenAI from 'openai'`; `openai.embeddings.create(...)` at line 170. |
| `src/cortex/watcher.ts` | `src/cortex/embedder.ts` | `import embedEntry` | WIRED | Line 20: `import { embedEntry, createOpenAIClient } from './embedder.js'`; called at processBatch line 80. |
| `src/cortex/watcher.ts` | `node:fs` | `fs.watch with recursive:true` | WIRED | Line 17: `import { watch } from 'node:fs'`; called at line 128 with `{ recursive: true }`. |
| `src/index.ts` | `src/cortex/watcher.ts` | `import startCortexWatcher` | WIRED | Line 64: `import { startCortexWatcher, stopCortexWatcher }`; startCortexWatcher called line 732, stopCortexWatcher called line 567 in shutdown handler. |
| `scripts/cortex-reembed.ts` | `src/cortex/embedder.ts` | `import embedEntry, createOpenAIClient` | WIRED | Line 18: `import { embedEntry, createOpenAIClient } from '../src/cortex/embedder.js'`; embedEntry called at line 83. |

### Data-Flow Trace (Level 4)

Not applicable for this phase. No UI/rendering components. All artifacts are pipeline functions (embedder, watcher, CLI script) — data flows to/from external services (OpenAI, Qdrant) which cannot be verified without live services. Wiring verified at Level 3.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All cortex unit tests pass | `npx vitest run src/cortex/` | 65 tests passed across 5 files (qdrant-client: 6, embedder: 15, watcher: 16, schema: 23, parser: 5) | PASS |
| openai dep installed | `grep openai package.json` | `"openai": "^6.33.0"` present | PASS |
| @qdrant/js-client-rest dep installed | `grep @qdrant package.json` | `"@qdrant/js-client-rest": "^1.17.0"` present | PASS |
| Commits documented in SUMMARYs exist | `git log 0282abf 6b9019a f021542 5943a01` | All 4 commits found with expected messages | PASS |
| EMBEDDING_MODEL constant is correct | grep in embedder.ts | `EMBEDDING_MODEL = 'text-embedding-3-small'` at line 28 | PASS |
| DEBOUNCE_MS is 10 minutes | grep in watcher.ts | `DEBOUNCE_MS = 600000` at line 35 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| EMBED-01 | 16-01-PLAN.md | Host-side embedding service converts Cortex entries to vectors using OpenAI text-embedding-3-small | SATISFIED | `embedder.ts` calls `openai.embeddings.create({ model: 'text-embedding-3-small' })` and upserts to `cortex-entries`. 15 unit tests confirm pipeline. |
| EMBED-02 | 16-02-PLAN.md | Entries auto-embed on cortex_write (agent-initiated writes trigger re-embedding) | SATISFIED | `watcher.ts` watches cortex/ with 10-minute debounce, wired into `src/index.ts` main process. Note: EMBED-02 description says "cortex_write" but Phase 16 implements the fs.watch trigger; the cortex_write MCP hook is Phase 17. The auto-embed mechanism (shared embedEntry + watcher) is fully in place. |
| EMBED-03 | 16-02-PLAN.md | Batch re-embed command for full collection rebuild | SATISFIED | `scripts/cortex-reembed.ts` globs all cortex .md files, processes sequentially, supports --force flag. |
| EMBED-04 | 16-01-PLAN.md | Content-hash skip logic avoids re-embedding unchanged entries | SATISFIED | `embedder.ts` line 163: hash comparison before OpenAI call. `parseCortexEntry()` provides SHA-256 body hash as `sourceHash`. Test "returns skipped when source_hash matches" confirms skip path. |

No orphaned requirements — all 4 EMBED IDs claimed across plans 16-01 and 16-02 are accounted for and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TODO/FIXME/placeholder comments found | — | — |
| None | — | No stub return values (`return null`, `return []`, `return {}`) found in pipeline functions | — | — |
| None | — | No empty handler implementations found | — | — |

No anti-patterns detected in any phase 16 files.

### Human Verification Required

#### 1. Live OpenAI + Qdrant Integration

**Test:** With OPENAI_API_KEY set in .env and Qdrant running (`docker ps | grep qdrant`), run: `npx tsx scripts/cortex-reembed.ts` against a cortex directory with at least one valid .md file.
**Expected:** Script exits 0. File gains `source_hash` and `embedding_model` fields in its YAML frontmatter. A second run without --force exits 0 with "skipped" count matching file count.
**Why human:** Requires live external services. Cannot verify without running OpenAI and Qdrant.

#### 2. Watcher Debounce in Production

**Test:** Edit a cortex .md file while NanoClaw is running. Wait 10+ minutes without editing any other cortex file. Check nanoclaw logs.
**Expected:** Log line "Cortex watcher: batch complete" appears ~10 minutes after the edit. File frontmatter gains `source_hash` and `embedding_model`.
**Why human:** Real 10-minute timer; cannot fast-forward in production.

### Gaps Summary

No gaps. All 12 observable truths verified programmatically. All 6 artifacts exist, are substantive (no stubs), and are correctly wired. All 4 requirements satisfied. All 65 unit tests pass. The phase goal is achieved.

---

_Verified: 2026-03-30T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
