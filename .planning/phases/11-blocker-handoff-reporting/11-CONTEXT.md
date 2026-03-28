# Phase 11: Blocker & Handoff Reporting - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (full autonomous approval — all decisions at Claude's discretion)

<domain>
## Phase Boundary

Agents surface blockers (permission errors, service outages, human-input conflicts) and structured
handoffs (passing work to another agent) as actionable Discord embeds in #agents. All via new IPC MCP
tools in the container. Does NOT require agent behavior changes — just new tools agents can call.

</domain>

<decisions>
## Implementation Decisions

### IPC MCP Tools (container/agent-runner/src/ipc-mcp-stdio.ts)
- Add `report_blocker` tool: params = `blockerType` ('perm'|'service'|'conflict'), `resource` (what's blocked), `description` (error detail), `taskId?`, `agentName?`
- Add `report_handoff` tool: params = `toAgent` (who receives work), `what` (task description), `why` (reason/context), `taskId?`, `agentName?`
- Both write IPC files to `/workspace/ipc/messages/` with `type: 'agent_blocker'` / `type: 'agent_handoff'`
- Host reads these in src/ipc.ts → builds embed → sends to agentsJid

### Embed Design (src/agent-status-embeds.ts, extending Phase 10 file)
- Blocker embed: title = "Blocked: {resource}", color = AGENT_COLORS['blocker-perm'/'blocker-service'/'blocker-conflict'], description = error detail
  - Fields: Resource (inline), Blocker Type (inline), Task ID (inline, if present)
  - `withAgentMeta()` appends Agent/Type/Task at end
- Handoff embed: title = "Handoff → {toAgent}", color = AGENT_COLORS.handoff
  - Description = what + why context
  - Fields: To (inline), Task (inline, if present)
  - `withAgentMeta()` appends metadata

### AgentMessageType mapping
- `report_blocker` with blockerType 'perm' → messageType 'blocker-perm'
- `report_blocker` with blockerType 'service' → messageType 'blocker-service'
- `report_blocker` with blockerType 'conflict' → messageType 'blocker-conflict'
- `report_handoff` → messageType 'handoff'

### Claude's Discretion
- Exact field names and ordering in embeds
- Whether `resource` field is required or optional for blockers

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 10 `report_agent_status` tool — use exact same IPC write pattern
- Phase 10 `src/agent-status-embeds.ts` — add blocker/handoff builders to this file
- `src/agent-message-schema.ts` `withAgentMeta()` — applied to all embeds
- `src/ipc.ts` agent_status handler (Phase 10) — add agent_blocker/agent_handoff cases

### Established Patterns
- IPC message type dispatch in src/ipc.ts `switch(msg.type)` or similar
- All embed builders in src/agent-status-embeds.ts (created in Phase 10)
- AgentMessageType enum from Phase 9 handles all 8 types

### Integration Points
- `container/agent-runner/src/ipc-mcp-stdio.ts` — add 2 new tools after report_agent_status
- `src/ipc.ts` — add 2 new type cases
- `src/agent-status-embeds.ts` — extend with buildBlockerEmbed() and buildHandoffEmbed()

</code_context>

<specifics>
## Specific Ideas

- Blocker embeds should be immediately actionable — include the resource name prominently
- Handoff embed description should include enough context for the receiving agent
- Both tools should be safe to call without agentName (falls back to NANOCLAW_ASSISTANT_NAME env)

</specifics>

<deferred>
## Deferred Ideas

- Acknowledgement mechanism for handoffs (receiving agent confirms receipt) — defer to v2.1
- Auto-detection of blockers from container exit codes — defer to v2.1

</deferred>
