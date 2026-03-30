# Roadmap: NanoClaw

## Milestones

- [x] **v1.0 Discord Integration** - Phases 1-8 (shipped 2026-03-27)
- [x] **v2.0 Agent Dashboard** - Phases 9-13 (shipped 2026-03-28)
- [ ] **v3.0 Agent Cortex Intelligence** - Phases 14-22 (in progress)

## Phases

<details>
<summary>v1.0 Discord Integration (Phases 1-8) - SHIPPED 2026-03-27</summary>

### Phase 1: Bot Foundation
**Goal**: Discord bot connects and self-registers as a channel
**Plans**: 2 plans

Plans:
- [x] 01-01: Merge DiscordChannel from nanoclaw-discord remote
- [x] 01-02: Shard disconnect/reconnect/resume event logging

### Phase 2: Inbound Message Handling
**Goal**: Discord messages trigger agent with full context
**Plans**: 1 plan

Plans:
- [x] 02-01: Trigger detection, reply preview, attachment metadata

### Phase 3: Outbound Formatting
**Goal**: Rich embeds and markdown-aware chunking for all outbound message types
**Plans**: 2 plans

Plans:
- [x] 03-01: Markdown-aware 2000-char chunker, color-coded embed builders
- [x] 03-02: editMessage, sendWithButtons + callbacks, sendPhoto

### Phase 4: Group Registration
**Goal**: Discord channels auto-register as groups with isolated filesystem and memory
**Plans**: 2 plans

Plans:
- [x] 04-01: Auto-registration, human-readable folder naming, DISCORD_MAIN_CHANNEL_ID
- [x] 04-02: IPC authorization for Discord JIDs

### Phase 5: Server Management
**Goal**: Agent can create/delete/rename channels and categories via IPC commands
**Plans**: 2 plans

Plans:
- [x] 05-01: DiscordServerManager with 5 CRUD actions
- [x] 05-02: IPC wiring with main-only authorization

### Phase 6: Webhook Routing
**Goal**: Webhooks (GitHub Issues, Notion, bugs, progress) routable to any Discord channel
**Plans**: 2 plans

Plans:
- [x] 06-01: discord-routing.json config, Zod validation, mainJid fallback
- [x] 06-02: Task ID @jid suffix for dual-send uniqueness

### Phase 7: Swarm Bot Presence
**Goal**: Friday and Alfred post with their own identities in Discord via webhooks
**Plans**: 2 plans

Plans:
- [x] 07-01: SwarmWebhookManager, NanoClaw- prefix naming, Dicebear avatars
- [x] 07-02: Lazy webhook hydration per channel

### Phase 8: Channel Templates
**Goal**: Each Discord channel has a themed CLAUDE.md with Cortex knowledge references
**Plans**: 1 plan

Plans:
- [x] 08-01: 8 themed CLAUDE.md templates loaded via createGroupStub()

</details>

<details>
<summary>v2.0 Agent Dashboard (Phases 9-13) - SHIPPED 2026-03-28</summary>

### Phase 9: Agent Message Schema
**Goal**: All #agents messages carry structured, machine-parseable embed metadata
**Plans**: 1 plan

Plans:
- [x] 09-01: Zod schema, AgentMessageMeta types, withAgentMeta() helper, AGENT_COLORS

### Phase 10: Agent Status Reporting
**Goal**: Agents announce task lifecycle events (picked up, in progress, closed) to #agents
**Plans**: 2 plans

Plans:
- [x] 10-01: Embed builders (took/closed/progress) with tests, sendEmbed channel method
- [x] 10-02: Host-side wiring: sendToAgents, scheduler reporting, IPC handler, MCP tool

### Phase 11: Blocker & Handoff Reporting
**Goal**: Agents surface blockers and handoffs as actionable embeds in #agents
**Plans**: 2 plans

Plans:
- [x] 11-01: Blocker and handoff embed builders with unit tests
- [x] 11-02: IPC MCP tools (container) and host-side IPC handlers

### Phase 12: Morning Digest Routing
**Goal**: Morning Digest posts to #agents instead of Telegram main chat
**Plans**: 1 plan

Plans:
- [x] 12-01: Schema migration, routing.json config, task-scheduler routing logic

### Phase 13: Health Monitoring
**Goal**: Alfred monitors tunnel and service health and posts state changes to #logs
**Plans**: 2 plans

