# Architecture Patterns: v3.0 Agent Cortex Intelligence

**Domain:** Knowledge retrieval layer for AI agent system
**Researched:** 2026-03-28

## Recommended Architecture

### High-Level Overview

```
                     +------------------+
                     |   cortex/ vault  |  (Obsidian markdown files)
                     |   (source of     |
                     |    truth)        |
                     +--------+---------+
                              |
                   +----------v-----------+
                   |  Embedding Pipeline   |  NEW -- host-side service
                   |  (watch + embed +     |
                   |   upsert to Qdrant)   |
                   +----------+-----------+
                              |
                   +----------v-----------+
                   |  Qdrant (Docker)      |  NEW -- vector DB container
                   |  cortex-entries       |
                   |  collection           |
                   +----------+-----------+
                              |
            +-----------------+-----------------+
            |                                   |
+-----------v-----------+           +-----------v-----------+
| Cortex MCP Server     |  NEW     | Nightshift Reconciler |  NEW
| (inside agent         |          | (scheduled task,      |
|  containers)          |          |  host-side)           |
| cortex_search         |          | staleness, orphans,   |
| cortex_read           |          | cross-links           |
| cortex_write          |          +----------+------------+
+-----------+-----------+                     |
            |                      +----------v-----------+
            |                      | cortex-graph.json    |  NEW
            |                      | (explicit edges)     |
            +                      +----------------------+
    Agent containers
    (existing infra)
```

### Component Inventory: New vs Modified

| Component | Status | Location | Purpose |
|-----------|--------|----------|---------|
| Qdrant Docker container | **NEW** | Alongside NanoClaw via systemd | Vector storage for cortex entries |
| Embedding pipeline | **NEW** | `src/cortex-embedder.ts` (host) | Watch cortex/ files, generate embeddings, upsert |
| Cortex MCP server | **NEW** | `container/agent-runner/src/cortex-mcp.ts` | cortex_search/read/write tools for agents |
| cortex-graph.json | **NEW** | `cortex/cortex-graph.json` | Explicit relationship edges between entries |
| Nightshift reconciler | **NEW** | `container/skills/cortex-reconcile/` | Nightly staleness cascade, orphan cleanup |
| Lore Protocol atoms | **NEW** | Git trailers on commits | Constraint/Rejected/Directive annotations |
| Cortex schema (YAML) | **NEW** | Convention in cortex/ .md files | Standardized frontmatter for L10-L50 pyramid |
| Knowledge bootstrap | **NEW** | One-time scripts + cortex-reconcile | Initial L10-L20 population |
| `container/agent-runner/src/index.ts` | **MODIFIED** | Existing | Add cortex MCP server to mcpServers config |
| `container/agent-runner/src/ipc-mcp-stdio.ts` | **MODIFIED** | Existing | Add cortex_write IPC handler |
| `src/container-runner.ts` | **MODIFIED** | Existing | Mount Qdrant access + cortex/ read-only into containers |
| `src/config.ts` | **MODIFIED** | Existing | QDRANT_URL, EMBEDDING_MODEL env vars |
| `src/task-scheduler.ts` | **NO CHANGE** | Existing | Nightshift already uses scheduled tasks |
| `src/ipc.ts` | **MODIFIED** | Existing | Handle cortex_write IPC messages from containers |
| `src/db.ts` | **NO CHANGE** | Existing | No schema changes needed |
| `groups/main/CLAUDE.md` | **MODIFIED** | Existing | Wire auto-query instructions |

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Qdrant (Docker) | Store/query vector embeddings | Embedding pipeline (upsert), Cortex MCP (query) |
| Embedding pipeline | Watch cortex/ for changes, generate vectors | Qdrant (REST API), filesystem (cortex/) |
| Cortex MCP server | Expose search/read/write to agents inside containers | Qdrant (REST via host gateway), cortex/ (mounted read-only), IPC (for writes) |
| cortex-graph.json | Store explicit edges between cortex entries | Read by Cortex MCP, updated by reconciler |
| Nightshift reconciler | Nightly maintenance: staleness, orphans, cross-links | cortex/ filesystem, cortex-graph.json, Qdrant |
| Agent containers (existing) | Execute Claude Agent SDK with MCP tools | Cortex MCP server (stdio), IPC (file-based) |
| Host IPC watcher (existing) | Process IPC files from containers | Cortex writes land here, forwarded to embedding pipeline |

