# Project Research Summary

**Project:** Agent Cortex Intelligence (NanoClaw v3.0)
**Domain:** Queryable knowledge layer for autonomous AI agents — vector search, embedding pipelines, MCP tools, knowledge graphs, automated reconciliation
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH

## Executive Summary

NanoClaw v3.0 adds a persistent, queryable knowledge layer (Cortex) that autonomous agents can search before every task, read for full context, and write to after completing work. This is not a documentation system — it is a self-reinforcing feedback loop: agents produce knowledge, Cortex stores it, future agents consume it. The recommended architecture is a host-side embedding pipeline feeding a local Qdrant vector DB, with three MCP tools (`cortex_search`, `cortex_read`, `cortex_write`) extending the existing MCP server inside containers. Everything is built on top of NanoClaw's proven patterns: IPC for writes, Docker for infrastructure, SQLite for metadata, Obsidian for human access.

The recommended stack adds exactly three npm packages to the project: `@qdrant/js-client-rest` for the vector DB client, `openai` for embedding generation via `text-embedding-3-small`, and `gray-matter` for frontmatter parsing. Qdrant runs as a Docker container managed by systemd — the same pattern already used by NanoClaw itself. The embedding cost is negligible ($0.02/1M tokens, under $0.01/month for a personal vault of ~200 files). This keeps the dependency footprint minimal and the operational model consistent with what already exists in the project.

The key risk is building too much at once. Research is clear that knowledge schema must be locked before the first vector is stored (schema changes require re-bootstrapping everything), Qdrant data persistence must be configured on day one (not retrofitted), and the initial MCP surface must stay at exactly 3 tools (agent tool confusion degrades rapidly past 11-12 total tools). The recommended phase structure sequences infrastructure before pipelines before tools before content — respecting hard technical dependencies that will cause expensive rebuilds if violated.

## Key Findings

### Recommended Stack

The existing NanoClaw stack needs only three new packages. `@qdrant/js-client-rest` v1.17.0 is the official TypeScript SDK, REST-only (no gRPC native deps), adequate for sub-10K vectors on a single server. `openai` v6.33.0 generates embeddings via `text-embedding-3-small` (1536 dimensions) — API-based is preferred over local ONNX/Ollama because cost is negligible, no native deps complicate Docker builds, and the API key infrastructure already exists through OneCLI. `gray-matter` v4.0.3 handles Obsidian frontmatter extraction (5M+ weekly downloads, the de facto standard).

MCP SDK bumps from `^1.12.1` to `^1.28.0` in container agent-runner. Qdrant runs as `qdrant/qdrant:v1.17.x` Docker container on the host, same pattern as NanoClaw. LangChain, LlamaIndex, fastembed, and any ORM are explicitly excluded — they add 50+ transitive dependencies for functionality achievable in under 200 lines of direct SDK calls.

**Core technologies:**
- `@qdrant/js-client-rest` v1.17.0: Vector DB client — REST, no native deps, TypeScript-native
- `openai` v6.33.0: Embedding generation — API-based, negligible cost, no GPU/model downloads
- `gray-matter` v4.0.3: Frontmatter parsing — de facto standard, handles edge cases
- Qdrant Docker `v1.17.x`: Vector storage — zero-cost, Docker-native, persistent with volume mount
- `@modelcontextprotocol/sdk` bumped to `^1.28.0`: MCP server extension in container agent-runner

### Expected Features

**Must have (table stakes):**
- `cortex_search` MCP tool — semantic search with project/level filtering, <50ms from Qdrant local
- `cortex_read` MCP tool — exact entry retrieval by path, direct filesystem read from container mount
- `cortex_write` MCP tool — create/update entries with auto-embed via IPC write path
- Cortex schema standard — YAML frontmatter with `cortex_level` (L10-L50), `confidence`, `domain`, `scope`, `source_hash`, `embedding_model` fields
- Qdrant local Docker deployment — `cortex-entries` collection, persistent volume, port 6333
- Embedding pipeline — OpenAI API, embed on write + nightly reconciliation catchall, content-hash dedup
- Bootstrap L10-L20 for NanoClaw — programmatic extraction from `src/*.ts`, ~50-100 initial entries
- Agent auto-query at task start — container CLAUDE.md instruction, no code change needed

**Should have (differentiators):**
- `cortex-graph.json` — explicit BUILT_FROM/REFERENCES/BLOCKS/CROSS_LINK edges in JSON adjacency list
- `cortex_relate` MCP tool — agents declare edges between entries
- Lore Protocol — git trailer knowledge atoms (Constraint/Rejected/Directive), indexed as type `lore-atom`
- Hybrid search routing — vault lookup for exact queries, Qdrant for natural language
- Confidence firewall — L(N) entries gate on L(N-1) completeness
- Nightshift reconciliation — nightly staleness cascade, CROSS_LINK auto-discovery, orphan cleanup

