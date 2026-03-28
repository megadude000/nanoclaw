# Feature Research: Agent Cortex Intelligence

**Domain:** Queryable knowledge layer for autonomous AI agents — vector search, embedding pipelines, MCP tool interfaces, knowledge graphs, automated reconciliation
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH (architecture well-defined in SEED-001; implementation details need phase-specific research)

## Feature Landscape

### Table Stakes (Agents Expect These)

Features that must exist or the Cortex layer adds no value over the current manual CLAUDE.md approach.

| Feature | Why Expected | Complexity | Depends On | Notes |
|---------|--------------|------------|------------|-------|
| **Semantic search via MCP tool** (`cortex_search`) | Core value prop: agents query knowledge before every task. Without this, Cortex is just Obsidian files agents cannot access at runtime. | HIGH | Qdrant running, embedding pipeline, MCP server | Returns ranked results with metadata. Must be <50ms for agents to use per-task (not just per-session). Qdrant local Docker + REST API on port 6333. |
| **Read entry via MCP tool** (`cortex_read`) | After search returns IDs, agents need to read full entry content. Exact retrieval complements semantic search. | LOW | Cortex schema, MCP server | Direct file read from vault by entry ID or path. No vector DB needed — pure filesystem. |
| **Write/update entry via MCP tool** (`cortex_write`) | Agents must contribute knowledge back, not just consume. Self-reinforcing loop: agents write code, capture WHY, Cortex grows. | MEDIUM | Cortex schema, MCP server, embedding pipeline (auto-embed on write) | Must validate YAML frontmatter, enforce schema, trigger re-embedding. Write to vault filesystem + upsert vector. |
| **Cortex schema standard** (YAML frontmatter) | Without a consistent schema, entries are unqueryable junk. Every entry needs type, project, tags, confidence, level (L10-L50) for structured filtering. | MEDIUM | None (first thing to build) | Extend existing Obsidian frontmatter (type, status, tags, created). Add: `cortex_level`, `confidence`, `scope`, `domain`. |
| **Qdrant local deployment** | Vector search engine. No vector DB = no semantic search = no Cortex value. | LOW | Docker on host | `docker run -p 6333:6333 qdrant/qdrant` with persistent volume. Single collection `cortex-entries`. Trivial to deploy, hard to tune. |
| **Embedding pipeline** (on write) | Entries must be vectorized to be searchable. Without auto-embedding, the index goes stale immediately. | MEDIUM | Qdrant, embedding model choice | Trigger on `cortex_write` and on nightly reconciliation. Use OpenAI `text-embedding-3-small` (1536 dims, $0.02/1M tokens) — already have API key, no local GPU needed. Nomic is open-source alternative but requires ONNX runtime setup. |
| **Knowledge pyramid levels** (L10-L50) | Prevents hallucination at high abstraction. L10 (facts about files) is verifiable; L50 (user journeys) is interpretive. Agents need to know what level of knowledge they're reading. | LOW | Cortex schema | L10: files, APIs, env vars. L20: behavior patterns, routing. L30: system topology. L40: project domains. L50: user journeys, edge cases. Metadata only — stored in frontmatter `cortex_level` field. |
| **Bootstrap population** (L10-L20) | An empty Cortex is useless. Must have initial entries for agents to query on day one. | HIGH | Schema, Qdrant, embedding pipeline | Programmatic extraction from codebase: parse `src/*.ts` exports, IPC contracts, env vars, channel interfaces. ~50-100 initial entries for NanoClaw alone. |
| **Agent auto-query at task start** | If agents don't automatically query Cortex, the feature is opt-in and will be forgotten. Must be wired into container CLAUDE.md so agents query before every task. | LOW | `cortex_search` MCP tool working | Add instruction to container CLAUDE.md: "Before starting any task, call `cortex_search` with relevant keywords." Instruction-only change. |

### Differentiators (Competitive Advantage)