---

## Detailed Architecture

### 1. Qdrant Vector Database

**Deployment:** Docker container managed by systemd user service, same pattern as NanoClaw itself.

```bash
# systemd user service: qdrant.service
docker run -d --name qdrant \
  -p 6333:6333 \
  -v ~/nanoclaw/data/qdrant:/qdrant/storage \
  qdrant/qdrant
```

**Collection:** `cortex-entries`

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID (deterministic from file path) | Stable across re-embeds |
| `vector` | float[1536] | text-embedding-3-small output |
| `payload.path` | string | Relative path from cortex/ root |
| `payload.title` | string | Extracted from H1 or frontmatter |
| `payload.level` | string | L10/L20/L30/L40/L50 pyramid level |
| `payload.type` | string | project/decision/architecture/session-log/daily |
| `payload.tags` | string[] | From frontmatter tags |
| `payload.updated` | string | File mtime ISO |
| `payload.chunk_index` | number | 0-based chunk index within document |
| `payload.content_hash` | string | MD5 of chunk content (skip re-embed if unchanged) |

**Why Qdrant over alternatives:**
- Already Docker-native (NanoClaw is container-first)
- Official MCP server exists (even though Python, validates the pattern)
- REST API works from inside containers via host gateway (no additional network config)
- Single-node is free, zero config, 50ms p99 for <100K vectors
- `@qdrant/js-client-rest` v1.17 -- TypeScript SDK, well-maintained

**Why NOT Chroma/Pinecone/pgvector:**
- Chroma: Python-first, JS client unstable, in-process mode does not work cross-container
- Pinecone: Cloud-only, violates zero-cost constraint
- pgvector: Would require PostgreSQL (NanoClaw uses SQLite), overkill

### 2. Embedding Pipeline

**Location:** `src/cortex-embedder.ts` -- runs on the host process

**Architecture choice:** Host-side watcher, NOT container-side. Embedding must happen on the host because:
1. Containers are ephemeral (spawn per message/task, die after)
2. Embedding needs to be continuous (file changes between container runs)
3. Single source of truth for what is embedded avoids race conditions

**Pipeline steps:**

```
1. WATCH -- fs.watch on cortex/ directory (recursive)
2. PARSE -- Extract frontmatter (YAML) + body markdown
3. CHUNK -- Split into ~500 token chunks (preserve heading context)
4. HASH -- MD5 each chunk, skip if payload.content_hash matches
5. EMBED -- Call OpenAI text-embedding-3-small API
6. UPSERT -- Write to Qdrant cortex-entries collection
7. PRUNE -- Delete vectors for files that no longer exist
```

**Embedding model:** OpenAI `text-embedding-3-small`
- $0.02/M tokens -- cortex vault is ~200 files, ~500 chunks = ~$0.01 per full re-index
- 1536 dimensions -- good balance of quality/speed
- Already have ANTHROPIC_API_KEY infrastructure; adding OPENAI_API_KEY is minimal
- Alternative: Voyage AI voyage-3-large is better for code/technical docs but costs 3x more and adds another vendor. For a ~200 file personal vault, text-embedding-3-small is sufficient

**Why NOT local embeddings (Ollama/FastEmbed):**
- Additional GPU/CPU load on the VPS
- Quality gap vs API embeddings for multi-language content (EN/UK in cortex)
- Cost is negligible (<$0.01/month for this vault size)

**Chunking strategy:**
- Split on `## ` headings (natural markdown sections)
- If section > 500 tokens, split on paragraphs
- Prepend document title + frontmatter summary to each chunk (heading context)
- This preserves the "what file is this from" context in every chunk

**Integration with host process:**
- Starts alongside NanoClaw in `src/index.ts` (like health monitor)
- Initial full scan on startup
- fs.watch for incremental updates
- Debounce 2s after file change before re-embedding (handles burst writes)

### 3. Cortex MCP Server (Inside Containers)

**Location:** Add cortex tools to existing `container/agent-runner/src/ipc-mcp-stdio.ts`

