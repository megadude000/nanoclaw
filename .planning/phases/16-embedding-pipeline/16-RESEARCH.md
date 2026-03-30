# Phase 16: Embedding Pipeline - Research

**Researched:** 2026-03-30
**Domain:** OpenAI Embeddings API + Qdrant vector upsert + fs file watching
**Confidence:** HIGH

## Summary

Phase 16 builds a host-side embedding pipeline that automatically converts Cortex markdown entries into vectors stored in the Qdrant `cortex-entries` collection (deployed in Phase 15). The pipeline has three modes: (1) a debounced fs watcher that detects changes in the `cortex/` directory and embeds after 10 minutes of inactivity, (2) a batch re-embed command for full collection rebuilds, and (3) a shared `embedEntry()` function that Phase 17's `cortex_write` MCP tool will call directly.

All building blocks are in place: Phase 14 delivered Zod schema validation and a gray-matter parser with SHA-256 content hashing. Phase 15 delivered a running Qdrant container with the `cortex-entries` collection (1536-dim cosine, payload indexes on cortex_level/domain/project/status). The remaining work is: OpenAI API integration, Qdrant JS client integration, frontmatter update logic (write source_hash/embedding_model back to files), the fs watcher with debounce, and a CLI batch command.

**Primary recommendation:** Use the `openai` npm package (v6.33.0) for embeddings and `@qdrant/js-client-rest` (v1.17.0) for upserts. Use native `fs.watch` (not chokidar) since this is Linux-only and the 10-minute debounce makes edge-case reliability irrelevant. Keep the shared `embedEntry()` function stateless -- it takes a file path, does everything, returns success/skip/error.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Debounced `fs.watch` on `cortex/` directory with a 10-minute debounce window after last detected change. Obsidian editing sessions won't trigger API calls -- only after 10 minutes of inactivity do changed files get embedded.
- **D-02:** Batch re-embed command available for manual full collection rebuilds (all entries, ignoring content hash).
- **D-03:** Content-hash skip logic -- unchanged entries (matching `source_hash` in frontmatter) are skipped during both watch-triggered and batch operations.
- **D-04:** Embedding pipeline runs inside the NanoClaw main process (started alongside other services in `src/index.ts`). Shares process lifecycle -- restart NanoClaw, restart the watcher. Uses existing pino logger.
- **D-05:** Host-side embedding uses `OPENAI_API_KEY` from `.env` directly (standard NanoClaw pattern -- all keys live in `.env`).
- **D-06:** Container-side query embedding (Phase 17) -- containers call OpenAI directly. OneCLI injects `OPENAI_API_KEY` into containers at request time. No host-side embed endpoint needed.

### Claude's Discretion
- Exact `fs.watch` implementation (native `fs.watch` vs chokidar for cross-platform reliability)
- Shared embedding function design (reusable between watch trigger, batch command, and cortex_write trigger in Phase 17)
- Error handling for OpenAI API failures (retry logic, rate limiting)
- Logging verbosity for embedding operations
- Whether to use `openai` npm package or raw `fetch` for the embeddings API call

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMBED-01 | Host-side embedding service converts Cortex entries to vectors using OpenAI text-embedding-3-small | openai v6.33.0 `embeddings.create()` API, @qdrant/js-client-rest v1.17.0 `upsert()` API |
| EMBED-02 | Entries auto-embed on cortex_write (agent-initiated writes trigger re-embedding) | Shared `embedEntry()` function callable from watch trigger AND directly from Phase 17 cortex_write |
| EMBED-03 | Batch re-embed command for full collection rebuild | CLI script using glob to find all `.md` files in cortex/, calling `embedEntry()` with `force: true` to skip hash check |
| EMBED-04 | Content-hash skip logic avoids re-embedding unchanged entries | `parseCortexEntry()` already computes SHA-256 of body-only; compare against `source_hash` in frontmatter before calling OpenAI |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech Stack**: Node.js, TypeScript, ESM modules
- **Testing**: vitest (already configured, `npm run test`)
- **Linting**: eslint + prettier with husky pre-commit hooks
- **Logger**: Custom pino-like logger at `src/logger.ts` (NOT actual pino -- custom implementation with same API)
- **Env loading**: `readEnvFile()` from `src/env.ts` -- reads `.env` file directly, does NOT use dotenv or process.env injection
- **Service pattern**: Services start in `main()` in `src/index.ts`, share process lifecycle
- **GSD Workflow**: Must use GSD commands for file changes

## Standard Stack

