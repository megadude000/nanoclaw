# Phase 16: Embedding Pipeline - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Host-side service that converts Cortex entries to vectors using OpenAI text-embedding-3-small, with content-hash dedup and batch re-embed. Runs inside the NanoClaw main process. No MCP tools (Phase 17), no Nightshift reconciliation (Phase 21) — just the embedding infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Watch trigger strategy
- **D-01:** Debounced `fs.watch` on `cortex/` directory with a 10-minute debounce window after last detected change. Obsidian editing sessions won't trigger API calls — only after 10 minutes of inactivity do changed files get embedded.
- **D-02:** Batch re-embed command available for manual full collection rebuilds (all entries, ignoring content hash).
- **D-03:** Content-hash skip logic — unchanged entries (matching `source_hash` in frontmatter) are skipped during both watch-triggered and batch operations.

### Pipeline integration
- **D-04:** Embedding pipeline runs inside the NanoClaw main process (started alongside other services in `src/index.ts`). Shares process lifecycle — restart NanoClaw, restart the watcher. Uses existing pino logger.

### API key management
- **D-05:** Host-side embedding uses `OPENAI_API_KEY` from `.env` directly (standard NanoClaw pattern — all keys live in `.env`).
- **D-06:** Container-side query embedding (Phase 17) — containers call OpenAI directly. OneCLI injects `OPENAI_API_KEY` into containers at request time. No host-side embed endpoint needed.

### Claude's Discretion
- Exact `fs.watch` implementation (native `fs.watch` vs chokidar for cross-platform reliability)
- Shared embedding function design (reusable between watch trigger, batch command, and cortex_write trigger in Phase 17)
- Error handling for OpenAI API failures (retry logic, rate limiting)
- Logging verbosity for embedding operations
- Whether to use `openai` npm package or raw `fetch` for the embeddings API call

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/14-cortex-schema-standard/14-CONTEXT.md` — Schema fields: source_hash and embedding_model stored in frontmatter (D-03). Permissive defaults for incomplete entries (D-08).
- `.planning/phases/15-qdrant-infrastructure/15-CONTEXT.md` — Qdrant at `./data/qdrant/`, reachable via `host.docker.internal` (D-01). Payload indexes on cortex_level, domain, project.

### Research findings
- `.planning/research/STACK.md` — openai ^6.33.0, text-embedding-3-small (1536 dims, $0.02/1M tokens), gray-matter ^4.0.3
- `.planning/research/ARCHITECTURE.md` — Host-side embedding pipeline architecture, shared preprocessing function
- `.planning/research/PITFALLS.md` — Embedding model lock-in (carry metadata from day one), content-hash skip logic essential

### Host process patterns
- `src/index.ts` — Main orchestrator where services are started
- `cortex/CLAUDE.md` — API keys single source of truth in `.env`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- pino logger — already in project, use for embedding operation logging
- `.env` loading — existing pattern for API key access
- Zod (Phase 14 schema) — validate frontmatter before embedding

### Established Patterns
- `src/index.ts` orchestrator pattern — services start in sequence, share process lifecycle
- IPC watcher uses file-based polling (not `fs.watch`) — the embedding watcher will be the first `fs.watch` user in the codebase
- `container-runtime.ts` — `host.docker.internal` already handled for container-to-host communication

### Integration Points
- Embedding watcher starts in `src/index.ts` alongside IPC watcher, channel registry, health monitor
- Phase 14 Zod schema validates entries before embedding
- Phase 15 Qdrant client (`@qdrant/js-client-rest`) used for upsert operations
- Phase 17 `cortex_write` MCP tool will call the same embedding function after writing to disk
- Phase 21 Nightshift reconciliation will use the batch re-embed as its re-embedding step

</code_context>

<specifics>
## Specific Ideas

- 10-minute debounce is aggressive but appropriate for a solo developer editing in Obsidian — editing sessions are bursty, and a 10-minute quiet period reliably indicates "done editing"
- The shared embedding function should accept a single file path and handle: parse frontmatter, validate, compute content hash, skip if unchanged, embed via OpenAI, upsert to Qdrant, update frontmatter with source_hash/embedding_model

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-embedding-pipeline*
*Context gathered: 2026-03-28*