Features that elevate the system from "agents can search docs" to "agents understand the system."

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---------|-------------------|------------|------------|-------|
| **Lore Protocol integration** (git trailers) | Captures decision context AT COMMIT TIME — why code exists, what was rejected, constraints. This is micro-level knowledge that no documentation system captures. Agents query `lore constraints` before touching code to learn what NOT to do. | MEDIUM | `lore-protocol` CLI installed in containers | Ian's CLI: `lore init`, `lore commit`, `lore context`, `lore constraints`, `lore rejected`, `lore search`. Git trailer format: `Lore-id`, `Constraint:`, `Rejected:`, `Directive:`. Lives in git, zero external DB. Must be available inside agent containers. |
| **cortex-graph.json** (explicit relationships) | Explicit edges between entries: BUILT_FROM, REFERENCES, BLOCKS, CROSS_LINK. Agents can traverse: "what does this component depend on?" "what blocks this?" Deterministic, not semantic. | MEDIUM | Cortex schema, `cortex_relate` MCP tool | JSON adjacency list. Agents declare edges via `cortex_relate` tool. Nightshift can also auto-discover edges. Not a full graph DB — just a JSON file that grows. |
| **Nightshift reconciliation** | Autonomous nightly maintenance: staleness cascade (flag entries not updated in N days), CROSS_LINK discovery (semantic similarity > 0.8 threshold auto-promoted to graph), orphan cleanup (entries with no references). Self-healing knowledge base. | HIGH | Qdrant, cortex-graph.json, task scheduler, Alfred agent | Hooks into existing `task-scheduler.ts`. Alfred runs as a scheduled task. 4-step reconciliation: (1) re-embed changed files, (2) staleness scan, (3) CROSS_LINK discovery, (4) orphan flagging. |
| **Hybrid search routing** | Vault lookup (exact, by ID/path) vs Qdrant (semantic, by query). MCP server decides which path based on query shape. Exact queries skip the vector DB entirely — faster and deterministic. | MEDIUM | Both search paths working | If query looks like a path or ID: vault lookup. If natural language: Qdrant semantic search. If tag-based: Qdrant filtered search with payload filter. |
| **Confidence firewall** | L(N) entries only populate when L(N-1) has zero stubs and medium+ confidence. Prevents hallucination at high abstraction levels. An L40 project overview cannot exist if L10 file facts have gaps. | LOW | Schema with confidence field | Enforcement in `cortex_write`: check parent level completeness before allowing higher-level writes. Metadata validation only — no complex logic. |
| **Semantic CROSS_LINK auto-discovery** | Nightly: compare all entry vectors, find pairs with cosine similarity > 0.8 that have no explicit graph edge. Promote to CROSS_LINK. Agents discover connections humans missed. | MEDIUM | Qdrant populated, cortex-graph.json | Batch query: for each entry, find top-K similar. Filter out existing edges. Propose new CROSS_LINKs. Alfred reviews and commits. Could be expensive if collection grows large — need pagination. |
| **Multi-project scoping** | Cortex serves NanoClaw, YourWave, ContentFactory, NightShift. Agents must get project-scoped results, not cross-project noise. | LOW | Schema with `domain`/`project` field | Qdrant payload filter: `{ "project": "nanoclaw" }`. Already natural from frontmatter. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in this context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full graph database** (Neo4j, FalkorDB) | "Knowledge graphs need a graph DB" | Massive operational overhead for a personal assistant. NanoClaw is a single-user system with ~500-1000 entries max. A JSON adjacency list in `cortex-graph.json` handles this trivially. Graph DB adds Docker container, query language (Cypher), schema management, backup — all for a dataset that fits in memory. | `cortex-graph.json` — flat JSON file, deterministic reads, git-tracked. If entry count exceeds ~5000, reconsider. |
| **Local embedding model** (Nomic, Ollama) | "Zero cost, full privacy, no API dependency" | Requires ONNX runtime or Ollama Docker container. Embedding quality is lower than OpenAI for English text. NanoClaw entries are ~500 words avg; embedding cost is negligible (~$0.01/month for 1000 entries). Adds operational complexity (model updates, GPU/CPU tuning) for zero practical benefit. | OpenAI `text-embedding-3-small` via API. Cost: ~$0.02 per 1M tokens. For a personal knowledge base of 1000 entries, annual cost is under $1. API key already configured. |
| **Real-time embedding** (embed on every file save) | "Keep index always fresh" | Obsidian saves on every keystroke. Would generate hundreds of unnecessary API calls during editing sessions. Vault files change frequently during active work but stabilize overnight. | Embed on `cortex_write` (agent-initiated) + nightly reconciliation (catch-all). Two triggers cover 99% of cases without waste. |
| **RAG with chunk splitting** | "Standard RAG pattern: split documents into 512-token chunks for better retrieval" | Cortex entries are already atomic — they ARE the chunks. Each L10 entry describes one file, one API, one env var. Splitting would destroy the carefully structured knowledge pyramid. Standard RAG chunking solves a problem (long unstructured documents) that the Cortex schema already solves by design. | Embed full entries as single vectors. If an entry is too long (>2000 tokens), that's a schema problem — split it into two entries at the knowledge level, not at the retrieval level. |
| **Web UI for Cortex browsing** | "Visual dashboard for knowledge base" | Obsidian IS the UI. The vault is already an Obsidian vault with wiki-links, graph view, and search. Building a custom web UI duplicates what Obsidian does natively, adds maintenance burden, and would be used by exactly one person (the owner). | Obsidian for human browsing. MCP tools for agent access. Two interfaces, each optimized for its user. |
| **Agent-to-agent knowledge sharing** (real-time) | "Friday should share findings with Alfred in real-time" | Agents already share via the vault filesystem and IPC. Adding real-time pub/sub creates race conditions on file writes, requires locking, and the latency benefit is zero — agents work on minute-scale tasks, not millisecond-scale coordination. | Agents write to vault; other agents read from vault. Nightly reconciliation catches anything missed. Simple, debuggable, no race conditions. |
| **Versioned embeddings** (store multiple embedding versions per entry) | "Track how understanding evolves" | Storage bloat for no practical value. When an entry changes, the old embedding is wrong — keeping it is misleading. Git history already tracks content evolution. | Single embedding per entry. Overwrite on re-embed. Git tracks content history if needed. |
| **Slack/Discord commands for Cortex** | "Query knowledge from chat" | Agents already have MCP tools. Humans have Obsidian. Adding chat commands creates a third interface to maintain for the same data. The owner interacts with agents, not with the knowledge base directly. | If the owner wants to search Cortex, they ask an agent (via Telegram/Discord), and the agent uses `cortex_search`. No special commands needed. |