### Core (new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | ^6.33.0 | OpenAI Embeddings API client | Official SDK. Type-safe. Handles retries, rate limiting, streaming. 3M+ weekly downloads. |
| @qdrant/js-client-rest | ^1.17.0 | Qdrant vector DB client | Official JS client. Full TypeScript types. Matches collection setup from Phase 15. |

### Already in project
| Library | Version | Purpose |
|---------|---------|---------|
| gray-matter | ^4.0.3 | YAML frontmatter parsing (Phase 14) |
| zod | ^4.3.6 | Schema validation (Phase 14) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `openai` npm | Raw `fetch` to `https://api.openai.com/v1/embeddings` | Saves ~2MB dependency but loses automatic retry, type safety, rate limit handling. Not worth it for a project that will use OpenAI in multiple phases. |
| chokidar | Native `fs.watch` | Chokidar adds ~1MB, normalizes cross-platform quirks. But NanoClaw is Linux-only and the 10-minute debounce window makes missed/duplicate events harmless. **Recommendation: Use native `fs.watch` with `recursive: true`.** |

**Installation:**
```bash
npm install openai@^6.33.0 @qdrant/js-client-rest@^1.17.0
```

**Version verification:**
- `openai`: 6.33.0 (verified via `npm view openai version` on 2026-03-30)
- `@qdrant/js-client-rest`: 1.17.0 (verified via `npm view @qdrant/js-client-rest version` on 2026-03-30)

## Architecture Patterns

### Recommended Project Structure
```
src/cortex/
├── schema.ts          # (exists) Zod schemas
├── schema.test.ts     # (exists) Schema tests
├── parser.ts          # (exists) gray-matter parser + SHA-256
├── parser.test.ts     # (exists) Parser tests
├── types.ts           # (exists) TypeScript types
├── embedder.ts        # NEW: shared embedEntry() function
├── embedder.test.ts   # NEW: embedder unit tests
├── watcher.ts         # NEW: fs.watch with 10-min debounce
├── watcher.test.ts    # NEW: watcher unit tests
└── qdrant-client.ts   # NEW: Qdrant client singleton + upsert helpers
scripts/
└── cortex-reembed.ts  # NEW: batch re-embed CLI command
```

### Pattern 1: Shared Embed Function (Core)
**What:** A stateless function that takes a file path and handles the full embed pipeline: parse -> validate -> hash check -> embed -> upsert -> update frontmatter.
**When to use:** Called from watcher (on file change), batch command (on all files), and Phase 17 cortex_write (after disk write).
**Example:**
```typescript
// src/cortex/embedder.ts
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { parseCortexEntry } from './parser.js';
import { readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import { logger } from '../logger.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const COLLECTION = 'cortex-entries';

export interface EmbedResult {
  status: 'embedded' | 'skipped' | 'error';
  filePath: string;
  reason?: string;
}

export async function embedEntry(
  filePath: string,
  openai: OpenAI,
  qdrant: QdrantClient,
  options?: { force?: boolean },
): Promise<EmbedResult> {
  // 1. Parse entry
  const entry = parseCortexEntry(filePath, 'permissive');
  if (!entry.validation.valid) {
    return { status: 'error', filePath, reason: entry.validation.errors.join(', ') };
  }

  // 2. Content-hash skip (unless force)
  if (!options?.force && entry.frontmatter.source_hash === entry.sourceHash) {
    return { status: 'skipped', filePath, reason: 'content unchanged' };
  }

  // 3. Embed via OpenAI
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: entry.content,
  });
  const vector = response.data[0].embedding;

  // 4. Upsert to Qdrant
  const pointId = deterministicId(filePath);  // stable ID from file path
  await qdrant.upsert(COLLECTION, {
    wait: true,
    points: [{
      id: pointId,
      vector,
      payload: {
        file_path: filePath,
        cortex_level: entry.validation.data.cortex_level,
        confidence: entry.validation.data.confidence,
        domain: entry.validation.data.domain,
        scope: entry.validation.data.scope,
        source_hash: entry.sourceHash,
        embedding_model: EMBEDDING_MODEL,
        // Also store project and status for filtering
        project: entry.frontmatter.project || entry.validation.data.domain,
        status: entry.frontmatter.status || 'active',
      },
    }],
  });

  // 5. Update frontmatter with source_hash and embedding_model
  updateFrontmatter(filePath, {
    source_hash: entry.sourceHash,
    embedding_model: EMBEDDING_MODEL,
  });

  return { status: 'embedded', filePath };
}
```