**Recommendation:** Add cortex tools to the existing MCP server rather than spawning a separate process. Reasons:
- Fewer processes per container = less overhead
- Same IPC pattern already works
- Tools share the same NanoClaw context (chatJid, groupFolder, isMain)

**Tools:**

```typescript
// cortex_search -- semantic search across cortex entries
server.tool('cortex_search', {
  query: z.string(),           // Natural language query
  level: z.enum(['L10','L20','L30','L40','L50']).optional(),
  type: z.string().optional(),  // Filter by entry type
  limit: z.number().default(5), // Max results
})
// Implementation: HTTP to Qdrant REST API via host gateway

// cortex_read -- read full cortex entry by path
server.tool('cortex_read', {
  path: z.string(),  // Relative path, e.g. "Areas/Projects/YourWave/YourWave.md"
})
// Implementation: Read from mounted cortex/ directory (read-only mount)

// cortex_write -- create or update a cortex entry
server.tool('cortex_write', {
  path: z.string(),
  content: z.string(),
  frontmatter: z.object({
    type: z.string(),
    tags: z.array(z.string()).optional(),
    level: z.string().optional(),
  }).optional(),
})
// Implementation: Write IPC file -> host picks up -> writes to cortex/ -> triggers re-embed
```

**Network access pattern:**
- Qdrant runs on host at `localhost:6333`
- Containers access it via `host.docker.internal:6333` (CONTAINER_HOST_GATEWAY)
- Same pattern as the credential proxy (ANTHROPIC_BASE_URL)
- Pass `QDRANT_URL=http://host.docker.internal:6333` as container env var

**Embedding queries inside containers:**
- cortex_search needs to embed the query text before calling Qdrant
- Two options: (a) call OpenAI API directly from container, (b) use a query-embed endpoint on host
- Recommendation: Option (a) -- call OpenAI directly from inside the container. The container already has network access for claude-code API calls. Pass OPENAI_API_KEY via env var (same pattern as NOTION_API_KEY, GITHUB_TOKEN in container-runner.ts line 318-327).

**Mount changes in container-runner.ts:**
```typescript
// cortex/ directory -- read-only for all groups
mounts.push({
  hostPath: path.join(projectRoot, 'cortex'),
  containerPath: '/workspace/cortex',
  readonly: true,
});
```

### 4. cortex-graph.json -- Knowledge Graph

**Location:** `cortex/cortex-graph.json`

**Design:** Simple adjacency list, not a full graph database. The cortex vault is ~200 files -- a graph DB would be absurd overhead.

```json
{
  "version": 1,
  "updated": "2026-03-28T12:00:00Z",
  "nodes": {
    "Areas/Projects/YourWave/YourWave.md": {
      "title": "YourWave",
      "type": "project",
      "level": "L10"
    }
  },
  "edges": [
    {
      "from": "Areas/Projects/YourWave/yw.platform-spec.md",
      "to": "Areas/Projects/YourWave/YourWave.md",
      "type": "BUILT_FROM",
      "created": "2026-03-28"
    },
    {
      "from": "Areas/Projects/NightShift/nightshift.architecture.md",
      "to": "Areas/Projects/NightShift/NightShift.md",
      "type": "REFERENCES",
      "created": "2026-03-28"
    }
  ]
}
```

**Edge types:**
| Type | Meaning | Example |
|------|---------|---------|
| BUILT_FROM | Implementation derived from spec | platform-spec.md -> YourWave.md |
| REFERENCES | Cites or depends on | architecture.md -> NightShift.md |
| BLOCKS | Blocked by / prerequisite | task -> blocker |
| CROSS_LINK | Related across projects | yw.content-factory.md -> ContentFactory.md |
| SUPERSEDES | Newer version of | v2-spec -> v1-spec |

**How agents use it:**
- `cortex_search` returns matching entries + their edges (1-hop neighbors)
- Agents see not just the matching document but what it connects to
- Reconciler builds new CROSS_LINK edges by discovering shared tags/topics

### 5. Cortex Schema -- YAML Frontmatter Standard

**Knowledge Pyramid (L10-L50):**