Plans:
- [x] 13-01: Health monitor embeds, core polling loop, state tracking with tests
- [x] 13-02: Wire startHealthMonitor into index.ts startup and shutdown

</details>

### v3.0 Agent Cortex Intelligence

**Milestone Goal:** Agents can retrieve surgically scoped context before every task -- closing the "decision shadow" where agents see what code does but not why decisions were made.

- [ ] **Phase 14: Cortex Schema Standard** - Define YAML frontmatter spec and knowledge pyramid levels
- [ ] **Phase 15: Qdrant Infrastructure** - Deploy persistent vector DB with systemd lifecycle management
- [ ] **Phase 16: Embedding Pipeline** - Host-side service converts Cortex entries to vectors with deduplication
- [ ] **Phase 17: Search & MCP Tools** - Agents can search, read, and write Cortex entries from containers
- [ ] **Phase 18: Knowledge Bootstrap** - Populate NanoClaw L10-L20 entries and wire agent auto-query
- [ ] **Phase 19: Knowledge Graph** - Explicit relationship edges between Cortex entries with agent tooling
- [ ] **Phase 20: Lore Protocol** - Git trailer knowledge atoms indexed into Cortex
- [ ] **Phase 21: Nightshift Reconciliation** - Nightly autonomous maintenance: staleness, discovery, cleanup
- [ ] **Phase 22: Multi-Project Bootstrap** - Extend Cortex coverage to YourWave, ContentFactory, NightShift

## Phase Details

### Phase 14: Cortex Schema Standard
**Goal**: A locked YAML frontmatter standard exists that all downstream components (embedder, MCP tools, reconciler) can depend on without risk of breaking changes
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: SCHEMA-01
**Success Criteria** (what must be TRUE):
  1. A Cortex entry file with valid frontmatter passes schema validation (cortex_level, confidence, domain, scope, source_hash, embedding_model fields present and correctly typed)
  2. A Cortex entry file with missing or invalid fields fails validation with a clear error message identifying what is wrong
  3. Knowledge pyramid levels (L10-L50) are documented with definitions, examples, and staleness TTLs
**Plans**: 1 plan

Plans:
- [ ] 14-01-PLAN.md — Zod schema + validation, gray-matter parser, knowledge pyramid docs

### Phase 15: Qdrant Infrastructure
**Goal**: A persistent Qdrant vector database is running, survives host reboots and container rebuilds, and is ready to receive embeddings
**Depends on**: Phase 14
**Requirements**: SCHEMA-02, SCHEMA-03
**Success Criteria** (what must be TRUE):
  1. Qdrant container is running at localhost:6333 with the cortex-entries collection created (cosine distance, HNSW index, payload indexes on project/level/status)
  2. Qdrant auto-starts on system boot via systemd and restarts on failure
  3. Qdrant data survives container rebuild -- bind-mount volume at ./data/qdrant persists across docker rm/run cycles
**Plans**: TBD

### Phase 16: Embedding Pipeline
**Goal**: Cortex entries are automatically converted to searchable vectors whenever content changes, with no redundant API calls for unchanged content
**Depends on**: Phase 15
**Requirements**: EMBED-01, EMBED-02, EMBED-03, EMBED-04
**Success Criteria** (what must be TRUE):
  1. Writing or updating a Cortex entry file triggers automatic embedding and upsert into Qdrant (via fs.watch on cortex/ directory)
  2. Running the batch re-embed command rebuilds the full collection from all Cortex entry files
  3. Unchanged entries (matching content hash) are skipped during both watch-triggered and batch re-embed operations
  4. Qdrant points contain full payload metadata (cortex_level, domain, project, source_hash, embedding_model)
**Plans**: TBD

### Phase 17: Search & MCP Tools
**Goal**: Container agents can search, read, and write Cortex entries using MCP tools -- the primary agent interface to the knowledge layer
**Depends on**: Phase 16
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, MCP-01, MCP-02, MCP-03, MCP-05
**Success Criteria** (what must be TRUE):
  1. Agent in a container calls cortex_search with a natural language query and receives ranked results with metadata
  2. Agent calls cortex_search with an exact vault path or ID and receives the matching entry directly (hybrid search routing)
  3. Agent calls cortex_read with an entry ID/path and receives the full entry content including frontmatter
  4. Agent calls cortex_write with valid content and the entry is created/updated on disk with schema validation, then auto-embedded
  5. Search results are filterable by project, cortex_level, and domain; confidence firewall prevents L(N) writes when L(N-1) lacks medium+ confidence
