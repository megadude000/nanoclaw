# Phase 10: Agent Status Reporting - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (full autonomous approval — all decisions at Claude's discretion)

<domain>
## Phase Boundary

Agents report task lifecycle events (took, progress, closed) as rich Discord embeds in #agents.
Covers both host-side auto-reporting (when scheduled tasks start/end) and agent-side explicit
reporting (via a new `report_agent_status` IPC MCP tool). Does NOT touch chat message flows —
only scheduled task runs and explicit agent calls.

</domain>

<decisions>
## Implementation Decisions

### Reporting Architecture
- **Dual approach**: host auto-posts "took"/"closed" when scheduled tasks start/end (src/index.ts + src/task-scheduler.ts); agents explicitly call `report_agent_status` MCP tool for progress updates and detailed status
- **Channel wiring**: add `DISCORD_AGENTS_CHANNEL_ID` env var → `sendToAgents()` function in src/index.ts (mirrors existing `sendToLogs()` pattern exactly)
- **No reporting for ad-hoc chat messages** — only scheduled tasks get auto-reporting; agent-triggered reporting is always explicit

### Embed Design
- Create `src/agent-status-embeds.ts` — embed builder for took/closed/progress types
- Use `withAgentMeta()` from Phase 9 on every embed
- "took" embed: title = "Took: {task title}", color = AGENT_COLORS.took, fields: Task ID, description snippet
- "closed" embed: title = "Closed: {task title}", color = AGENT_COLORS.closed, fields: Task ID, PR link (if present), summary
- "progress" embed: title = "Progress: {task title}", color = AGENT_COLORS.progress, description = what was done
- All embeds include timestamp

### IPC MCP Tool
- Add `report_agent_status` tool to `container/agent-runner/src/ipc-mcp-stdio.ts`
- Params: `messageType` (AgentMessageType), `title` (string), `taskId?` (string), `description?` (string), `prUrl?` (string), `summary?` (string)
- Writes IPC file to `/workspace/ipc/messages/` with `type: 'agent_status'` and full params
- Host reads this in src/ipc.ts, builds embed, sends to agentsJid

### Host-side wiring (src/index.ts)
- `sendToAgents()` matches `sendToLogs()` signature and pattern
- Called on scheduled task start: buildTookEmbed({ title: task.prompt.slice(0,80), taskId: String(task.id), agentName })
- Called on scheduled task end (success): buildClosedEmbed(...)
- Wired in src/task-scheduler.ts via new optional `sendToAgents` dep (same as `sendMessage`)

### Agent Name
- Auto-detect from CLAUDE.md header (`ASSISTANT_NAME` env var in container, defaults to "Agent")
- Pass `NANOCLAW_ASSISTANT_NAME` env var into container via container-runner.ts (already has `NANOCLAW_CHAT_JID`)

### Claude's Discretion
- Exact embed title wording
- Field ordering within embeds
- Whether to truncate long task prompts at 80 or 100 chars

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/agent-message-schema.ts` — `withAgentMeta()`, `AGENT_COLORS`, `AgentMessageMeta`, `AgentMessageType` (Phase 9)
- `src/discord-embeds.ts` — `EmbedBuilder` usage pattern, `truncate()` pattern, `COLORS` (mirror this file's style)
- `sendToLogs()` in src/index.ts — exact pattern to mirror for `sendToAgents()`
- `container/agent-runner/src/ipc-mcp-stdio.ts` — `send_message` tool as template for new `report_agent_status` tool
- `src/ipc.ts` — IPC message handler — add new `type: 'agent_status'` case

### Established Patterns
- All IPC files written to `/workspace/ipc/messages/` with atomic temp+rename
- All embed builders use `EmbedBuilder` from discord.js with `.addFields()` for metadata
- `NANOCLAW_CHAT_JID` / `NANOCLAW_GROUP_FOLDER` / `NANOCLAW_IS_MAIN` env vars set in container-runner
- Env var reading pattern: `readEnvFile(['KEY'])` in src/env.ts, fallback to `process.env.KEY`
- `sendToLogs` is optional (`| undefined`) — `sendToAgents` must match this pattern

### Integration Points
- `src/index.ts` ~line 877: where `sendToLogs` is wired — add `sendToAgents` here
- `src/task-scheduler.ts` `runTask()` function — add agents reporting around `runContainerAgent` call
- `container/agent-runner/src/ipc-mcp-stdio.ts` — add new MCP tool after existing tools
- `src/ipc.ts` message handler — add `agent_status` type case

</code_context>

<specifics>
## Specific Ideas

- Keep host-side reporting minimal (just took/closed for scheduled tasks) to avoid noise
- Agent-side reporting is for explicit agent use in tools/workflows — not forced on all agents
- `report_agent_status` tool should have clear docs so agents know to call it
- Progress updates should be optional / agent-initiated, not polled from host
- The `NANOCLAW_ASSISTANT_NAME` env is already informally used; formalize it

</specifics>

<deferred>
## Deferred Ideas

- Streaming progress bar in Discord (edit message approach) — defer to v2.1
- Per-agent color customization — defer to v2.1
- Thread-based conversation per task in #agents — defer to v2.1

</deferred>