| Level | Name | Scope | TTL | Example |
|-------|------|-------|-----|---------|
| L10 | Index | Project hub, top-level map | Stable | YourWave.md |
| L20 | Domain | Domain-specific knowledge | Months | yw.ecommerce.md |
| L30 | Operational | How-to, architecture, specs | Weeks | nightshift.architecture.md |
| L40 | Temporal | Session logs, daily notes | Days | 2026-03-28.md |
| L50 | Ephemeral | Scratch, WIP, drafts | Hours | research scratchpad |

**Standard frontmatter:**
```yaml
---
type: project|decision|architecture|session-log|daily|research
level: L10|L20|L30|L40|L50
status: active|archived|draft
created: 2026-03-28
updated: 2026-03-28
project: YourWave|NightShift|NanoClaw|ContentFactory
tags: [embedding, vector-search, qdrant]
---
```

**Reconciler validates:** All cortex/ files MUST have frontmatter. Missing frontmatter = orphan, flagged for review.

### 6. Lore Protocol -- Git Trailer Knowledge Atoms

**What it is:** Structured knowledge encoded in git commit trailers.

Since the "Lore Protocol" as a named CLI tool could not be verified via web search (LOW confidence on the specific name/CLI), the architecture pattern is clear and implementable:

**Pattern:** Git commit messages carry structured knowledge atoms:

```
feat(cortex): add Qdrant embedding pipeline

Constraint: Must use text-embedding-3-small for cost (< $0.01/month)
Rejected: Local Ollama embeddings -- quality gap for multilingual content
Directive: All cortex files require YAML frontmatter with level field
```

**Implementation:**
- Convention-only (no CLI tool needed initially)
- Nightshift reconciler can parse `git log --format=%B` to extract Constraint/Rejected/Directive lines
- These get indexed into Qdrant with type=`lore-atom` so agents can search decision history
- Low priority -- can ship after core pipeline works

**Confidence:** LOW on the specific "Lore Protocol" CLI existing. HIGH on the git trailer pattern being sound.

### 7. Nightshift Reconciliation

**Runs as:** Scheduled task via existing task-scheduler, nightly (e.g., 02:00)

**Implementation:** Container skill at `container/skills/cortex-reconcile/SKILL.md`

The agent (Alfred, as research bot) executes reconciliation as a scheduled task with a script phase:

**4-step reconciliation pipeline:**

1. **Staleness cascade** -- Check L40/L50 entries older than their TTL. Flag or archive.
2. **CROSS_LINK discovery** -- For each entry, find semantically similar entries via Qdrant. If similarity > 0.85 and no existing edge, propose CROSS_LINK in cortex-graph.json.
3. **Orphan cleanup** -- Find cortex/ files without frontmatter, or with broken references. Report to #agents.
4. **Embedding integrity** -- Compare cortex/ file list against Qdrant point list. Re-embed missing, prune deleted.

**Output:** Summary report to #agents via IPC (existing pattern from v2.0).

### 8. Agent Integration -- Auto-Query at Task Start

**How it works:**
- Each group's CLAUDE.md already includes contextual instructions (Phase 8 channel templates)
- Add to the global CLAUDE.md (mounted read-only at `/workspace/global/CLAUDE.md`):

```markdown
## Cortex Knowledge Layer

Before starting any task, use `cortex_search` to find relevant context:
1. Search for the project name mentioned in the task
2. Search for the specific technical area
3. Read the top 2-3 results with `cortex_read`

This gives you the "why" behind decisions, not just the "what" of the code.
```

- The agent already loads global CLAUDE.md as `systemPrompt.append` (line 443 of agent-runner index.ts)
- No code change needed for this step, just content change

### 9. Knowledge Bootstrap

**One-time process:** Populate L10 and L20 entries for existing projects.

**Approach:** Scheduled task or manual run:
1. Scan existing cortex/ files -- Add frontmatter where missing
2. Scan `src/` -- Generate L20 architecture entries for key NanoClaw modules
3. Scan `.planning/` -- Convert research files to L30 entries
4. Run full embedding pipeline to index everything

**Projects to bootstrap:**
- NanoClaw (src/) -- orchestrator, channels, IPC, containers, scheduler
- YourWave (YW_Core) -- platform spec, atlas, design system
- Night Shift -- architecture, cron registry
- Content Factory -- pipeline, atlas integration

