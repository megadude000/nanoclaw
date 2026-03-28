# Stack Research: Cortex Intelligence Additions

**Domain:** Knowledge management / vector search / embedding pipeline for AI agent system
**Researched:** 2026-03-28
**Confidence:** HIGH

> **Scope:** Only NEW technologies needed for v3.0 Cortex Intelligence. Existing stack (Node.js, TypeScript, discord.js, better-sqlite3, Zod, pino, MCP SDK, Claude Agent SDK) is validated and not re-researched.

## Recommended Stack

### Core Technologies (NEW additions)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| `@qdrant/js-client-rest` | ^1.17.0 | Vector database client | Official Qdrant REST client for JS/TS. Major/minor versions track Qdrant engine releases. REST over gRPC because easier to debug and sufficient for single-server local use. Qdrant itself runs as a Docker container (already the project's container pattern). | HIGH |
| `openai` | ^6.33.0 | Embedding generation via `text-embedding-3-small` | $0.02/1M tokens -- negligible cost for a personal knowledge base (estimated <$0.01/month). 1536 dimensions, supports dimension reduction to 512 for smaller index. No GPU needed, no model download, no ONNX runtime. One HTTP call per batch. Already available through OneCLI gateway for key management. | HIGH |
| `gray-matter` | ^4.0.3 | YAML frontmatter parsing for Cortex entries | De facto standard for frontmatter extraction in Node.js (5M+ weekly downloads). Extracts YAML metadata + content body from markdown files. Used by Obsidian ecosystem, Hugo, Jekyll, Astro. Zero config, works alongside existing `yaml` package. | HIGH |

### Supporting Libraries (already in project -- no changes needed)

| Library | Version | Purpose | Role in v3.0 |
|---------|---------|---------|--------------|
| `yaml` | ^2.8.2 | YAML parsing/serialization | Cortex schema frontmatter serialization (write path). `gray-matter` handles read, `yaml` handles structured write. |
| `zod` | ^4.3.6 | Schema validation | Validate Cortex entry schemas, MCP tool inputs, cortex-graph.json edges. Same pattern as existing IPC validation. |
| `better-sqlite3` | 11.10.0 | Metadata index | Store Cortex entry metadata (paths, staleness timestamps, edge counts) for fast reconciliation queries. Vector search stays in Qdrant. |
| `pino` | ^9.6.0 | Logging | Embedding pipeline and reconciliation logging. |
| `cron-parser` | 5.5.0 | Cron scheduling | Nightshift reconciliation schedule (already used by task-scheduler). |

### Container Agent-Runner Updates

| Package | Current | Target | Why |
|---------|---------|--------|-----|
| `@modelcontextprotocol/sdk` | ^1.12.1 | ^1.28.0 | Bump for latest MCP features. New Cortex tools (`cortex_search`, `cortex_read`, `cortex_write`) extend existing `McpServer` in `ipc-mcp-stdio.ts`. Proven pattern -- 10 tools already registered there. |
| `@qdrant/js-client-rest` | -- | ^1.17.0 | NEW. Container agents need to query Qdrant directly for `cortex_search` tool. |

### Infrastructure (NEW)

| Component | Image/Version | Purpose | Notes |
|-----------|--------------|---------|-------|
| Qdrant Docker | `qdrant/qdrant:v1.17.x` | Local vector database | Single container, ~200MB RAM for small collections. REST on port 6333. Persistent storage via Docker volume. No cloud account needed (zero cost). |

## Installation

```bash
# Host process -- embedding pipeline + Qdrant client + frontmatter parsing
npm install @qdrant/js-client-rest openai gray-matter

# Container agent-runner -- bump MCP SDK + add Qdrant client
cd container/agent-runner
npm install @modelcontextprotocol/sdk@^1.28.0 @qdrant/js-client-rest

# Qdrant Docker container (add to systemd or docker-compose)
docker pull qdrant/qdrant
docker run -d --name qdrant \
  -p 6333:6333 \
  -v $(pwd)/data/qdrant:/qdrant/storage:z \
  --restart unless-stopped \
  qdrant/qdrant
```

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `openai` text-embedding-3-small (API) | `fastembed` v2.1.0 (local ONNX) | fastembed requires ~500MB model download, ONNX runtime native dependency, and adds build complexity to Docker images. At $0.02/1M tokens, OpenAI embeddings cost effectively nothing for a personal knowledge base (<1000 entries). API call is simpler, no GPU, no native deps. |
| `openai` text-embedding-3-small (API) | Voyage AI `voyageai` v0.2.1 | Voyage has better code embedding benchmarks but adds another API key/provider. text-embedding-3-small is sufficient for mixed knowledge (decisions, architecture, session logs). Switch to Voyage only if code-specific search becomes primary use case. |
| `@qdrant/js-client-rest` (REST) | `@qdrant/js-client-grpc` (gRPC) | gRPC adds native module dependency. REST is adequate for single-server local deployment with <10K vectors. gRPC only matters at >100K vectors or high-throughput production. |
| Qdrant (dedicated vector DB) | SQLite + `sqlite-vss` extension | sqlite-vss is unmaintained. Qdrant provides proper ANN search, filtering, payload storage, and collection management out of the box. Docker deployment aligns with project's container pattern. |
| Qdrant (dedicated vector DB) | Chroma | Chroma's JS client is less mature. Qdrant has superior filtering, better TypeScript types, and PROJECT.md specifically targets Qdrant. |
| `gray-matter` (frontmatter) | Manual regex + `yaml` parse | gray-matter handles edge cases (TOML/JSON frontmatter, excerpt extraction, empty files). One dependency vs. brittle custom code. |
| Custom git trailer parsing | `git-parse` or `gitlog` npm | Git trailers are simple `Key: Value` lines. Parse with `git log --format='%(trailers)'` + string split -- ~10 lines of code. No library warranted. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| LangChain / LlamaIndex | Massive dependency tree, abstracts away control. NanoClaw needs direct Qdrant + OpenAI calls, not a framework wrapping both. Adds 50+ transitive deps for functionality achievable in <200 lines. | Direct `@qdrant/js-client-rest` + `openai` SDK |
| `@langchain/qdrant` | Pulls in full LangChain core. 90% unused abstraction for `client.upsert()` and `client.query()`. | Direct `@qdrant/js-client-rest` |
| `chromadb` | PROJECT.md specifies Qdrant. Chroma's Node.js client is less battle-tested. | `@qdrant/js-client-rest` |
| `fastembed` v2.1.0 | ONNX native dependency complicates Docker builds. Model download on first run. Overkill when API embeddings cost $0.02/1M tokens. | `openai` SDK for embeddings |
| Any ORM for SQLite | Already using raw `better-sqlite3` throughout project. Adding Drizzle/Prisma for 3-4 Cortex tables would be inconsistent. | Raw `better-sqlite3` queries |
| `@discordjs/collection` for graph | cortex-graph.json should be a file (version-controlled, inspectable), not in-memory only. | Plain JSON file + `fs` |