## Feature Dependencies

```
[Cortex Schema Standard]
    |
    +--requires--> [Qdrant Local Deployment]
    |                  |
    |                  +--requires--> [Embedding Pipeline]
    |                                     |
    +--requires--> [cortex_read MCP]      +--enables--> [cortex_search MCP]
    |                                     |
    +--requires--> [cortex_write MCP] ----+  (write triggers embed)
    |
    +--requires--> [cortex-graph.json] --enables--> [cortex_relate MCP]
    |
    +--enables--> [Bootstrap Population L10-L20]
    |                  |
    |                  +--enables--> [Agent Auto-Query at Task Start]
    |
    +--independent--> [Lore Protocol] (git-native, no Qdrant dependency)

[Qdrant + cortex-graph.json]
    |
    +--enables--> [Nightshift Reconciliation]
                      |
                      +--includes--> [Staleness Cascade]
                      +--includes--> [CROSS_LINK Discovery]
                      +--includes--> [Orphan Cleanup]

[Hybrid Search Routing]
    |
    +--requires--> [cortex_read (vault path)]
    +--requires--> [cortex_search (Qdrant semantic)]

[Confidence Firewall]
    +--requires--> [Cortex Schema (confidence field)]
    +--requires--> [Bootstrap L10 complete]
```

### Dependency Notes

- **Cortex Schema is the foundation:** Everything depends on having a consistent YAML frontmatter standard. Build this first.
- **Qdrant + Embedding Pipeline unlock search:** No semantic search without both running. Deploy together.
- **Lore Protocol is independent:** Git trailers work without Qdrant, without the MCP server, without anything else. Can be adopted in parallel at any point.
- **Bootstrap gates Agent Auto-Query:** Agents querying an empty Cortex get nothing useful. Population must happen before wiring agents to auto-query.
- **Nightshift Reconciliation requires everything:** It's the capstone — needs schema, Qdrant, graph, and embedding pipeline all working. Build last.
- **Confidence Firewall requires L10 completeness:** Cannot enforce "L20 needs L10 done" until L10 is actually populated.

## MVP Definition

### Launch With (Core Cortex)

Minimum viable knowledge layer — agents can search, read, and write knowledge entries.

- [ ] **Cortex schema standard** — YAML frontmatter spec with cortex_level, confidence, domain, scope fields
- [ ] **Qdrant local Docker** — single `cortex-entries` collection, persistent storage volume
- [ ] **Embedding pipeline** — OpenAI text-embedding-3-small, embed on write + batch re-embed
- [ ] **cortex_search MCP tool** — semantic search with project/level filtering
- [ ] **cortex_read MCP tool** — exact entry retrieval by ID or path
- [ ] **cortex_write MCP tool** — create/update entries with auto-embed
- [ ] **Bootstrap L10-L20** — programmatic extraction of NanoClaw codebase facts (~50-100 entries)
- [ ] **Agent auto-query** — container CLAUDE.md instructs agents to query Cortex at task start

### Add After Core Works (Knowledge Intelligence)

Features to add once the basic query loop is validated.

- [ ] **cortex-graph.json + cortex_relate MCP** — when agents start needing relationship traversal
- [ ] **Lore Protocol in containers** — when night shift agents start making commits that need decision context
- [ ] **Hybrid search routing** — when exact-vs-semantic distinction matters in practice
- [ ] **Confidence firewall enforcement** — when L10 coverage is good enough to gate L20+
- [ ] **Multi-project bootstrap** (YourWave, ContentFactory, NightShift L10-L20) — after NanoClaw bootstrap validates the pattern