---

## Data Flow

### Ingest Flow (cortex/ file changed)

```
cortex/ file saved
  |
  v
fs.watch in cortex-embedder.ts (host)
  |
  v
Parse frontmatter + body
  |
  v
Chunk (heading-aware, ~500 tokens)
  |
  v
Hash each chunk (skip if unchanged)
  |
  v
Call OpenAI embeddings API
  |
  v
Upsert to Qdrant cortex-entries
  |
  v
Update cortex-graph.json node metadata
```

### Query Flow (agent searches cortex)

```
Agent calls cortex_search("YourWave payment providers")
  |
  v
cortex-mcp.ts: embed query via OpenAI API
  |
  v
Qdrant search (top-k, optional filters)
  |
  v
Return: [{path, title, level, score, snippet}]
  |
  v
Agent calls cortex_read("Areas/Projects/YourWave/Research/payment-providers.md")
  |
  v
Read from mounted /workspace/cortex/ (read-only)
  |
  v
Agent has full context for decision-making
```

### Write Flow (agent creates cortex entry)

```
Agent calls cortex_write(path, content, frontmatter)
  |
  v
cortex-mcp.ts: write IPC file to /workspace/ipc/messages/
  |
  v
Host IPC watcher picks up (src/ipc.ts)
  |
  v
Host writes file to cortex/ directory
  |
  v
fs.watch triggers re-embed pipeline
  |
  v
Entry available in Qdrant within ~5 seconds
```

---

## Patterns to Follow

### Pattern 1: Host-Side Service with Container-Side MCP
**What:** Heavy services (Qdrant, embedding pipeline) run on host. Lightweight MCP tools run inside containers.
**When:** Any stateful service that must persist across container lifecycles.
**Why:** Containers are ephemeral. Qdrant must be always-on. Embedding pipeline must watch files continuously.

### Pattern 2: IPC for Write Operations
**What:** Container agents write IPC files. Host processes them and writes to the actual filesystem.
**When:** Any write from container to host-managed resource.
**Why:** Containers have read-only mounts of cortex/. Write path goes through IPC for authorization and validation. Same proven pattern as send_message, schedule_task.

### Pattern 3: Deterministic IDs from File Paths
**What:** Qdrant point IDs are UUIDs derived from `md5(filepath + chunk_index)`.
**When:** Any content-addressable storage.
**Why:** Re-embedding the same file produces the same IDs, making upsert idempotent. No need to track "what was previously embedded."

### Pattern 4: Content Hashing for Skip Logic
**What:** MD5 hash of chunk content stored in Qdrant payload. Skip re-embedding if hash unchanged.
**When:** Incremental pipeline updates.
**Why:** Embedding API calls cost money. Most file watches trigger for metadata changes, not content changes. Hash comparison is free.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Embedding Inside Containers
**What:** Running the embedding pipeline inside agent containers.
**Why bad:** Containers are ephemeral and per-request. Embedding needs to be continuous. Multiple containers would race on Qdrant writes. Embedding costs would multiply.
**Instead:** Single host-side embedder watches cortex/ and owns all Qdrant writes.

### Anti-Pattern 2: Full Graph Database for ~200 Files
**What:** Using Neo4j, ArangoDB, or any graph DB for cortex-graph.
**Why bad:** Massive operational overhead for a personal vault. The graph has <500 nodes and <2000 edges.
**Instead:** JSON file (cortex-graph.json). Loaded into memory by MCP server. Updated by reconciler. Simple, no dependencies.

### Anti-Pattern 3: Embedding Entire Documents as Single Vectors
**What:** One embedding per file, regardless of size.
**Why bad:** Long documents (>2000 tokens) produce diluted embeddings. Search quality degrades because the vector represents an average of many topics.
**Instead:** Chunk at heading boundaries, ~500 tokens per chunk, with title context prepended.

### Anti-Pattern 4: Synchronous Embedding in Request Path
**What:** Embedding cortex_write content before returning to the agent.
**Why bad:** Embedding API call takes 200-500ms. Agent is blocked waiting for MCP tool response.
**Instead:** Write to IPC, return immediately. Host-side pipeline embeds asynchronously. Entry is searchable within ~5 seconds.