**Defer (v2+):**
- Multi-project bootstrap (YourWave, ContentFactory, NightShift) — after NanoClaw Cortex is end-to-end proven
- L30-L50 population — requires L10-L20 foundation and confidence firewall working
- CROSS_LINK auto-discovery — needs sufficient entry count for meaningful similarity pairs
- Staleness cascade automation — only meaningful weeks/months after bootstrap

**Anti-features to reject:**
- Full graph database (Neo4j) — absurd overhead for ~200 files; a JSON file handles it trivially
- Local embedding models (Ollama/FastEmbed) — ONNX native deps, model downloads, zero practical benefit
- Real-time embedding on file save — Obsidian saves on keystrokes; use write-trigger + nightly catchall
- RAG chunk splitting — Cortex entries are already atomic by design; splitting destroys the knowledge pyramid
- Obsidian web UI replacement — Obsidian is the human interface; MCP tools are the agent interface

### Architecture Approach

The architecture follows a strict host-side/container-side split: all stateful services (Qdrant, embedding pipeline) run on the host and persist across container lifecycles; agents get lightweight MCP tools inside containers that make HTTP calls to host services. Cortex writes from containers follow the existing IPC pattern — agent writes an IPC file, host picks it up, writes to `cortex/` filesystem, `fs.watch` triggers re-embedding. The `cortex/` directory is mounted read-only inside containers, enforcing write authorization through IPC. This reuses five proven NanoClaw patterns (Docker, IPC, MCP, scheduled tasks, systemd) with zero novel infrastructure choices.

**Major components:**
1. **Qdrant Docker container** — vector storage at `localhost:6333`, persistent via `./data/qdrant` bind mount, systemd service
2. **Cortex embedder** (`src/cortex-embedder.ts`) — host-side `fs.watch` on `cortex/`, heading-aware chunking (~500 tokens), content-hash skip logic, OpenAI API upsert to Qdrant
3. **Cortex MCP tools** — 3 tools added to existing `ipc-mcp-stdio.ts`; `cortex_search` embeds query via OpenAI API, `cortex_read` reads from `/workspace/cortex/` mount, `cortex_write` writes IPC file
4. **cortex-graph.json** — JSON adjacency list at `cortex/cortex-graph.json`, loaded into memory by MCP server, updated by reconciler
5. **Nightshift reconciler** — container skill, scheduled via existing `task-scheduler.ts`, 4 steps: re-embed changes, staleness cascade, CROSS_LINK discovery, orphan cleanup
6. **Knowledge bootstrap** — one-time scripts to populate L10-L20 entries from existing NanoClaw codebase

### Critical Pitfalls

1. **Embedding model lock-in without version tracking** — Store `embedding_model`, `model_version`, and `text_checksum` in every Qdrant payload point from day one. Changing models without this requires deleting and re-embedding the entire collection with no way to detect the mismatch.

2. **Qdrant Docker volume loss on container rebuild** — Configure `./data/qdrant:/qdrant/storage` bind mount in the initial docker-compose/systemd setup before any data is ingested. The project's habit of rebuilding containers will silently destroy the entire index without this.

3. **Schema change after bootstrap begins** — Finalize the YAML frontmatter standard before the first vector is stored. Changing schema fields requires re-bootstrapping every entry. This is the single highest-cost pitfall and the primary ordering constraint.

4. **MCP tool explosion** — Stay at exactly 3 Cortex tools (search/read/write). NanoClaw already has 8 MCP tools; 3 more brings total to 11, which is manageable. Every additional tool degrades agent tool-selection accuracy. All graph management, staleness, and validation should be host-side nightshift operations.

5. **Bootstrap scope creep** — Bootstrap NanoClaw first, validate the full pipeline end-to-end, then tackle additional projects as explicitly separate phase tasks. Bootstrapping all four projects simultaneously with an unproven schema guarantees a re-do.

## Implications for Roadmap

The dependency graph from research is unambiguous: Schema before Qdrant before Embeddings before MCP tools before Bootstrap before Nightshift. Lore Protocol is independent and can be inserted after Phase 3 or deferred further. Each phase unblocks the next with no opportunity to safely reorder.

