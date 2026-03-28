# Phase 14: Agent History Search - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (full autonomous approval — all decisions at Claude's discretion)

<domain>
## Phase Boundary

Agents can query #agents message history via a new `query_agents_history` IPC MCP tool.
Returns structured results filtered by messageType, taskId, or agentName. #agents channel
accumulates a complete chronological activity log (messages are never deleted — config note only,
no code change needed since no deletion code exists).

</domain>

<decisions>
## Implementation Decisions

### Query Mechanism
- New IPC MCP tool `query_agents_history` in `container/agent-runner/src/ipc-mcp-stdio.ts`
- Params: `messageType?` (AgentMessageType), `taskId?` (string), `agentName?` (string), `limit?` (number, default 20, max 100)
- Writes an IPC request file to `/workspace/ipc/messages/` with `type: 'query_agents_history'` and a `replyFile` path
- Host reads the request, executes Discord channel history fetch, writes results to `replyFile`
- Agent tool waits for `replyFile` to appear (polls with timeout)

### Host-side query execution (src/ipc.ts)
- New `query_agents_history` IPC type handler
- Fetches messages from Discord #agents channel using discord.js `channel.messages.fetch({ limit: 100 })`
- Filters by embed fields (Agent, Type, Task) matching the query params from Phase 9's structured metadata
- Returns array of `{ messageId, timestamp, agentName, messageType, taskId, title, description, summary }`
- Writes JSON result to `replyFile`

### Discord.js History Fetching
- `channel.messages.fetch({ limit: N })` returns a Collection<string, Message>
- For each message: check `message.embeds[0]?.fields` for Agent/Type/Task fields
- Filter matching the query params
- For larger history (>100): use `before` parameter for pagination (limit to 500 max total)

### Dependency wiring
- `src/ipc.ts` needs access to the Discord channel object
- Add optional `discordAgentsChannel?: TextChannel` to `IpcDeps` interface
- Wire it in `src/index.ts` when Discord is connected and agentsJid is configured

### Agent-facing result format
- Returns Markdown-formatted table for easy agent consumption
- Also returns raw JSON for programmatic use
- Tool response is synchronous from agent's perspective (waits for host reply, 10s timeout)

### SEARCH-03 (no deletion)
- SEARCH-03 requires messages are never deleted from #agents
- Verification: confirm no delete calls exist for agentsJid in the codebase
- Add a code comment in discord.ts / agent-status-embeds.ts noting this invariant

### Claude's Discretion
- Exact polling timeout (suggest 10 seconds, error after)
- Whether to return plain text or JSON from the tool
- Pagination depth (suggest 500 max to avoid rate limits)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 9 `withAgentMeta()` / embed fields structure — defines what's queryable (Agent, Type, Task fields)
- Phase 10 `discordAgentsChannel` (created in Phase 10) — reuse this channel reference
- `container/agent-runner/src/ipc-mcp-stdio.ts` — add tool after existing Phase 10/11 tools
- `src/ipc.ts` `IpcDeps` interface — add `discordAgentsChannel` optional dep
- `writeIpcFile()` in ipc-mcp-stdio.ts — use same pattern for replyFile write

### Established Patterns
- IPC request/reply pattern: agent writes request, host writes reply to known path
- discord.js `channel.messages.fetch()` for history
- 10s timeout with polling for cross-process file communication (similar to IPC input polling)

### Integration Points
- `container/agent-runner/src/ipc-mcp-stdio.ts` — add `query_agents_history` tool
- `src/ipc.ts` — add query handler, add `discordAgentsChannel` to IpcDeps
- `src/index.ts` — wire discordAgentsChannel into IpcDeps at startup

</code_context>

<specifics>
## Specific Ideas

- Result should include both human-readable (markdown table) and raw data
- Tool description should tell agents this is for auditing their own past actions
- Timeout errors should be clear: "Host did not respond to history query in 10s"

</specifics>

<deferred>
## Deferred Ideas

- #logs query (same pattern for #logs channel) — defer to v2.1
- Persistent SQLite cache of #agents history for offline querying — defer to v2.1
- Full-text search across embed descriptions — defer to v2.1

</deferred>
