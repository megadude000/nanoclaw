---
cortex_level: L30
confidence: high
domain: nanoclaw
scope: >-
  Full Cortex pipeline architecture - vault file change to Qdrant embedding,
  schema validation, source_hash skip, watcher
project: nanoclaw
tags:
  - nanoclaw
  - cortex
  - pipeline
  - embedding
  - qdrant
  - openai
  - watcher
  - schema
created: 2026-03-31T00:00:00.000Z
source_hash: cf3be6d21d57ea7f689d5982cd0810fc3b72da11bb099862f325b2ed0058b2d5
embedding_model: text-embedding-3-small
---

# Cortex Pipeline — Full Architecture

## Overview

The Cortex pipeline converts vault Markdown files with YAML frontmatter into searchable vector embeddings stored in Qdrant. The pipeline runs continuously: a filesystem watcher triggers re-embedding on every vault file change. The key invariant is that embeddings stay in sync with vault content without requiring manual re-indexing.

## Step 1: Schema Validation (Phase 14)

Every vault file must have valid YAML frontmatter. Two validation modes exist:
- **Strict** (`CortexFieldsStrict`): requires all four fields — `cortex_level`, `confidence`, `domain`, `scope`. Used at write time (cortex_write MCP tool and IPC handler).
- **Permissive** (`CortexFrontmatterPermissive`): applies `inferDefaults()` to fill missing fields from path patterns. Used at read and embedding time for existing vault files.

Path-based inference rules:
- `Session-Logs/` → L50
- `Calendar/Daily/` → L40
- `System/` → L10
- `Areas/Projects/*/` (hub file) → L40
- `Areas/Projects/*/sub-file` → L20
- Default fallback → L10

Source hash: `parseCortexEntry()` computes `SHA-256` of the **body only** (frontmatter excluded). This means changing frontmatter (e.g., updating `updated:` date) does NOT trigger re-embedding. Only body content changes trigger re-embedding. Stored in `source_hash` frontmatter field and checked at embedding time.

## Step 2: Filesystem Watcher (Phase 16-02)

`startCortexWatcher()` in `src/cortex/watcher.ts` uses `fs.watch(cortexDir, { recursive: true })` to monitor the entire vault tree. On any `.md` file change event, it calls `embedEntry(filePath, openai, qdrant)`.

The watcher is started in `index.ts` and stopped cleanly on shutdown. It handles debouncing (multiple rapid changes to the same file result in one embedding call) and suppresses the initial "file modified" event that triggers on startup.

## Step 3: embedEntry() — The Core Function

`embedEntry(filePath, openai, qdrant, options?)` in `src/cortex/embedder.ts` is the single function that orchestrates the full pipeline for one file:

1. Parse the file with gray-matter → extract frontmatter and body
2. Validate frontmatter with permissive schema
3. Content length guard: skip if body < `MIN_CONTENT_LENGTH` (50 chars) — prevents embedding stub files
4. **Source hash skip**: compare `parsedEntry.sourceHash` against `frontmatter.source_hash`. If identical, skip — body hasn't changed. Bypassed with `force: true`.
5. Call `openai.embeddings.create({ model: 'text-embedding-3-small', input: body })` — generates a 1536-dimensional vector
6. Upsert to Qdrant collection `cortex-entries` with point ID = `deterministicId(filePath)` (MD5 of vault-relative path formatted as UUID)
7. Write back `source_hash` and `embedding_model` to frontmatter via `updateFrontmatter()` (gray-matter stringify)

Returns `EmbedResult` discriminated union: `{ status: 'embedded' | 'skipped' | 'error', filePath, reason? }`. Callers aggregate results without throwing.

## Step 4: Qdrant Collection Schema

Collection: `cortex-entries`. Vector: 1536-dim cosine distance. Payload indexes on: `cortex_level`, `domain`, `project`, `status`. These indexes enable filtered searches (e.g., "only L20 entries in the nanoclaw domain").

Each point's payload includes the full frontmatter plus `file_path` (vault-relative). This allows search results to be returned as structured objects, not just file paths.

## Deterministic Point IDs

`deterministicId(filePath)` strips the absolute prefix before `cortex/` (so the vault produces the same IDs regardless of where it's mounted — different machines, different home directories), then computes MD5 of the resulting relative path, formatted as a UUID (8-4-4-4-12). Deterministic IDs make upserts idempotent: re-embedding the same file updates its point rather than creating a duplicate.

## Error Handling

Qdrant unavailability: `checkQdrantHealth(client)` retries 5 times with 2-second backoff. If Qdrant is unreachable at startup, the watcher still starts but embedding calls will fail gracefully (return `{ status: 'error' }`) without crashing the process. The system degrades to a state where files are updated in the vault but not indexed — searches won't find new content until Qdrant reconnects.

OpenAI unavailability: same pattern — embedding calls fail gracefully with error status.