### Phase 1: Cortex Schema Standard
**Rationale:** Schema fields are the foundation every other component depends on. Changing them after vectors are stored requires full re-embedding — the highest recovery cost of any pitfall. This must be locked before a single vector is written.
**Delivers:** YAML frontmatter spec with `cortex_level` (L10-L50), `confidence`, `domain`, `scope`, `source_hash`, `embedding_model` fields. Validation rules for reconciler. Knowledge pyramid TTL definitions (L10=stable, L20=months, L30=weeks, L40=days, L50=hours).
**Addresses:** Cortex schema standard (table stakes), `source_hash` and `embedding_model` metadata for staleness and model tracking
**Avoids:** Schema change after bootstrap (HIGH recovery cost pitfall), embedding model lock-in (metadata fields defined here)

### Phase 2: Qdrant Infrastructure
**Rationale:** Qdrant must be running and persistent before the embedding pipeline can be built. Persistence configuration, HNSW index, and payload indexes on `project`/`status`/`level` must be correct from the start — these cannot be retrofitted to an existing collection without recreation.
**Delivers:** Qdrant Docker container with systemd user service, `cortex-entries` collection with cosine distance metric, HNSW index, payload indexes, `./data/qdrant` bind-mount storage, Qdrant snapshot scheduled task.
**Uses:** `qdrant/qdrant:v1.17.x`, `@qdrant/js-client-rest` v1.17.0
**Avoids:** Qdrant data loss on container rebuild (Critical Pitfall 2), wrong distance metric (cannot change on existing collection), missing payload indexes (performance degrades linearly past 5K entries with filtered queries)

### Phase 3: Embedding Pipeline
**Rationale:** The host-side pipeline must exist and be proven before MCP tools can depend on it. Both ingest-time and query-time preprocessing must share a single `prepareTextForEmbedding()` function — defined here, reused in Phase 4.
**Delivers:** `src/cortex-embedder.ts` — `fs.watch` on `cortex/`, heading-aware chunking (~500 tokens with title context prepended), MD5 hash skip logic, OpenAI API batch embedding, Qdrant upsert with full payload metadata. Shared `prepareTextForEmbedding(text, 'document' | 'query')` function. Integration into `src/index.ts` startup. Exponential backoff + checkpoint for bootstrap-scale ingestion.
**Uses:** `openai` v6.33.0, `gray-matter` v4.0.3, `@qdrant/js-client-rest`
**Avoids:** Asymmetric preprocessing (Critical Pitfall 5 — both paths use the shared function), full re-embedding on reconciliation (content-hash skip logic), API rate limits during bootstrap (batch calls + checkpoint resume)

### Phase 4: Cortex MCP Tools
**Rationale:** Agents cannot access Cortex until tools exist inside containers. Three tools maximum — firm limit enforced by research on MCP tool count and agent selection accuracy. Hybrid search routing (exact vs. semantic query detection) ships here as part of the query path.
**Delivers:** `cortex_search`, `cortex_read`, `cortex_write` added to `container/agent-runner/src/ipc-mcp-stdio.ts`. Read-only `cortex/` container mount in `container-runner.ts`. `QDRANT_URL` env var injected via container-runner. IPC handler for `cortex_write` in `src/ipc.ts`. MCP SDK bumped to `^1.28.0`. Confidence firewall enforcement in `cortex_write`.
**Implements:** Cortex MCP server, hybrid search routing, confidence firewall
**Avoids:** MCP tool explosion (total count stays at 11 max), agent directly writing to cortex filesystem (IPC-only write path), `host.docker.internal` on Linux requires `--add-host host.docker.internal:host-gateway` flag

### Phase 5: Knowledge Bootstrap (NanoClaw Only)
**Rationale:** An empty Cortex is useless. Bootstrap NanoClaw first and validate the full pipeline end-to-end — agent queries bootstrapped knowledge, gets a correct useful answer — before expanding scope. Agent auto-query wired only after bootstrap delivers useful results.
**Delivers:** L10-L20 entries for NanoClaw (`src/*.ts` exports, IPC contracts, env vars, channel interfaces, ~50-100 entries). Agent auto-query instruction added to container CLAUDE.md. End-to-end smoke test: agent in a container calls `cortex_search` and returns a relevant bootstrapped entry.
**Addresses:** Bootstrap L10-L20 (table stakes), agent auto-query at task start (table stakes)
**Avoids:** Bootstrap scope creep (Critical Pitfall 7) — YourWave/NightShift/ContentFactory are explicitly deferred

