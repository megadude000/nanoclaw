# Requirements: NanoClaw v3.0 Agent Cortex Intelligence

**Defined:** 2026-03-28
**Core Value:** Agents can retrieve surgically scoped context before every task -- closing the "decision shadow" where agents see what code does but not why decisions were made.

## v3.0 Requirements

Requirements for Cortex Intelligence milestone. Each maps to roadmap phases.

### Schema & Infrastructure

- [x] **SCHEMA-01**: Cortex YAML frontmatter standard defined with cortex_level (L10-L50), confidence, domain, scope fields
- [x] **SCHEMA-02**: Qdrant Docker container deployed with persistent volume and cortex-entries collection
- [x] **SCHEMA-03**: Qdrant auto-starts via systemd or docker-compose alongside NanoClaw

### Embedding Pipeline

- [x] **EMBED-01**: Host-side embedding service converts Cortex entries to vectors using OpenAI text-embedding-3-small
- [x] **EMBED-02**: Entries auto-embed on cortex_write (agent-initiated writes trigger re-embedding)
- [x] **EMBED-03**: Batch re-embed command for full collection rebuild
- [x] **EMBED-04**: Content-hash skip logic avoids re-embedding unchanged entries

### Search & Retrieval

- [x] **SEARCH-01**: Hybrid search routing -- exact (vault path/ID) vs semantic (Qdrant) based on query shape
- [x] **SEARCH-02**: Confidence firewall enforces L(N) population only when L(N-1) has medium+ confidence
- [x] **SEARCH-03**: Search results filterable by project, cortex_level, and domain

### MCP Tools

- [x] **MCP-01**: cortex_search tool available in container agents -- semantic search with filtering
- [x] **MCP-02**: cortex_read tool available in container agents -- exact entry retrieval by ID or path
- [x] **MCP-03**: cortex_write tool available in container agents -- create/update with schema validation + auto-embed
- [ ] **MCP-04**: cortex_relate tool available in container agents -- declare graph edges between entries
- [x] **MCP-05**: All 4 tools added to existing ipc-mcp-stdio.ts (no new MCP server process)

### Knowledge Graph

- [x] **GRAPH-01**: cortex-graph.json stores explicit edges (BUILT_FROM, REFERENCES, BLOCKS, CROSS_LINK)
- [ ] **GRAPH-02**: Graph queryable from cortex_search results (traverse related entries)

### Knowledge Population

- [x] **POP-01**: Bootstrap script extracts L10-L20 entries from NanoClaw codebase (~50-100 entries)
- [ ] **POP-02**: Bootstrap script extracts L10-L20 entries from YourWave, ContentFactory, NightShift
- [x] **POP-03**: Container CLAUDE.md instructs agents to auto-query Cortex at task start

### Decision Context (Lore Protocol)

- [ ] **LORE-01**: Lore Protocol convention defined -- git trailer format (Constraint/Rejected/Directive atoms)
- [ ] **LORE-02**: Native git parsing extracts lore atoms from commit trailers (~10 lines, no CLI dependency)
- [ ] **LORE-03**: Lore atoms indexed into Cortex entries and searchable via cortex_search

### Autonomous Maintenance (Nightshift)

- [ ] **NIGHT-01**: Nightshift reconciliation runs nightly via Alfred scheduled task
- [ ] **NIGHT-02**: Staleness cascade flags entries not updated in configurable N days
- [ ] **NIGHT-03**: CROSS_LINK auto-discovery promotes semantically similar entries (cosine > threshold) to graph edges
- [ ] **NIGHT-04**: Orphan cleanup identifies entries with no references or searches

## Future Requirements

### Deferred from v2.0

- **SEARCH-02-v2**: Agent can query #agents message history via IPC command
- **SEARCH-03-v2**: #agents serves as persistent activity log -- messages never deleted

### Future Enhancements

- **L30-L50 population**: Higher-level knowledge entries (system topology, project domains, user journeys)
- **Versioned embedding migration**: Re-embed pipeline if OpenAI changes model dimensions
- **Cross-agent knowledge sharing**: Real-time Cortex updates visible to concurrent agents

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full graph database (Neo4j, ArangoDB) | Massive overkill for ~500-1000 entries. JSON adjacency list fits in memory. |
| Local embedding model (Nomic, Ollama) | Adds ONNX complexity for zero cost savings ($0.01/month vs free). API quality is higher. |
| Real-time embedding (on every file save) | Obsidian saves on keystrokes. Would waste API calls. Embed on write + nightly is sufficient. |
| RAG chunk splitting | Cortex entries ARE the chunks. Knowledge pyramid solves the structuring problem by design. |
| Web UI for Cortex | Obsidian IS the human interface. Building a custom UI duplicates existing capability. |
| Discord/Slack commands for Cortex | Agents have MCP tools. Humans have Obsidian. Third interface adds maintenance for no value. |
| Versioned embeddings | Old embeddings are wrong -- keeping them is misleading. Git tracks content history. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 14 | Complete |
| SCHEMA-02 | Phase 15 | Complete |
| SCHEMA-03 | Phase 15 | Complete |
| EMBED-01 | Phase 16 | Complete |
| EMBED-02 | Phase 16 | Complete |
| EMBED-03 | Phase 16 | Complete |
| EMBED-04 | Phase 16 | Complete |
| SEARCH-01 | Phase 17 | Complete |
| SEARCH-02 | Phase 17 | Complete |
| SEARCH-03 | Phase 17 | Complete |
| MCP-01 | Phase 17 | Complete |
| MCP-02 | Phase 17 | Complete |
| MCP-03 | Phase 17 | Complete |
| MCP-04 | Phase 19 | Pending |
| MCP-05 | Phase 17 | Complete |
| GRAPH-01 | Phase 19 | Complete |
| GRAPH-02 | Phase 19 | Pending |
| POP-01 | Phase 18 | Complete |
| POP-02 | Phase 22 | Pending |
| POP-03 | Phase 18 | Complete |
| LORE-01 | Phase 20 | Pending |
| LORE-02 | Phase 20 | Pending |
| LORE-03 | Phase 20 | Pending |
| NIGHT-01 | Phase 21 | Pending |
| NIGHT-02 | Phase 21 | Pending |
| NIGHT-03 | Phase 21 | Pending |
| NIGHT-04 | Phase 21 | Pending |

**Coverage:**
- v3.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*