### Pattern 2: Deterministic Point ID from File Path
**What:** Convert a cortex file path to a stable Qdrant point ID (unsigned 64-bit integer or UUID string).
**When to use:** Every upsert must use the same ID for the same file so updates overwrite, not duplicate.
**Example:**
```typescript
import { createHash } from 'node:crypto';

// Qdrant supports string UUIDs as point IDs
function deterministicId(filePath: string): string {
  // Use relative path from cortex/ root for stability
  const relative = filePath.replace(/^.*cortex\//, '');
  const hash = createHash('md5').update(relative).digest('hex');
  // Format as UUID v4-like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}
```

### Pattern 3: Debounced File Watcher
**What:** `fs.watch` on `cortex/` with a 10-minute inactivity debounce. Collects changed file paths in a Set, processes after quiet period.
**When to use:** Runs in the NanoClaw main process, started from `src/index.ts`.
**Example:**
```typescript
import { watch } from 'node:fs';
import { logger } from '../logger.js';

const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes

export function startCortexWatcher(
  cortexDir: string,
  onBatch: (changedFiles: string[]) => Promise<void>,
): void {
  const changedFiles = new Set<string>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = watch(cortexDir, { recursive: true }, (event, filename) => {
    if (!filename || !filename.endsWith('.md')) return;

    const fullPath = path.join(cortexDir, filename);
    changedFiles.add(fullPath);

    // Reset debounce timer
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const files = [...changedFiles];
      changedFiles.clear();
      logger.info({ count: files.length }, 'Cortex watcher: processing changed files');
      await onBatch(files);
    }, DEBOUNCE_MS);
  });

  logger.info({ dir: cortexDir }, 'Cortex watcher started');
}
```

### Pattern 4: Frontmatter Update (Write Back)
**What:** After embedding, write `source_hash` and `embedding_model` back into the file's YAML frontmatter without disturbing other fields or body content.
**When to use:** After successful OpenAI embed + Qdrant upsert.
**Example:**
```typescript
import matter from 'gray-matter';
import { readFileSync, writeFileSync } from 'node:fs';

function updateFrontmatter(
  filePath: string,
  updates: Record<string, string>,
): void {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  Object.assign(data, updates);
  const updated = matter.stringify(content, data);
  writeFileSync(filePath, updated, 'utf-8');
}
```

### Anti-Patterns to Avoid
- **Embedding on every file save:** Obsidian auto-saves frequently. The 10-minute debounce is intentional -- do NOT reduce it.
- **Hashing the full file (frontmatter + body):** The parser already hashes body-only (Phase 14 decision). Writing source_hash back to frontmatter would change the full-file hash, creating an infinite re-embed loop.
- **Creating a new Qdrant point per embed:** Must use deterministic IDs so re-embeds update existing points, not create duplicates.
- **Blocking the main process:** OpenAI API calls are async. The watcher callback must not block the event loop. Use `Promise.allSettled` for batch processing with concurrency control.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI API client | Custom fetch wrapper | `openai` npm package | Handles retries, rate limits, streaming, error types. 50+ edge cases. |
| Qdrant operations | Raw HTTP to localhost:6333 | `@qdrant/js-client-rest` | Type-safe point operations, connection pooling, error handling. |
| YAML frontmatter parsing | Regex extraction | `gray-matter` (already installed) | Handles edge cases (multi-line values, special chars, empty frontmatter). |
| Content hashing | Custom implementation | `parseCortexEntry()` (already built) | Phase 14 already delivers SHA-256 of body-only content. |
| UUID generation | npm uuid package | MD5 hash formatted as UUID | Deterministic from file path, no extra dependency, only need uniqueness not cryptographic security. |

## Common Pitfalls

### Pitfall 1: Frontmatter Write Triggers Watcher Re-fire
**What goes wrong:** Updating `source_hash` in frontmatter triggers another `fs.watch` event, which adds the file back to the change set, causing a second (unnecessary) embed cycle.
**Why it happens:** `fs.watch` fires on any file write, including our own frontmatter updates.
**How to avoid:** Track files currently being written by the embedder in a `Set<string>`. In the watcher callback, skip files that are in this "in-flight" set. Clear from set after write completes.
**Warning signs:** The same file appears in consecutive batch runs despite no user edits.

### Pitfall 2: OpenAI Rate Limiting During Batch Re-embed
**What goes wrong:** Batch re-embedding 100+ files at once hits OpenAI rate limits (RPM or TPM).
**Why it happens:** `text-embedding-3-small` has rate limits based on tier. Tier 1 (default) allows 500 RPM.
**How to avoid:** Process files sequentially or with a small concurrency limit (e.g., 5 concurrent). The `openai` package has built-in retry with exponential backoff for 429 responses.
**Warning signs:** `429 Too Many Requests` errors in logs.