### Anti-Pattern 5: Agent Directly Writes to cortex/ Filesystem
**What:** Mounting cortex/ as read-write in containers.
**Why bad:** Multiple containers could write simultaneously. No validation. No re-embed trigger guaranteed. Breaks the IPC authorization model.
**Instead:** cortex/ is always read-only in containers. Writes go through IPC -> host validates -> host writes -> fs.watch triggers re-embed.

---

## Scalability Considerations

| Concern | Current (~200 files) | At 1K files | At 10K files |
|---------|---------------------|-------------|--------------|
| Qdrant memory | ~50MB | ~200MB | ~2GB (may need disk-backed) |
| Embedding cost | $0.01/full index | $0.05/full index | $0.50/full index |
| Search latency | <10ms | <20ms | <50ms |
| fs.watch reliability | Fine | Fine | Need inotify limit increase |
| cortex-graph.json | <100KB | ~500KB | ~5MB (consider SQLite) |
| Bootstrap time | ~30s | ~3min | ~30min |

At current scale (~200 files), all approaches are trivially fast. The architecture accommodates 10x growth without redesign. At 100x (10K files), cortex-graph.json might need to move to SQLite, but that is a future concern.

---

## Build Order (Dependency-Driven)

```
Phase 1: Cortex Schema + Qdrant Setup
  - Define YAML frontmatter standard
  - Deploy Qdrant Docker container (systemd service)
  - No code dependencies, purely infrastructure

Phase 2: Embedding Pipeline
  - Depends on: Phase 1 (Qdrant running, schema defined)
  - src/cortex-embedder.ts -- watch, chunk, embed, upsert
  - Integration into src/index.ts startup

Phase 3: Cortex MCP Tools
  - Depends on: Phase 2 (embeddings in Qdrant to search)
  - cortex_search, cortex_read, cortex_write in ipc-mcp-stdio.ts
  - container-runner.ts mount changes
  - IPC handler for cortex_write in src/ipc.ts

Phase 4: cortex-graph.json + Graph Edges
  - Depends on: Phase 2 (embedder populates node metadata)
  - JSON schema, initial edge population
  - cortex_search returns 1-hop neighbors

Phase 5: Agent Integration + Bootstrap
  - Depends on: Phase 3 (MCP tools available)
  - CLAUDE.md auto-query instructions
  - L10/L20 population for existing projects

Phase 6: Nightshift Reconciliation
  - Depends on: Phase 2-4 (all infrastructure in place)
  - Staleness cascade, CROSS_LINK discovery, orphan cleanup
  - Scheduled task wiring

Phase 7: Lore Protocol
  - Depends on: Phase 2 (embedding pipeline to index atoms)
  - Git trailer convention
  - Parser in reconciler
  - Lowest priority, can defer
```

---

## Environment Variables (New)

| Variable | Default | Purpose |
|----------|---------|---------|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST API endpoint |
| `OPENAI_API_KEY` | (from .env) | For text-embedding-3-small |
| `CORTEX_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model name |
| `CORTEX_COLLECTION` | `cortex-entries` | Qdrant collection name |
| `CORTEX_CHUNK_SIZE` | `500` | Target tokens per chunk |
| `CORTEX_WATCH_DEBOUNCE` | `2000` | ms to debounce file changes |

---

## Sources

- [Qdrant Docker Hub](https://hub.docker.com/r/qdrant/qdrant) -- container deployment
- [Qdrant Quickstart](https://qdrant.tech/documentation/quickstart/) -- REST API, collection setup
- [@qdrant/js-client-rest npm](https://www.npmjs.com/package/@qdrant/js-client-rest) -- v1.17.0, TypeScript SDK
- [Qdrant MCP Server (official, Python)](https://github.com/qdrant/mcp-server-qdrant) -- qdrant-store/qdrant-find pattern reference
- [Embedding Models Comparison 2026](https://elephas.app/blog/best-embedding-models) -- model selection rationale
- [Voyage 4 blog](https://blog.voyageai.com/2026/01/15/voyage-4/) -- considered but overkill for vault size
- [Qdrant JS SDK](https://github.com/qdrant/qdrant-js) -- TypeScript client source
