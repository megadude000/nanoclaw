# Pitfalls Research

**Domain:** Agent Cortex Intelligence -- vector search, embedding pipelines, MCP tools, knowledge graphs, Lore Protocol, nightshift reconciliation
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH (combination of verified sources + domain-specific NanoClaw analysis)

## Critical Pitfalls

### Pitfall 1: Embedding Model Lock-In Without Version Tracking

**What goes wrong:**
You embed all Cortex entries with Model A, then later switch to Model B (better benchmarks, cheaper, or Model A gets deprecated). Every existing embedding is now incompatible -- vectors from different models live in different geometric spaces. Search returns garbage results, but the system looks healthy because Qdrant still returns top-K results. They are just the wrong results.

**Why it happens:**
Teams treat embeddings as static artifacts. They store vectors without recording which model produced them. When the model changes, there is no mechanism to detect the mismatch or trigger re-embedding. This is the "embedding drift" problem -- the silent killer of retrieval quality.

**How to avoid:**
Store metadata with every vector point in Qdrant: `embedding_model`, `model_version`, `text_checksum`, `chunking_config_hash`. On query, verify the query embedding model matches the collection's model. Build re-embedding as a first-class operation from day one -- a CLI command or nightshift task that can re-embed the entire collection in one run.

**Warning signs:**
- Search relevance drops without any content changes
- Cortex entries that should match stop appearing in results
- New entries seem to cluster differently from old ones

**Phase to address:**
Embedding Pipeline phase -- metadata schema must be defined before the first vector is stored.

---

### Pitfall 2: Qdrant Docker Volume Loss on Container Rebuild

**What goes wrong:**
You run `docker compose down` or rebuild the Qdrant container and all vectors are gone. The entire Cortex index disappears. This is especially dangerous because NanoClaw already has a `container/build.sh` that rebuilds agent containers, and the habit of rebuilding containers is deeply ingrained in this project.

**Why it happens:**
Qdrant stores data at `/qdrant/storage` inside the container. Without an explicit volume mount to the host, data lives only in the container's writable layer. Docker documentation makes this clear, but developers often start with the quickstart command (`docker run qdrant/qdrant`) which has no persistence, then forget to add `-v` when moving to production.