### Pitfall 3: Empty or Minimal Content Files
**What goes wrong:** Embedding files with only frontmatter and no body content (or very short body) produces meaningless vectors.
**Why it happens:** Template files, stub entries, or files with only YAML frontmatter.
**How to avoid:** Skip files where `content.trim().length < 50` (configurable threshold). Log as warning, don't error.
**Warning signs:** Search results return irrelevant stub entries.

### Pitfall 4: fs.watch recursive option on Linux
**What goes wrong:** `{ recursive: true }` for `fs.watch` was not supported on Linux until Node.js v19.1.0.
**Why it happens:** Linux inotify requires per-directory watches; `recursive` was only supported on macOS/Windows.
**How to avoid:** Project requires Node.js >= 20 (verified in package.json `engines` field), so `recursive: true` IS supported. No workaround needed.
**Warning signs:** Watcher only catches changes in root `cortex/` directory, not subdirectories.

### Pitfall 5: gray-matter.stringify Reorders/Reformats YAML
**What goes wrong:** `matter.stringify()` may reorder YAML keys, change quoting style, or alter formatting compared to the original file.
**Why it happens:** gray-matter serializes the data object to YAML, which may not preserve original formatting.
**How to avoid:** Accept the reformatting -- Obsidian handles it fine. Or use a targeted string replacement approach that only modifies the specific keys being updated. Test with a few real vault files to verify output is acceptable.
**Warning signs:** Large git diffs on files that only had source_hash added.

### Pitfall 6: Qdrant Unreachable at Startup
**What goes wrong:** Embedding pipeline starts but Qdrant container isn't ready yet.
**Why it happens:** systemd service ordering or Docker startup delay.
**How to avoid:** Health check loop at startup (retry `GET /healthz` with backoff, max 30s). Log warning and disable watcher if Qdrant is unavailable rather than crashing.
**Warning signs:** Connection refused errors on first embed attempt.

## Code Examples

### OpenAI Embeddings API Call
```typescript
// Source: openai npm package v6.33.0 README + API reference
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: readEnvFile(['OPENAI_API_KEY']).OPENAI_API_KEY,
});

const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'The quick brown fox jumps over the lazy dog',
});

// response.data[0].embedding is number[] with 1536 dimensions
const vector: number[] = response.data[0].embedding;
// response.usage.total_tokens tells you the cost
```

### Qdrant Upsert with Full Payload
```typescript
// Source: @qdrant/js-client-rest v1.17.0 + Qdrant quickstart docs
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

await qdrant.upsert('cortex-entries', {
  wait: true,
  points: [{
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  // deterministic UUID from path
    vector: embeddings,  // number[1536]
    payload: {
      file_path: 'Areas/Projects/NanoClaw/architecture.md',
      cortex_level: 'L20',
      confidence: 'medium',
      domain: 'nanoclaw',
      scope: 'architecture overview',
      project: 'nanoclaw',
      status: 'active',
      source_hash: 'abc123...',
      embedding_model: 'text-embedding-3-small',
    },
  }],
});
```

### Initializing OpenAI Client with readEnvFile
```typescript
// Follow existing NanoClaw pattern for API key loading
import { readEnvFile } from '../env.js';
import OpenAI from 'openai';

function createOpenAIClient(): OpenAI {
  const env = readEnvFile(['OPENAI_API_KEY']);
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in .env -- required for embedding pipeline');
  }
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}
```