### Future Consideration (Autonomy)

Features to defer until the knowledge loop is proven.

- [ ] **Nightshift reconciliation** — needs all components stable before nightly automation makes sense
- [ ] **CROSS_LINK auto-discovery** — needs enough entries for meaningful similarity pairs
- [ ] **L30-L50 population** — higher-level knowledge requires L10-L20 foundation + confidence firewall working
- [ ] **Staleness cascade** — only matters when entries are old enough to go stale (weeks/months after bootstrap)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase Suggestion |
|---------|------------|---------------------|----------|-----------------|
| Cortex schema standard | HIGH | LOW | P1 | Phase 1 |
| Qdrant local deployment | HIGH | LOW | P1 | Phase 2 |
| Embedding pipeline | HIGH | MEDIUM | P1 | Phase 2 |
| cortex_search MCP | HIGH | MEDIUM | P1 | Phase 3 |
| cortex_read MCP | HIGH | LOW | P1 | Phase 3 |
| cortex_write MCP | HIGH | MEDIUM | P1 | Phase 3-4 |
| Bootstrap L10-L20 (NanoClaw) | HIGH | HIGH | P1 | Phase 5 |
| Agent auto-query wiring | HIGH | LOW | P1 | Phase 5 |
| cortex-graph.json | MEDIUM | MEDIUM | P2 | Phase 6 |
| cortex_relate MCP | MEDIUM | LOW | P2 | Phase 6 |
| Lore Protocol integration | MEDIUM | MEDIUM | P2 | Phase 7 |
| Hybrid search routing | MEDIUM | MEDIUM | P2 | Phase 4 |
| Confidence firewall | MEDIUM | LOW | P2 | Phase 4 |
| Nightshift reconciliation | HIGH | HIGH | P2 | Phase 8 |
| CROSS_LINK discovery | MEDIUM | MEDIUM | P3 | Phase 8 |
| Multi-project bootstrap | MEDIUM | HIGH | P3 | Phase 9+ |
| L30-L50 population | MEDIUM | HIGH | P3 | Phase 9+ |

## Comparable Systems Analysis

| Feature | Mem0 (AI memory) | Langchain RAG | Cursor Codebase Index | Our Cortex Approach |
|---------|-------------------|---------------|----------------------|---------------------|
| Knowledge structure | Flat memories, auto-organized | Unstructured chunks | AST-parsed code | Knowledge pyramid L10-L50 with schema |
| Vector search | Qdrant/pgvector | Any vector store | Local embedding | Qdrant local + OpenAI embeddings |
| Relationship tracking | None (flat) | None | Import/export graph | Explicit cortex-graph.json + semantic CROSS_LINK |
| Decision context | None | None | None | Lore Protocol git trailers |
| Auto-maintenance | None | None | On-save re-index | Nightshift nightly reconciliation |
| Agent integration | SDK (Python) | Chain integration | IDE-native | MCP tools (language-agnostic) |
| Human interface | API only | API only | IDE only | Obsidian vault (full GUI) |
| Staleness detection | None | None | None | Nightly staleness cascade with configurable thresholds |

**Key advantage of NanoClaw Cortex:** It is the only system that combines structured knowledge levels (L10-L50), decision context from git (Lore), explicit relationship graphs, AND autonomous maintenance (Nightshift) — all accessible via standard MCP tools and browsable in Obsidian. No existing tool does all four.

## Sources

- [Qdrant Quickstart](https://qdrant.tech/documentation/quickstart/) — Docker setup, collection creation, REST API
- [Qdrant Embeddings Guide](https://qdrant.tech/documentation/embeddings/) — Supported embedding models
- [Qdrant + OpenAI](https://developers.openai.com/cookbook/examples/vector_databases/qdrant/getting_started_with_qdrant_and_openai) — OpenAI embedding integration
- [Lore Protocol](https://github.com/Ian-stetsenko/lore-protocol) — Git trailer CLI for decision context
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25) — Tool/resource/prompt primitives
- [2026 MCP Roadmap](http://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — Auth, multi-agent, registry
- [Neo4j Codebase Knowledge Graph](https://neo4j.com/blog/developer/codebase-knowledge-graph/) — Graph patterns (informed anti-feature decision)
- [RAG in 2026](https://squirro.com/squirro-blog/state-of-rag-genai/) — RAG evolution toward "context engines"
- [FastEmbed](https://github.com/qdrant/fastembed) — Local embedding alternative (informed anti-feature decision)
- [CMDB Staleness Rules](https://www.thecloudpeople.com/blog/cmdb-maintenance-functionalities) — Reconciliation patterns

---
*Feature research for: Agent Cortex Intelligence (v3.0)*
*Researched: 2026-03-28*
