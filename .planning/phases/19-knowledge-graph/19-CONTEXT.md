# Phase 19: Knowledge Graph - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement cortex-graph.json as a JSON adjacency list storing typed edges between Cortex entry IDs. Add cortex_relate MCP tool so agents can declare relationships from containers. Enhance cortex_search results to include 1-hop graph neighbors alongside semantic matches.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (all areas)

The user designated all gray areas as coding decisions for Claude:

**Edge types & semantics:**
- Which edge types to implement (BUILT_FROM, REFERENCES, BLOCKS, CROSS_LINK, SUPERSEDES)
- Whether to support custom/arbitrary edge types or a fixed enum
- Edge directionality (directed vs bidirectional)

**Graph data structure:**
- cortex-graph.json JSON schema and adjacency list format
- Where the file lives (vault root, data/ directory, etc.)
- In-memory caching strategy for fast traversal
- Git-tracking vs gitignore decisions

**cortex_relate tool design:**
- Tool parameters (source, target, edge type, optional metadata)
- Whether it uses IPC (like cortex_write) or direct file write
- Validation (both entries must exist, no self-edges, no duplicates)

**Search integration:**
- How 1-hop neighbors are included in cortex_search results
- Result format for graph-augmented results vs pure semantic results
- Performance considerations for graph traversal during search

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/17-search-mcp-tools/17-CONTEXT.md` — cortex_search/read/write tools in ipc-mcp-stdio.ts, all implementation at Claude's discretion
- `.planning/phases/14-cortex-schema-standard/14-CONTEXT.md` — Schema fields and validation approach

### Research findings
- `.planning/research/FEATURES.md` — cortex-graph.json as JSON adjacency list, edge types, cortex_relate MCP tool
- `.planning/research/ARCHITECTURE.md` — JSON file not graph DB for ~500 entries, loaded into memory
- `.planning/research/PITFALLS.md` — MCP tool count ceiling, cortex_relate added as 4th Cortex tool in Phase 19

### Existing MCP server
- `container/agent-runner/src/ipc-mcp-stdio.ts` — Existing MCP server where cortex_relate will be added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 17 cortex_search — will be enhanced to include graph neighbors
- IPC file write pattern — for cortex_relate if it needs host-side processing

### Established Patterns
- JSON config files: `config/routing.json` uses Zod validation — same pattern for cortex-graph.json
- cortex/ vault as git-tracked knowledge store

### Integration Points
- cortex-graph.json read by cortex_search (host-side) for neighbor augmentation
- cortex_relate writes via IPC to host (host manages the JSON file)
- Phase 21 Nightshift CROSS_LINK discovery adds edges to this graph

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User trusts Claude's judgment on all implementation details.

</specifics>

<deferred>
## Deferred Ideas

- CROSS_LINK auto-discovery (semantic similarity) — Phase 21 Nightshift
- Graph visualization — out of scope (Obsidian graph view exists for humans)

</deferred>

---

*Phase: 19-knowledge-graph*
*Context gathered: 2026-03-28*