### Batch Re-embed Script
```typescript
// scripts/cortex-reembed.ts
import { glob } from 'node:fs/promises';
import { embedEntry, createClients } from '../src/cortex/embedder.js';
import { logger } from '../src/logger.js';

const force = process.argv.includes('--force');
const { openai, qdrant } = createClients();

// Node.js 22 has built-in glob via fs/promises
const files: string[] = [];
for await (const f of glob('cortex/**/*.md')) {
  files.push(f);
}

let embedded = 0, skipped = 0, errors = 0;
for (const file of files) {
  const result = await embedEntry(file, openai, qdrant, { force });
  if (result.status === 'embedded') embedded++;
  else if (result.status === 'skipped') skipped++;
  else errors++;
  logger.info({ file, ...result }, 'Embed result');
}

logger.info({ embedded, skipped, errors, total: files.length }, 'Batch re-embed complete');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.watch` no recursive on Linux | `fs.watch({ recursive: true })` on Linux | Node.js v19.1 (Nov 2022) | Can use native fs.watch instead of chokidar for recursive watching on Linux |
| openai npm v3.x | openai npm v6.x | 2025 | New SDK structure, `new OpenAI()` constructor, `openai.embeddings.create()` method |
| chokidar v3 (CommonJS) | chokidar v5 (ESM-only, Node>=20) | Nov 2025 | If using chokidar, must use v5 for ESM compatibility |
| text-embedding-ada-002 | text-embedding-3-small | Jan 2024 | Better performance, same 1536 dims, lower cost ($0.02/1M tokens) |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest v4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/cortex/` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMBED-01 | embedEntry() calls OpenAI and upserts to Qdrant | unit (mocked) | `npx vitest run src/cortex/embedder.test.ts -t "embeds entry"` | Wave 0 |
| EMBED-02 | Watch trigger calls embedEntry() on file change | unit (mocked) | `npx vitest run src/cortex/watcher.test.ts -t "triggers embed"` | Wave 0 |
| EMBED-03 | Batch command processes all cortex files | unit (mocked) | `npx vitest run src/cortex/embedder.test.ts -t "batch"` | Wave 0 |
| EMBED-04 | Unchanged content hash skips embedding | unit | `npx vitest run src/cortex/embedder.test.ts -t "skips unchanged"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/cortex/`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/cortex/embedder.test.ts` -- covers EMBED-01, EMBED-03, EMBED-04 (mock OpenAI + Qdrant)
- [ ] `src/cortex/watcher.test.ts` -- covers EMBED-02 (mock fs.watch, verify debounce)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.22.2 | -- |
| Qdrant | Vector storage | Yes | Running (nanoclaw-qdrant) | -- |
| Docker | Qdrant container | Yes | Running | -- |
| OPENAI_API_KEY | Embedding API | Assumed (in .env) | -- | Cannot embed without it |
| openai npm | EMBED-01 | Not installed | -- | npm install |
| @qdrant/js-client-rest npm | EMBED-01 | Not installed | -- | npm install |

**Missing dependencies with no fallback:**
- `OPENAI_API_KEY` must be present in `.env` -- embedding cannot work without it. Should log clear error at startup.

**Missing dependencies with fallback:**
- None. `openai` and `@qdrant/js-client-rest` are straightforward npm installs.

## Open Questions

1. **gray-matter.stringify formatting behavior**
   - What we know: gray-matter can reformat YAML when stringifying back
   - What's unclear: How much it changes formatting for typical Obsidian vault files
   - Recommendation: Test with 2-3 real vault files during implementation. If formatting changes are excessive, use targeted regex replacement for source_hash/embedding_model only.

2. **Minimum content length threshold**
   - What we know: Embedding very short content (< 50 chars) produces low-quality vectors
   - What's unclear: Exact threshold for "useful" embeddings with text-embedding-3-small
   - Recommendation: Start with 50-char minimum, make it configurable. Log skipped files.

3. **Watcher self-trigger prevention**
   - What we know: Writing source_hash back to frontmatter will trigger fs.watch
   - What's unclear: Whether the 10-minute debounce is sufficient to prevent unnecessary cycles
   - Recommendation: Maintain an in-flight Set of files being written by the embedder. Skip those in the watcher callback. This is more robust than relying on debounce alone.

## Sources

### Primary (HIGH confidence)
- npm registry: `openai@6.33.0` -- verified version 2026-03-30
- npm registry: `@qdrant/js-client-rest@1.17.0` -- verified version 2026-03-30
- [Qdrant quickstart](https://qdrant.tech/documentation/quickstart/) -- JS client usage patterns
- [openai-node GitHub](https://github.com/openai/openai-node) -- embeddings.create() API

### Secondary (MEDIUM confidence)
- [Vite issue #12495](https://github.com/vitejs/vite/issues/12495) -- fs.watch recursive support on Linux confirmed for Node >= 19.1
- [chokidar GitHub](https://github.com/paulmillr/chokidar) -- v5 ESM-only, Node >= 20

### Tertiary (LOW confidence)
- OpenAI rate limits for text-embedding-3-small: 500 RPM for Tier 1 (needs verification against actual account tier)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- npm versions verified, APIs well-documented, official SDKs
- Architecture: HIGH -- builds directly on Phase 14/15 code with clear integration points
- Pitfalls: MEDIUM -- fs.watch self-trigger and gray-matter formatting need validation during implementation

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable libraries, unlikely to change)