### Phase 6: cortex-graph.json and Knowledge Relationships
**Rationale:** Graph edges add the "connections" dimension after agents have real entries to connect. JSON file handles current scale (<500 entries, <2000 edges) with no database overhead. `cortex_relate` is the fourth MCP tool, bringing total to 12 — still within acceptable range.
**Delivers:** `cortex/cortex-graph.json` schema (nodes + typed edges). `cortex_relate` MCP tool. Graph loaded into memory at MCP server startup (not disk I/O per search). `cortex_search` returns 1-hop neighbors alongside search results. Edge types: BUILT_FROM, REFERENCES, BLOCKS, CROSS_LINK, SUPERSEDES. Migration threshold defined: >500 edges moves to SQLite.
**Avoids:** Full graph database overhead, unbounded JSON file growth (threshold defined upfront)

### Phase 7: Lore Protocol
**Rationale:** Git trailer knowledge atoms are independent of Qdrant but benefit from the embedding pipeline being proven. Confidence on specific "Lore Protocol" CLI is LOW — use git native trailer convention first, adopt external CLI only if it proves installable.
**Delivers:** Git commit trailer convention (Constraint/Rejected/Directive) documented in CLAUDE.md with good vs. bad examples. Nightshift parser using `git log --format='%(trailers:key=Constraint)'`. Lore atoms indexed in Qdrant as type `lore-atom`. Quality validation in reconciler (>70% of atoms must have non-empty Rejected/Constraint fields — rubber-stamped atoms excluded).
**Avoids:** Low-quality rubber-stamped atoms (Critical Pitfall 6) — trailers required only for architectural decisions, not routine commits

### Phase 8: Nightshift Reconciliation
**Rationale:** Autonomous maintenance is the capstone — requires schema, Qdrant, embedder, and graph all stable. Ships last because it maintains infrastructure; maintaining infrastructure that is still being built is meaningless.
**Delivers:** Container skill at `container/skills/cortex-reconcile/`. Nightly 4-step pipeline wired into `task-scheduler.ts`: (1) re-embed changed files (content-hash comparison), (2) staleness cascade (compare `source_hash` against current file hashes, flag changed entries as `status: stale`), (3) CROSS_LINK discovery (cosine similarity > 0.85 threshold, propose new edges), (4) orphan cleanup (missing frontmatter, broken references). Qdrant snapshot in same task. Summary report to #agents channel (3-5 lines max).
**Addresses:** Knowledge staleness (Critical Pitfall 4), Nightshift reconciliation (differentiator), CROSS_LINK auto-discovery

### Phase 9+: Multi-Project Bootstrap
**Rationale:** Defer until NanoClaw Cortex is end-to-end proven through nightshift. Each additional project (YourWave, ContentFactory, NightShift) is a separate phase task with its own L10-L20 extraction scripts and schema validation.
**Delivers:** L10-L20 entries per project. Payload filtering by `project` field. Separate per-project bootstrap scripts.

### Phase Ordering Rationale

