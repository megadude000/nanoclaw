# Phase 9: Agent Message Schema - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Define a shared TypeScript schema + Zod validator for the metadata fields that ALL #agents messages must carry. This is the foundation phase — Phases 10 and 11 depend on it. No embeds are sent in this phase; only the schema, types, and helpers are created.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User explicitly deferred all decisions to best-practice judgment ("yolo mode, apply best practices"). The following choices are made by Claude:

**D-01: Schema implementation — Zod with exported TypeScript types**

Use Zod to define the `AgentMessageMeta` schema. Export the inferred TypeScript type. Rationale: IPC messages arrive as runtime strings — runtime validation is essential, not optional. Zod is already in the project and produces TypeScript types automatically. A pure TypeScript interface would provide no runtime safety for messages coming from container agents.

**D-02: Message type granularity — Fine-grained discriminated union**

Use 8 fine-grained types rather than 4 coarse ones:
- `took` — agent picked up a task/issue
- `closed` — agent completed a task with PR reference
- `progress` — intermediate update during long-running task
- `blocker-perm` — blocked by permission/access error
- `blocker-service` — blocked by service/tunnel unavailability
- `blocker-conflict` — blocked by ambiguity requiring human input
- `handoff` — structured handoff to another agent
- `digest` — morning digest summary

Rationale: fine-grained types make Phase 14 IPC queries meaningful ("fetch last 10 `blocker-*` messages") and make the channel more readable at a glance. Coarse types would collapse useful signal.

**D-03: Metadata injection pattern — `withAgentMeta()` wrapper function**

Implement a single `withAgentMeta(embed: EmbedBuilder, meta: AgentMessageMeta): EmbedBuilder` helper that appends the 3 metadata fields (agent name, task ID, message type) as footer + inline fields to any embed. Do NOT require new builders — Phases 10-11 will create their own builders and call `withAgentMeta()` at the end. This keeps the schema non-invasive and backward-compatible with existing webhook embeds (bug, task, progress) which do NOT go to #agents and do NOT need this metadata.

Required metadata fields:
- `agentName`: string (e.g. "Friday", "Alfred", "NanoClaw")
- `taskId`: string | undefined (e.g. "#42", "notion:task-uuid") — optional since digest/handoff may not reference a specific task
- `messageType`: one of the 8 fine-grained types above

**D-04: Color palette — Separate `AGENT_COLORS` constant, new file**

Create `src/agent-message-schema.ts` as the new file. Define `AGENT_COLORS` separately from the existing `COLORS` in `discord-embeds.ts`. Webhook notification colors (bug/task/progress/alert) serve a different semantic purpose than agent activity colors. Keeping them separate avoids confusion and lets each evolve independently.

Suggested agent colors:
- `took`: 0x5865f2 (Blurple — active/in-progress)
- `closed`: 0x57f287 (Green — success)
- `progress`: 0xfeb932 (Orange — in-flight)
- `blocker`: 0xed4245 (Red — all blocker subtypes)
- `handoff`: 0x9b59b6 (Purple — transition)
- `digest`: 0x95a5a6 (Grey — informational)

**D-05: File location**

Single new file: `src/agent-message-schema.ts`
- Exports: `AgentMessageMeta` Zod schema, `AgentMessageMeta` TypeScript type, `AgentMessageType` type, `withAgentMeta()` function, `AGENT_COLORS` map
- This file is the single import for all of Phase 10-14 work

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing embed infrastructure
- `src/discord-embeds.ts` — existing EmbedBuilder helpers (bug/task/progress); `withAgentMeta()` must NOT modify these builders
- `src/discord-embeds.test.ts` — test patterns to follow for Phase 9 tests

### Requirements
- `.planning/REQUIREMENTS.md` §SEARCH-01 — the requirement this phase satisfies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/discord-embeds.ts`: `EmbedBuilder`, `COLORS`, `truncate()` — import pattern established; Phase 9 adds parallel exports from `agent-message-schema.ts`
- `truncate()` is private in discord-embeds.ts — may need to extract to shared util or duplicate in new file

### Established Patterns
- Embed builders: take typed input object → return `EmbedBuilder` with `.addFields()` calls
- Field format: `{ name: string, value: string, inline: boolean }`
- All fields truncated to Discord limits (field value max 1024 chars)

### Integration Points
- Phase 10-11 builders will import `withAgentMeta` and `AGENT_COLORS` from `src/agent-message-schema.ts`
- No changes to existing files in Phase 9 — additive only

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user deferred all decisions to best-practice judgment.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-agent-message-schema*
*Context gathered: 2026-03-27*
