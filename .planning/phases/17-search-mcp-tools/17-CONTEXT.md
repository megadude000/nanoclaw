# Phase 17: Search & MCP Tools - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add cortex_search, cortex_read, and cortex_write MCP tools to the existing container MCP server (ipc-mcp-stdio.ts). Implement hybrid search routing (exact vault path vs Qdrant semantic), search result filtering (project/level/domain), and confidence firewall. This is the primary agent interface to the knowledge layer.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (all areas)

The user designated all gray areas as coding decisions for Claude:

**Tool architecture:**
- How cortex_search/read work from containers (direct Qdrant + filesystem calls vs IPC)
- How cortex_write handles the host-write + embed trigger pattern (IPC like send_message)
- Where query embedding happens (container-side OpenAI call, per Phase 16 D-06)
- Tool count management (existing server already has 11 tools, adding 3 Cortex tools)

**Search behavior:**
- Result format and metadata returned to agents
- Number of results per search query
- Hybrid routing logic: how to decide exact path lookup vs Qdrant semantic search
- Search result ranking and relevance scoring

**Confidence firewall:**
- Strictness of L(N) gates L(N-1) enforcement
- Behavior when agent tries to write high-level entry with gaps below (hard block vs warning)
- Completeness threshold for "L(N-1) has medium+ confidence"

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/14-cortex-schema-standard/14-CONTEXT.md` — Zod schema (D-07), permissive defaults (D-08), all 4 Cortex fields required (D-02)
- `.planning/phases/15-qdrant-infrastructure/15-CONTEXT.md` — Qdrant at `./data/qdrant/`, reachable via `host.docker.internal` (D-01)
- `.planning/phases/16-embedding-pipeline/16-CONTEXT.md` — Containers call OpenAI directly for query embedding (D-06), shared embedding function (D-04)

### Research findings
- `.planning/research/STACK.md` — @qdrant/js-client-rest for containers, openai SDK for query embedding
- `.planning/research/FEATURES.md` — Hybrid search routing, confidence firewall, MCP tool design, anti-feature: max 3 Cortex tools initially
- `.planning/research/ARCHITECTURE.md` — Cortex MCP tools in existing ipc-mcp-stdio.ts, IPC write pattern for cortex_write

### Existing MCP server
- `container/agent-runner/src/ipc-mcp-stdio.ts` — Existing MCP server with 11 tools using IPC file writes. Pattern: `writeIpcFile()` for host communication, Zod parameter validation, `server.tool()` registration.

### Project requirements
- `.planning/REQUIREMENTS.md` — SEARCH-01 (hybrid routing), SEARCH-02 (confidence firewall), SEARCH-03 (filtering), MCP-01/02/03/05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ipc-mcp-stdio.ts`: 11 existing MCP tools with established pattern — `server.tool()`, Zod params, `writeIpcFile()` for host IPC
- `writeIpcFile()`: Atomic write (temp + rename) to IPC directory, reusable for cortex_write
- `container-runtime.ts`: `CONTAINER_HOST_GATEWAY` constant for `host.docker.internal`
- Zod already available in container for parameter validation

### Established Patterns
- All container-to-host communication uses IPC file writes to `/workspace/ipc/`
- Tools use environment variables for context: `NANOCLAW_CHAT_JID`, `NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN`
- Container has read-only mount of vault filesystem (`/workspace/host/nanoclaw/cortex/`)
- `McpServer` from `@modelcontextprotocol/sdk` with `StdioServerTransport`

### Integration Points
- New Cortex tools added to same `ipc-mcp-stdio.ts` file (MCP-05 requirement)
- `cortex_search`: calls Qdrant REST API at `host.docker.internal:6333` + OpenAI for query embedding
- `cortex_read`: reads vault files from read-only mount at `/workspace/host/nanoclaw/cortex/`
- `cortex_write`: writes IPC file to host, host writes vault file + triggers embedding pipeline
- Host-side IPC handler (in `src/ipc.ts`) needs new handler for `type: 'cortex_write'` messages

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User trusts Claude's judgment on all implementation details.

</specifics>

<deferred>
## Deferred Ideas

- cortex_relate tool (declaring graph edges) — Phase 19
- Nightshift reconciliation integration — Phase 21

</deferred>

---

*Phase: 17-search-mcp-tools*
*Context gathered: 2026-03-28*