- **Schema before everything:** Changing schema fields after vectors exist requires full re-bootstrap. Non-negotiable first position. This is the single highest-cost pitfall.
- **Qdrant before embedder:** Embedder needs a running collection to upsert into. Persistence and index configuration must be correct before any data enters.
- **Embedder before MCP tools:** `cortex_search` needs pre-embedded vectors; the shared `prepareTextForEmbedding()` function must exist before the query path is built.
- **MCP tools before bootstrap:** Bootstrap validation requires running `cortex_search` from inside an agent container — without tools, there is nothing to validate against.
- **Bootstrap before graph:** Meaningful edges require real entries. Empty graph adds no value.
- **Lore after pipeline proven:** Git trailer indexing is lower priority and risks quality debt if rushed before core is solid.
- **Nightshift last:** Autonomous maintenance of infrastructure that is still being built is counterproductive.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Embedding Pipeline):** `fs.watch` reliability on Linux with inotify limits at large file counts; OpenAI API batch size limits and rate limit handling during bootstrap ingestion (3000 RPM limit for text-embedding-3-small)
- **Phase 4 (MCP Tools):** `host.docker.internal` on Linux requires `--add-host host.docker.internal:host-gateway` flag — verify against actual `container-runner.ts` implementation before assuming networking works
- **Phase 7 (Lore Protocol):** Specific "Lore Protocol" CLI tool existence is LOW confidence; validate `git log --format='%(trailers)'` parsing reliability before writing integration code; may be convention-only with no CLI
- **Phase 8 (Nightshift):** CROSS_LINK discovery performance — pairwise similarity comparison at scale requires Qdrant batch query strategy; needs scoping against actual entry count before implementation

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema):** Pure convention definition — no code, no external dependencies
- **Phase 2 (Qdrant Setup):** Well-documented Docker deployment, official systemd patterns, Qdrant docs are comprehensive
- **Phase 5 (Bootstrap):** Standard TypeScript AST/source parsing with existing project tooling
- **Phase 6 (Graph):** JSON file management — trivial, well-understood pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages version-verified via `npm view`. Qdrant Docker confirmed. OpenAI pricing confirmed Feb 2026. No speculative choices. |
| Features | MEDIUM-HIGH | Feature list grounded in SEED-001 design document and comparable systems analysis. MVP scope is clear. Lore Protocol specific CLI availability is LOW confidence. |
| Architecture | HIGH | Host/container split pattern is a direct extension of existing NanoClaw patterns. IPC write path, Docker mounts, MCP server extension — all follow proven code at known file paths. Scalability analysis realistic for vault size. |
| Pitfalls | MEDIUM-HIGH | Embedding drift, Qdrant persistence, MCP tool count — verified from production RAG pipeline analysis and MCP research papers. Lore quality pitfall sourced from the Lore arxiv paper itself. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Lore Protocol CLI existence:** Research could not verify the "Lore Protocol" CLI tool referenced in SEED-001. Implement git trailer convention natively first (`git log --format='%(trailers)'`); adopt CLI only if it materializes as an installable package during Phase 7 planning.
- **`host.docker.internal` on Linux:** This Docker hostname is reliable on macOS but requires explicit `--add-host host.docker.internal:host-gateway` configuration on Linux. Phase 4 must verify this against the actual deployment environment before container networking is assumed to work.
- **Qdrant cosine vs dot product for text-embedding-3-small:** The model's outputs are L2-normalized, making cosine and dot product equivalent — but this must be confirmed during Phase 2 before creating the collection. Wrong distance metric cannot be changed on an existing collection without recreation.
- **Multi-project collection strategy:** Current recommendation is single collection with `project` payload filter. If cross-project contamination in search results is observed during Phase 5, separate per-project collections may be needed. Validate empirically rather than pre-architecting.

## Sources

### Primary (HIGH confidence)
- [@qdrant/js-client-rest npm](https://www.npmjs.com/package/@qdrant/js-client-rest) — v1.17.0, TypeScript SDK, version confirmed
- [Qdrant Docker Hub](https://hub.docker.com/r/qdrant/qdrant) — container deployment, persistence configuration
- [Qdrant Quickstart](https://qdrant.tech/documentation/quickstart/) — REST API, collection setup, HNSW index
- [Qdrant Snapshots Documentation](https://qdrant.tech/documentation/concepts/snapshots/) — backup and restore
- [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing) — $0.02/1M tokens confirmed Feb 2026
- [OpenAI text-embedding-3-small](https://platform.openai.com/docs/models/text-embedding-3-small) — 1536 dimensions, dimension reduction
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — v1.28.0 confirmed
- [MCP Best Practices](https://modelcontextprotocol.info/docs/best-practices/) — focused servers, tool count guidance
- [gray-matter npm](https://www.npmjs.com/package/gray-matter) — v4.0.3, frontmatter parsing

### Secondary (MEDIUM confidence)
- [Detecting Embedding Drift](https://decompressed.io/learn/embedding-drift) — version tracking, payload metadata requirements
- [4 pgvector Mistakes That Silently Break Your RAG Pipeline](https://dev.to/mianzubair/4-pgvector-mistakes-that-silently-break-your-rag-pipeline-in-production-4e0p) — distance metrics, indexing (applicable to all vector DBs)
- [Your Vector Search is (Probably) Broken](https://materialize.com/blog/your-vector-search-is-probably-broken/) — staleness, incremental updates
- [Embedding Infrastructure at Scale](https://introl.com/blog/embedding-infrastructure-scale-vector-generation-production-guide-2025) — batch processing, cost optimization
- [MCP Tool Descriptions Are Smelly](https://arxiv.org/html/2602.14878v1) — tool description quality impact on agent behavior
- [Real Faults in MCP Software](https://arxiv.org/html/2603.05637v1) — production MCP failure modes
- [Qdrant MCP Server (official, Python)](https://github.com/qdrant/mcp-server-qdrant) — pattern reference for search/read tool design

### Tertiary (LOW confidence)
- [Lore: Repurposing Git Commit Messages as a Structured Knowledge Protocol](https://arxiv.org/html/2603.15566v1) — Lore protocol design and quality validation concerns (paper validates the pattern; specific CLI tool existence unverified)
- [Lore Protocol GitHub](https://github.com/Ian-stetsenko/lore-protocol) — referenced in SEED-001 but CLI availability not independently confirmed

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*