## Stack Patterns by Variant

**Embedding strategy -- API vs Local:**
- Use OpenAI API (`openai` SDK) because the knowledge base is small (<1000 entries), cost is negligible, and it avoids native dependency complexity.
- If the knowledge base grows past 10K entries or network latency becomes an issue, switch to `fastembed` with `BAAI/bge-small-en-v1.5` (137M params, runs on CPU).

**MCP server placement -- Host vs Container:**
- Cortex MCP tools (`cortex_search`, `cortex_read`, `cortex_write`) run inside the container agent-runner process, extending `ipc-mcp-stdio.ts`.
- The Qdrant client connects from inside the container to the host's Qdrant Docker via `host.docker.internal:6333` or Docker network bridge.
- Embedding generation happens on the **host side** during reconciliation (nightshift), NOT inside containers. Containers query pre-embedded vectors only.

**Lore Protocol git trailers -- no library needed:**
- Parse with `git log --format='%(trailers:key=Constraint,key=Rejected,key=Directive)'`.
- Custom TypeScript function (~10 lines). No npm package warranted.

**cortex-graph.json -- file, not database:**
- Explicit edges (BUILT_FROM, REFERENCES, BLOCKS, CROSS_LINK) stored as a JSON file in the repo.
- Read/written by reconciliation. Agents read via `cortex_read` MCP tool.
- Version-controlled alongside Cortex entries for full traceability.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@qdrant/js-client-rest@^1.17.0` | Qdrant Docker v1.17.x | Major.minor must match engine version |
| `openai@^6.33.0` | Node.js >=20 | Uses native fetch (no polyfill needed on Node 20+) |
| `@modelcontextprotocol/sdk@^1.28.0` | `zod@^4.0.0` | Peer dependency on zod (already satisfied in container) |
| `gray-matter@^4.0.3` | Node.js >=12 | Pure JS, no special requirements |

## Integration Points

### Where New Packages Wire Into Existing Code

| New Package | Integrates With | How |
|-------------|----------------|-----|
| `@qdrant/js-client-rest` | `container/agent-runner/src/ipc-mcp-stdio.ts` | New `cortex_search` tool calls Qdrant from inside container |
| `@qdrant/js-client-rest` | New `src/cortex/reconciler.ts` (host side) | Nightshift upserts embeddings into Qdrant |
| `openai` | New `src/cortex/embedder.ts` (host side) | Generates embeddings during reconciliation |
| `gray-matter` | New `src/cortex/parser.ts` (host side) | Parses Cortex markdown files during indexing |
| `@modelcontextprotocol/sdk` | `container/agent-runner/src/ipc-mcp-stdio.ts` | Extend existing McpServer with 3 new Cortex tools |
| `better-sqlite3` (existing) | New `src/cortex/db.ts` (host side) | Cortex metadata tables (entries, edges, staleness) |

### Environment Variables (NEW)

| Variable | Purpose | Managed By |
|----------|---------|------------|
| `OPENAI_API_KEY` | Embedding generation | OneCLI gateway (same pattern as existing keys) |
| `QDRANT_URL` | Qdrant connection | Default `http://localhost:6333`, override for Docker networking |

## Sources

- [@qdrant/js-client-rest npm](https://www.npmjs.com/package/@qdrant/js-client-rest) -- v1.17.0 confirmed via `npm view`
- [Qdrant JS SDK GitHub](https://github.com/qdrant/qdrant-js) -- Official TypeScript SDK
- [OpenAI text-embedding-3-small](https://platform.openai.com/docs/models/text-embedding-3-small) -- 1536 dimensions, dimension reduction support
- [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing) -- $0.02/1M tokens confirmed Feb 2026
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.28.0 confirmed via `npm view`
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- Server/client patterns
- [fastembed npm](https://www.npmjs.com/package/fastembed) -- v2.1.0 (considered, not recommended)
- [Qdrant FastEmbed docs](https://qdrant.tech/documentation/fastembed/) -- Local embedding alternative reference
- [Voyage AI npm](https://www.npmjs.com/package/voyageai) -- v0.2.1 (considered, not recommended)

---
*Stack research for: Cortex Intelligence additions to NanoClaw v3.0*
*Researched: 2026-03-28*