**Plans**: TBD

### Phase 18: Knowledge Bootstrap
**Goal**: Cortex contains useful NanoClaw knowledge and agents automatically query it at task start -- first real value delivery from the knowledge layer
**Depends on**: Phase 17
**Requirements**: POP-01, POP-03
**Success Criteria** (what must be TRUE):
  1. Bootstrap script produces 50-100 L10-L20 entries covering NanoClaw src/ exports, IPC contracts, env vars, and channel interfaces
  2. Container CLAUDE.md instructs agents to query Cortex at task start, and agents follow this instruction
  3. An agent in a container calls cortex_search for a NanoClaw concept and receives a relevant bootstrapped entry (end-to-end smoke test)
**Plans**: TBD

### Phase 19: Knowledge Graph
**Goal**: Cortex entries have explicit typed relationships that agents can traverse to discover connected context beyond keyword similarity
**Depends on**: Phase 18
**Requirements**: GRAPH-01, GRAPH-02, MCP-04
**Success Criteria** (what must be TRUE):
  1. cortex-graph.json stores typed edges (BUILT_FROM, REFERENCES, BLOCKS, CROSS_LINK, SUPERSEDES) between entry IDs
  2. cortex_search results include 1-hop graph neighbors alongside semantic matches
  3. Agent calls cortex_relate to declare an edge between two entries and the edge persists in cortex-graph.json
**Plans**: TBD

### Phase 20: Lore Protocol
**Goal**: Architectural decisions captured in git commit trailers are indexed as searchable Cortex entries, closing the gap between "what changed" and "why it changed"
**Depends on**: Phase 16
**Requirements**: LORE-01, LORE-02, LORE-03
**Success Criteria** (what must be TRUE):
  1. Git commit trailer convention (Constraint/Rejected/Directive atoms) is documented with good and bad examples in CLAUDE.md
  2. Native git parsing extracts lore atoms from commit trailers without any external CLI dependency
  3. Extracted lore atoms are indexed in Qdrant as type lore-atom and returned by cortex_search queries
**Plans**: TBD

### Phase 21: Nightshift Reconciliation
**Goal**: The knowledge layer maintains itself autonomously -- stale entries are flagged, new connections are discovered, and orphans are cleaned up without human intervention
**Depends on**: Phase 19, Phase 20
**Requirements**: NIGHT-01, NIGHT-02, NIGHT-03, NIGHT-04
**Success Criteria** (what must be TRUE):
  1. Nightshift reconciliation runs nightly as an Alfred scheduled task (wired into task-scheduler.ts)
  2. Entries not updated in N configurable days are flagged as stale based on cortex_level TTL
  3. Semantically similar entries above cosine threshold are proposed as CROSS_LINK edges in cortex-graph.json
  4. Orphan entries (no references, no searches, missing frontmatter) are identified and reported
  5. A 3-5 line summary report posts to #agents after each nightly run
**Plans**: TBD

### Phase 22: Multi-Project Bootstrap
**Goal**: Cortex coverage extends beyond NanoClaw to YourWave, ContentFactory, and NightShift -- validating the knowledge layer works across multiple codebases
**Depends on**: Phase 18
**Requirements**: POP-02
**Success Criteria** (what must be TRUE):
  1. Bootstrap scripts produce L10-L20 entries for YourWave, ContentFactory, and NightShift projects
  2. Cortex search results are correctly scoped by project filter -- no cross-project contamination in filtered queries
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22
Note: Phase 20 (Lore Protocol) depends only on Phase 16 and can execute in parallel with Phases 17-19.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. Cortex Schema Standard | v3.0 | 0/1 | Planning | - |
| 15. Qdrant Infrastructure | v3.0 | 0/0 | Not started | - |
| 16. Embedding Pipeline | v3.0 | 0/0 | Not started | - |
| 17. Search & MCP Tools | v3.0 | 0/0 | Not started | - |
| 18. Knowledge Bootstrap | v3.0 | 0/0 | Not started | - |
| 19. Knowledge Graph | v3.0 | 0/0 | Not started | - |
| 20. Lore Protocol | v3.0 | 0/0 | Not started | - |
| 21. Nightshift Reconciliation | v3.0 | 0/0 | Not started | - |
| 22. Multi-Project Bootstrap | v3.0 | 0/0 | Not started | - |