**How to avoid:**
1. Define Qdrant in a `docker-compose.yml` with an explicit named volume or bind mount: `./data/qdrant:/qdrant/storage`
2. Place the Qdrant data directory under NanoClaw's existing `data/` directory for consistency
3. Add a snapshot cron job (Qdrant's `/collections/{name}/snapshots` REST endpoint) as a nightshift task
4. Test recovery from snapshot before going live

**Warning signs:**
- Running `docker compose up` shows zero collections after restart
- Qdrant logs show "creating new storage" instead of "loading existing"

**Phase to address:**
Qdrant Setup phase -- volume mount must be in the initial docker-compose.yml before any data is ingested.

---

### Pitfall 3: MCP Tool Explosion -- Too Many Tools Confuse the Agent

**What goes wrong:**
You build `cortex_search`, `cortex_read`, `cortex_write`, `cortex_delete`, `cortex_list`, `cortex_update_graph`, `cortex_stale_check`, `cortex_bootstrap`, `cortex_validate` -- and the agent starts picking the wrong tool or hallucinating parameters. Each additional MCP tool competes for the model's attention in the tool-selection step. Research confirms that "tool descriptions that are defective, underspecified, or misleading can cause foundation models to select the wrong tool, supply invalid or suboptimal arguments, or take unnecessary interaction steps."

**Why it happens:**
Developers design tools from an API perspective (one tool per operation) rather than from the agent's perspective (what does the agent actually need to do?). The MCP best practices explicitly warn: "Build small, focused MCP servers that do one thing well" but this gets interpreted as "many small tools" instead of "few tools, each well-scoped."

**How to avoid:**
Start with exactly 3 tools maximum for Cortex:
- `cortex_search` -- find relevant knowledge (read path)
- `cortex_read` -- get full content of a specific entry (read path)
- `cortex_write` -- create or update an entry (write path)

Everything else (graph management, staleness, validation) should be host-side nightshift operations, not agent-facing tools. Agents do not need to manage the knowledge graph -- they need to query it and contribute to it. NanoClaw already has 8 MCP tools (`send_message`, `schedule_task`, `list_tasks`, `pause_task`, `resume_task`, `cancel_task`, `update_task`, `register_group`). Adding 3 more brings the total to 11 -- manageable. Adding 9 more would bring it to 17 -- problematic.

**Warning signs:**
- Agent calls the wrong cortex tool for simple operations
- Agent passes parameters meant for one tool to another
- Agent descriptions in SKILL.md require long disambiguation sections

**Phase to address:**
MCP Tools phase -- tool surface must be designed before implementation. Review against existing `mcp__nanoclaw__*` tools to keep total count manageable.

---

### Pitfall 4: Knowledge Staleness Cascade -- Stale Entries Poison Search Results

**What goes wrong:**
A Cortex entry says "we use Baileys for WhatsApp" but WhatsApp is now a separate skill. An agent queries Cortex, gets the stale entry, and makes decisions based on outdated architecture. The agent trusts Cortex because that is its purpose -- there is no skepticism built in. This is the "Decision Shadow" problem the Lore paper describes, but in reverse: instead of missing context, the agent has wrong context.

**Why it happens:**
Knowledge entries are created eagerly (during bootstrap, during work) but staleness detection requires comparing entries against current source code -- an expensive cross-referencing operation nobody runs regularly. The Cortex grows monotonically but the codebase evolves, creating drift. Research confirms: "RAG systems usually degrade because embeddings become outdated, vector indexes drift after frequent writes, and older document chunks remain mixed with fresh ones."

**How to avoid:**
1. Every Cortex entry must have a `source_hash` field -- a hash of the source file(s) it describes
2. Nightshift reconciliation compares stored hashes against current file hashes
3. Entries where source changed get flagged as `status: stale` and demoted in search ranking
4. Qdrant payload filtering: exclude `status: stale` from default searches, include only when explicitly requested
5. Set a `max_age` policy: entries older than N days without re-validation get auto-flagged

**Warning signs:**
- Agents reference architecture patterns that no longer exist
- Cortex entries mention deleted files or removed features
- Bootstrap entries never get updated after initial population

**Phase to address:**
Nightshift Reconciliation phase -- but the `source_hash` metadata field must be defined in the Cortex Schema phase.

---

### Pitfall 5: Embedding at Ingest vs. Embedding at Query -- Asymmetric Processing

**What goes wrong:**
You preprocess text differently at index time vs. query time. For example: at ingest you strip YAML frontmatter, but at query time you embed the raw query including metadata keywords. Or at ingest you chunk by heading, but queries are short questions. The geometric space becomes inconsistent -- queries and documents occupy different regions even when semantically related.

**Why it happens:**
Index-time and query-time code paths are written at different times, often by different agents or in different phases. There is no shared function that both paths call. Some embedding models (nomic-embed-text, E5) require different prefixes for documents vs. queries (`search_document:` vs. `search_query:`), and forgetting this produces subtly wrong results.

**How to avoid:**
Create a single `prepareTextForEmbedding(text: string, type: 'document' | 'query'): string` function. Both the indexing pipeline and the query path must use this function. The function handles frontmatter stripping, normalization, prefix tokens. Test with round-trip: embed a document, then query with its own title -- it should be the top result.

**Warning signs:**
- Search for an exact entry title returns that entry below position 3
- Results seem random despite good embeddings
- Relevance is worse for short queries than long queries (or vice versa)

**Phase to address:**
Embedding Pipeline phase -- the shared preprocessing function must be the first thing built before any indexing or searching happens.

---

### Pitfall 6: Lore Protocol Adoption Produces Low-Quality Knowledge Atoms

**What goes wrong:**
Agents produce Lore commits with rubber-stamped trailers that contain no actual insight. Every commit gets `Constraint: none`, `Rejected: none`, `Confidence: high`. The git history fills with noise that looks like knowledge but adds zero value. Future agents waste context window tokens reading empty atoms.

**Why it happens:**
The Lore paper itself acknowledges this: "rubber-stamped low-quality atoms require lore validate checks." Agents optimize for compliance (produce trailers) rather than value (produce insight). Without quality gates, the path of least resistance is boilerplate. Additionally, git trailer parsing is "a bit of a pain to parse reliably" -- you basically end up having to use the git CLI to ensure proper parsing.

**How to avoid:**
1. Lore trailers are NOT mandatory for every commit -- only for commits that involve a decision (architecture choice, rejected alternative, constraint discovery)
2. Add a `lore validate` step to the nightshift that scores atom quality (non-empty Rejected field, specific Constraint references, etc.)
3. Define clear examples in CLAUDE.md of good vs. bad Lore atoms
4. Start small: only require Lore atoms for architectural decisions, not routine code changes
5. Use `git log --format='%(trailers:key=Constraint)'` for extraction, not custom parsing

**Warning signs:**
- More than 50% of Lore atoms have empty or generic Rejected/Constraint fields
- `lore context <path>` returns dozens of results but none are useful
- Agents copy-paste the same trailer template without modification

**Phase to address:**
Lore Protocol phase -- quality criteria and validation must be defined alongside the trailer format.

---

### Pitfall 7: Bootstrap Scope Creep -- Trying to Index Everything at Once

**What goes wrong:**
The knowledge bootstrap phase tries to create L10-L50 entries for NanoClaw, YourWave, Night Shift, and Content Factory simultaneously. The embedding pipeline is not yet battle-tested, the schema is not yet proven, and you end up with thousands of entries that need to be re-done when the schema changes. Worse, the bootstrap takes so long that it blocks progress on the actual Cortex tools agents need.

**Why it happens:**
PROJECT.md lists "L10-L20 population for NanoClaw (src/), YourWave (YW_Core), Night Shift system, Content Factory" as a single line item. It looks like one task but it is four separate indexing projects, each with different source structures. The temptation to "just run the bootstrap across everything" is strong.

**How to avoid:**
Bootstrap ONE project first (NanoClaw -- it is the project you are building in). Use it as the test bed for the entire pipeline: schema, embedding, search, MCP tools, staleness detection. Only after NanoClaw's Cortex is working end-to-end should you bootstrap additional projects. Each additional project is a separate phase task, not a batch operation.

**Warning signs:**
- Bootstrap script runs for hours with no feedback
- Schema changes require re-running bootstrap for all projects
- Cortex has entries but no agent has ever successfully queried them

**Phase to address:**
Knowledge Bootstrap phase -- must be sequenced AFTER Cortex MCP tools are working, and scoped to one project initially.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode embedding model name | Faster initial implementation | Cannot switch models without code changes everywhere | Never -- use a config constant from day one |
| Skip HNSW index on Qdrant collection | Simpler setup, exact search | Queries degrade from <50ms to >500ms past ~10K vectors | Only during initial development with <1K entries, add index before bootstrap |
| Store embeddings without metadata | Less code, simpler upsert | Cannot track staleness, model version, or trigger selective re-embedding | Never -- metadata is cheap, recovery is expensive |
| Single Qdrant collection for all projects | Simpler architecture | Cross-project contamination in search results, cannot tune per-project | MVP only -- separate collections per project before multi-project bootstrap |
| Synchronous embedding on write | Simpler flow, immediate consistency | Blocks the agent while embedding runs (~100-500ms per entry via API) | Acceptable for `cortex_write` since writes are infrequent; batch operations must be async |
| No snapshot/backup for Qdrant | Faster setup | One bad operation or container issue loses entire index | Never -- add snapshot job in the same phase as Qdrant setup |
| cortex-graph.json as flat file | No additional DB dependency | Unbounded growth, O(n) lookups, file locking issues | Acceptable under ~500 edges; plan SQLite migration threshold |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Qdrant Node.js SDK | Using `qdrant-js` (deprecated community package) | Use `@qdrant/qdrant-js` -- the official SDK maintained by Qdrant team |
| Qdrant Docker | Exposing port 6333 to all interfaces (0.0.0.0) | Bind to localhost only (`127.0.0.1:6333:6333`) -- this is a private single-user system |
| Embedding API | Making one API call per entry during bootstrap | Batch embed: most APIs accept arrays. OpenAI handles up to 2048 inputs per request. Reduces latency 10-50x |
| MCP tool registration | Registering Cortex MCP tools globally for all container agents | Only mount Cortex tools for groups that need them (main group, specific project groups). Non-relevant groups should not see Cortex tools |
| IPC for Cortex | Building a new IPC mechanism for Cortex queries | Use existing IPC file-based system (`/workspace/ipc/`). Cortex MCP tools should write IPC commands that the host processes, same pattern as `report_agent_status` |
| Lore CLI | Installing Lore globally on the host and parsing trailers manually | Use `git log --format='%(trailers:key=Constraint)'` directly -- native git trailer queries are more reliable than custom parsing |
| cortex-graph.json | Storing graph in a single flat JSON file that grows unbounded | Start with JSON but set a migration threshold. At >500 edges, switch to SQLite table with indexed lookups |
| Nightshift reconciliation | Running reconciliation as a standalone cron separate from existing task scheduler | Wire it through NanoClaw's existing `task-scheduler.ts` as a scheduled task, same as morning digest. Keeps all scheduling in one place |
| Qdrant distance metric | Using default distance without checking embedding model docs | Match distance metric to model: cosine for most models (OpenAI, nomic). Wrong metric = wrong results, no error |
| Obsidian vault sync | Writing to cortex/ Obsidian vault while Obsidian is syncing | Cortex writes go to Qdrant first (source of truth for search), Obsidian files are the human-readable mirror. Avoid write contention by using async file writes with retry |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full re-embedding on every reconciliation | Nightshift takes hours, API costs spike | Track `text_checksum` per entry; only re-embed when content actually changed | >500 entries, or if using paid API embeddings |
| No payload index on Qdrant filter fields | Filtered searches (by project, status, level) slow down linearly | Create payload indexes on `project`, `status`, `level` fields at collection creation | >5K entries with filtered queries |
| Loading full Cortex entry content in search results | Search response becomes huge, slows agent context loading | Return only metadata + snippet in search; full content via separate `cortex_read` call | >50 results or entries with >2K tokens each |
| Embedding API rate limits during bootstrap | Bootstrap hangs or fails halfway, leaving partial index | Implement exponential backoff + checkpoint (track last-indexed entry). Resume from checkpoint on failure | >100 entries with OpenAI rate limits (3000 RPM for text-embedding-3-small) |
| Qdrant collection without HNSW index | Queries take >500ms, exact nearest-neighbor scan on every query | Create HNSW index immediately after collection creation, before any bulk insert | >10K vectors (but add it from the start -- no reason not to) |
| cortex-graph.json read/write on every search | Disk I/O becomes bottleneck for graph traversal | Load graph into memory at startup, write to disk on changes only. Reload on nightshift completion | >500 edges or frequent graph queries |
| Agent auto-queries Cortex on every message | Added 200-500ms latency to simple "/status" or "hello" messages | Only auto-query Cortex when message involves a task or project question. Use trigger-pattern detection before Cortex query | Always -- latency is noticeable from the first message |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Qdrant REST API without auth | Anyone on the network can read/delete all Cortex knowledge | Bind Qdrant to localhost only. NanoClaw is single-user on a private server -- network isolation is sufficient |
| Storing API keys for embedding service in Cortex entries | Keys end up in vector DB, potentially retrievable via semantic search | Embedding API key goes in `.env` only, injected via OneCLI. Cortex entries never contain secrets |
| Cortex entries containing credentials from indexed source files | Secrets in code get embedded and become searchable | Pre-filter bootstrap: skip files matching `.env`, `credentials`, `secret`, `token` patterns. Add a deny-list to the indexing pipeline |
| MCP cortex_write without authorization | Any container agent in any group can write arbitrary knowledge | Restrict `cortex_write` to main group agents only (same pattern as server management IPC authorization in `ipc.ts`) |
| Lore atoms exposing internal architecture to public repos | Decision rationale in trailers leaks implementation details | NanoClaw is private. But if Lore is adopted for public repos (YourWave), review trailer content for sensitive details |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Agent dumps raw Cortex search results to user | Overwhelming wall of knowledge entries | Agent synthesizes Cortex results into response. User never sees raw output unless they ask |
| Cortex search returns irrelevant results for vague queries | User loses trust ("Cortex is useless") | Combine vector search with keyword filtering. Short queries (<3 words) prefer exact title match before semantic fallback |
| Nightshift reconciliation produces verbose reports | Morning digest becomes unreadable | Report 3-5 lines max: X validated, Y flagged stale, Z new edges. Details only on request |
| Agent auto-queries Cortex for every trivial message | Latency on simple commands, wasted tokens | Cortex query only for project/task questions, not casual conversation or operational commands |

## "Looks Done But Isn't" Checklist

- [ ] **Qdrant setup:** Data persists across container restart -- verify by stopping and starting Qdrant, then querying existing collection
- [ ] **Embedding pipeline:** Round-trip test passes -- embed an entry, search for its title, verify it is the top result
- [ ] **MCP cortex_search:** Works from inside a container agent -- not just from host-side tests. Agent can call it and get results back through IPC
- [ ] **cortex_write:** Entry appears in Qdrant AND in Obsidian vault (if dual-storage is the design) -- check both locations
- [ ] **Nightshift reconciliation:** Actually detects a manually-staled entry -- test by modifying a source file and running reconciliation
- [ ] **Lore Protocol:** `git log --format='%(trailers:key=Constraint)'` returns non-empty results for commits that have Lore atoms
- [ ] **Knowledge bootstrap:** Agent can query bootstrapped knowledge and get a useful, correct answer -- not just "entries exist in Qdrant"
- [ ] **cortex-graph.json:** Edges reference entries that actually exist -- no dangling references after entry deletion
- [ ] **Search relevance:** Top-3 results for 10 representative queries are actually relevant -- manual spot-check required, no automation shortcut
- [ ] **Container mount:** Cortex MCP tools are accessible inside agent container via `/workspace/` mount pattern, same as existing MCP tools
- [ ] **Staleness metadata:** Every Qdrant point has `source_hash`, `embedding_model`, `created_at`, `validated_at` in its payload

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Lost Qdrant data (no volume mount) | MEDIUM | Re-run bootstrap from source files. If snapshots exist, restore via Qdrant CLI `--snapshot` flag at startup |
| Embedding model mismatch (mixed vectors) | HIGH | Must re-embed entire collection. Delete collection, recreate with correct config, re-run full bootstrap |
| Stale Cortex entries causing bad agent decisions | LOW | Run staleness cascade manually via nightshift reconciliation. Flag stale entries. No data loss |
| MCP tool confusion (too many tools) | LOW | Consolidate tools, update SKILL.md descriptions. No data migration needed |
| Lore noise (low-quality atoms) | LOW | Run quality filter. Bad atoms stay in git history but get excluded from Cortex queries by quality score |
| cortex-graph.json corruption | LOW | Rebuild graph from Cortex entries (edges are derivable from entry metadata). Graph is a derived artifact, not source of truth |
| Bootstrap schema change mid-project | HIGH | Must re-bootstrap all entries with new schema. Mitigate by finalizing schema before any bootstrap begins |
| Wrong distance metric on collection | MEDIUM | Cannot change metric on existing collection. Must recreate collection and re-insert all points |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Embedding model lock-in (P1) | Cortex Schema + Embedding Pipeline | Every Qdrant point has `embedding_model` in payload metadata |
| Qdrant data loss (P2) | Qdrant Setup | Stop/start Qdrant container, verify data persists. Restore from snapshot |
| MCP tool explosion (P3) | MCP Tools Design | Total tool count stays at 3 Cortex + 8 existing = 11 max |
| Knowledge staleness (P4) | Cortex Schema (fields) + Nightshift (detection) | Modify source file, run reconciliation, verify entry flagged stale |
| Asymmetric preprocessing (P5) | Embedding Pipeline | Round-trip test: embed entry, search by title, verify top-1 result |
| Lore quality (P6) | Lore Protocol | Sample 10 Lore atoms, verify >70% have non-trivial Rejected/Constraint |
| Bootstrap scope creep (P7) | Knowledge Bootstrap | Bootstrap NanoClaw first. Other projects are explicitly separate follow-up tasks |
| cortex-graph.json growth | Graph Design (initial) + Nightshift (monitoring) | Graph edge count proportional to entry count (max ~3x ratio) |

## Sources

- [Qdrant Docker Hub](https://hub.docker.com/r/qdrant/qdrant) -- volume mount and persistence documentation
- [Qdrant Snapshots Documentation](https://qdrant.tech/documentation/concepts/snapshots/) -- backup, restore, and snapshot storage configuration
- [@qdrant/qdrant-js npm](https://www.npmjs.com/package/@qdrant/qdrant-js) -- official Node.js SDK, v1.17.0
- [4 pgvector Mistakes That Silently Break Your RAG Pipeline](https://dev.to/mianzubair/4-pgvector-mistakes-that-silently-break-your-rag-pipeline-in-production-4e0p) -- indexing, dimensions, distance metrics (applicable to all vector DBs)
- [Embedding Infrastructure at Scale](https://introl.com/blog/embedding-infrastructure-scale-vector-generation-production-guide-2025) -- batch processing, cost optimization, scaling considerations
- [Detecting Embedding Drift: The Silent Killer of RAG Accuracy](https://decompressed.io/learn/embedding-drift) -- version tracking, drift detection strategies
- [Your Vector Search is (Probably) Broken](https://materialize.com/blog/your-vector-search-is-probably-broken/) -- staleness, incremental updates, CDC-driven refresh
- [Lore: Repurposing Git Commit Messages as a Structured Knowledge Protocol](https://arxiv.org/html/2603.15566v1) -- Lore protocol design, quality validation concerns, adoption challenges
- [MCP Best Practices: Architecture and Implementation Guide](https://modelcontextprotocol.info/docs/best-practices/) -- focused servers, error handling, tool description quality
- [Real Faults in MCP Software: a Comprehensive Taxonomy](https://arxiv.org/html/2603.05637v1) -- production MCP failure modes, configuration complexity
- [MCP Tool Descriptions Are Smelly](https://arxiv.org/html/2602.14878v1) -- tool description quality impact on agent behavior
- [Best Open-Source Embedding Models Benchmarked](https://supermemory.ai/blog/best-open-source-embedding-models-benchmarked-and-ranked/) -- model comparison and selection guidance
- [Nomic Embed Text V2 MoE](https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe) -- local embedding model with prefix requirements
- [7 Ways to Keep Embeddings Fresh](https://medium.com/@ThinkingLoop/7-ways-to-keep-embeddings-fresh-no-big-reindex-45e3e33a1fd6) -- incremental update strategies
- NanoClaw source analysis: `src/ipc.ts` (IPC authorization model, existing MCP tool surface), `src/container-runner.ts` (container mount patterns), `container/skills/status/SKILL.md` (existing MCP tool example), `cortex/CLAUDE.md` (current Obsidian vault structure)

---
*Pitfalls research for: Agent Cortex Intelligence -- v3.0 NanoClaw*
*Researched: 2026-03-28*
