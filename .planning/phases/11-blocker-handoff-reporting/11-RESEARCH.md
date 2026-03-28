# Phase 11: Blocker & Handoff Reporting - Research

**Researched:** 2026-03-28
**Domain:** IPC MCP tools + Discord embed builders for blocker/handoff messages
**Confidence:** HIGH

## Summary

Phase 11 adds two new IPC MCP tools (`report_blocker` and `report_handoff`) in the container agent-runner that write IPC files to `/workspace/ipc/messages/`. The host-side IPC watcher in `src/ipc.ts` picks these up and dispatches to new embed builders in `src/agent-status-embeds.ts`, which send structured Discord embeds to the #agents channel. Every embed uses `withAgentMeta()` from Phase 9's schema to append machine-queryable metadata fields.

This is a direct extension of the Phase 10 pattern (report_agent_status tool). The architecture is identical: container writes JSON IPC file, host reads it, builds embed, sends via `sendToAgents()`. The only new work is defining the two tools, two IPC type handlers, and two embed builder functions. All infrastructure (IPC watcher, sendToAgents, withAgentMeta, AGENT_COLORS) already exists.

**Primary recommendation:** Follow the exact Phase 10 `report_agent_status` pattern. Add two tools in `ipc-mcp-stdio.ts`, two `else if` branches in `src/ipc.ts` message processing, and two builder functions in `src/agent-status-embeds.ts`. No new files needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add `report_blocker` tool: params = `blockerType` ('perm'|'service'|'conflict'), `resource` (what's blocked), `description` (error detail), `taskId?`, `agentName?`
- Add `report_handoff` tool: params = `toAgent` (who receives work), `what` (task description), `why` (reason/context), `taskId?`, `agentName?`
- Both write IPC files to `/workspace/ipc/messages/` with `type: 'agent_blocker'` / `type: 'agent_handoff'`
- Host reads these in src/ipc.ts, builds embed, sends to agentsJid
- Blocker embed: title = "Blocked: {resource}", color = AGENT_COLORS['blocker-perm'/'blocker-service'/'blocker-conflict'], description = error detail, fields: Resource (inline), Blocker Type (inline), Task ID (inline, if present), withAgentMeta() appends Agent/Type/Task at end
- Handoff embed: title = "Handoff -> {toAgent}", color = AGENT_COLORS.handoff, description = what + why context, fields: To (inline), Task (inline, if present), withAgentMeta() appends metadata
- AgentMessageType mapping: report_blocker with blockerType 'perm' -> messageType 'blocker-perm', 'service' -> 'blocker-service', 'conflict' -> 'blocker-conflict'; report_handoff -> messageType 'handoff'
- Both tools safe to call without agentName (falls back to NANOCLAW_ASSISTANT_NAME env)

### Claude's Discretion
- Exact field names and ordering in embeds
- Whether `resource` field is required or optional for blockers

### Deferred Ideas (OUT OF SCOPE)
- Acknowledgement mechanism for handoffs (receiving agent confirms receipt) -- defer to v2.1
- Auto-detection of blockers from container exit codes -- defer to v2.1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLOCK-01 | Agent posts blocker embed to #agents when hitting a permission error (no access to repo/API/file) | `report_blocker` tool with blockerType='perm', builds embed with AGENT_COLORS['blocker-perm'] (0xed4245 red), resource field names the resource |
| BLOCK-02 | Agent posts blocker embed to #agents when a service or tunnel is unavailable | `report_blocker` tool with blockerType='service', builds embed with AGENT_COLORS['blocker-service'] (0xed4245 red) |
| BLOCK-03 | Agent posts blocker embed to #agents when facing a conflict or ambiguity requiring human input | `report_blocker` tool with blockerType='conflict', builds embed with AGENT_COLORS['blocker-conflict'] (0xed4245 red) |
| HAND-01 | Agent posts structured handoff embed to #agents (what, to whom, why/context) | `report_handoff` tool with toAgent/what/why params, builds embed with AGENT_COLORS.handoff (0x9b59b6 purple) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech Stack**: discord.js v14, Node.js, TypeScript
- **Architecture**: Follow existing channel registry pattern and IPC file-based messaging system
- **Platform**: Linux (systemd)
- **Development**: Run `npm run dev` for hot reload, `npm run build` to compile, `npm run test` for vitest
- **GSD Workflow**: All changes through GSD commands

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | ^14.25.1 | EmbedBuilder for Discord embeds | Already used in Phase 9/10 |
| zod | ^4.3.6 | Parameter validation in MCP tools | Already used in ipc-mcp-stdio.ts |
| @modelcontextprotocol/sdk | (existing) | MCP server/tool registration | Already used in ipc-mcp-stdio.ts |

### No Additional Libraries Needed
No new dependencies required. This phase only extends existing files using existing imports.

## Architecture Patterns

### Files to Modify (3 files)

```
container/agent-runner/src/ipc-mcp-stdio.ts   # Add 2 new server.tool() calls
src/agent-status-embeds.ts                      # Add buildBlockerEmbed() + buildHandoffEmbed()
src/ipc.ts                                      # Add 2 new else-if branches in message processing
```

### Pattern 1: IPC MCP Tool (container side)

**What:** Each tool validates params with zod, constructs a typed JSON object, writes it atomically via `writeIpcFile(MESSAGES_DIR, data)`.

**When to use:** Every new agent-to-host communication channel.

**Example (existing `report_agent_status` pattern):**
```typescript
server.tool(
  'report_blocker',
  `Description of the tool...`,
  {
    blockerType: z.enum(['perm', 'service', 'conflict']).describe('...'),
    resource: z.string().describe('What is blocked'),
    description: z.string().describe('Error detail'),
    taskId: z.string().optional().describe('...'),
  },
  async (args) => {
    const data = {
      type: 'agent_blocker',
      blockerType: args.blockerType,
      resource: args.resource,
      description: args.description,
      taskId: args.taskId,
      agentName: assistantName,
      groupFolder,
      timestamp: new Date().toISOString(),
    };
    writeIpcFile(MESSAGES_DIR, data);
    return { content: [{ type: 'text' as const, text: 'Blocker reported to #agents.' }] };
  },
);
```

### Pattern 2: IPC Host Handler (host side)

**What:** In `src/ipc.ts` `processIpcFiles`, add `else if` branches matching `data.type` to build and send embeds via `deps.sendToAgents()`.

**Example (existing `agent_status` pattern at line 131-144 of ipc.ts):**
```typescript
} else if (data.type === 'agent_blocker' && data.blockerType && data.resource) {
  if (deps.sendToAgents) {
    const agentName = data.agentName || sourceGroup || 'Agent';
    const embed = buildBlockerEmbed({
      blockerType: data.blockerType,
      resource: data.resource,
      description: data.description || 'No details provided',
      agentName,
      taskId: data.taskId,
    });
    await deps.sendToAgents(embed).catch(() => {});
  }
}
```

### Pattern 3: Embed Builder (shared embeds file)

**What:** A function that creates an EmbedBuilder with color, title, fields, timestamp, then calls `withAgentMeta()` last.

**Key constraints from Phase 10 pattern:**
- `setColor(AGENT_COLORS[messageType])` -- uses the color map from Phase 9
- `setTitle(truncate(..., 256))` -- Discord title limit
- `setTimestamp()` -- always set
- `withAgentMeta(embed, { agentName, messageType, taskId })` -- always called LAST
- Description truncated to 4096 chars (Discord embed description limit)
- Individual field values truncated to 1024 chars (Discord field value limit)

### Pattern 4: AgentMessageType Mapping

**What:** The `blockerType` param from the container maps to the correct `AgentMessageType`:
- `'perm'` -> `'blocker-perm'`
- `'service'` -> `'blocker-service'`
- `'conflict'` -> `'blocker-conflict'`

This mapping happens in the embed builder or IPC handler. The simplest approach: concatenate in the builder: `` `blocker-${blockerType}` as AgentMessageType ``.

### Anti-Patterns to Avoid
- **Adding new files:** Do NOT create new files -- extend `agent-status-embeds.ts` per the Phase 10 established pattern
- **Changing agent-message-schema.ts:** The schema already has all 8 message types and colors defined. No changes needed.
- **Authorization checks on blocker/handoff:** Phase 10 established that status reporting is non-privileged -- no authorization check needed (see STATE.md decision)
- **Forgetting withAgentMeta():** Every #agents embed MUST call `withAgentMeta()` last -- this is the SEARCH-01 requirement

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Embed metadata fields | Manual addFields for Agent/Type/Task | `withAgentMeta()` from agent-message-schema.ts | Consistency with SEARCH-01, Phase 14 will query these fields |
| Color selection | Hardcoded hex values | `AGENT_COLORS[messageType]` from agent-message-schema.ts | All 8 colors already defined |
| IPC file writing | Custom file I/O | `writeIpcFile(MESSAGES_DIR, data)` helper | Handles atomic write, mkdir, filename generation |
| String truncation | Inline .slice() | `truncate()` helper in agent-status-embeds.ts | Consistent ellipsis handling |

## Common Pitfalls

### Pitfall 1: Missing `resource` field validation
**What goes wrong:** Agent calls `report_blocker` without specifying what resource is blocked, producing a useless embed
**Why it happens:** The tool schema might mark `resource` as optional
**How to avoid:** Make `resource` required in the zod schema -- it is the core actionable information in a blocker
**Warning signs:** Blocker embeds with empty or generic titles

### Pitfall 2: blockerType-to-messageType mapping error
**What goes wrong:** Using raw `blockerType` value ('perm') as the messageType instead of the prefixed version ('blocker-perm'), causing wrong color or withAgentMeta type mismatch
**Why it happens:** The container sends 'perm' but AGENT_COLORS expects 'blocker-perm'
**How to avoid:** Map explicitly: `` const messageType = `blocker-${blockerType}` as AgentMessageType ``
**Warning signs:** Embeds showing wrong color or Type field showing 'perm' instead of 'blocker-perm'

### Pitfall 3: IPC handler not matching data.type
**What goes wrong:** IPC files pile up in the messages directory and are never processed
**Why it happens:** The `type` string in the IPC file ('agent_blocker') does not match the `else if` condition in ipc.ts
**How to avoid:** Use exact same string in both container writeIpcFile and host handler: 'agent_blocker' and 'agent_handoff'
**Warning signs:** IPC JSON files accumulating in the group's messages/ directory

### Pitfall 4: Forgetting the .catch(() => {}) on sendToAgents
**What goes wrong:** A Discord send failure crashes the IPC processing loop
**Why it happens:** sendToAgents is async and can reject if Discord is disconnected
**How to avoid:** Always call `await deps.sendToAgents(embed).catch(() => {})` -- matching the Phase 10 pattern
**Warning signs:** IPC watcher stops processing after a Discord disconnect

### Pitfall 5: Description field too long
**What goes wrong:** Discord rejects the embed with a validation error
**Why it happens:** Agent provides a full stack trace or verbose error as the description
**How to avoid:** Truncate description to 4096 chars (embed description limit) and individual field values to 1024 chars
**Warning signs:** Discord API 400 errors in logs

## Code Examples

### buildBlockerEmbed
```typescript
// In src/agent-status-embeds.ts
export function buildBlockerEmbed(params: {
  blockerType: 'perm' | 'service' | 'conflict';
  resource: string;
  description: string;
  agentName: string;
  taskId?: string;
}): EmbedBuilder {
  const messageType = `blocker-${params.blockerType}` as AgentMessageType;

  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS[messageType])
    .setTitle(truncate('Blocked: ' + params.resource, 256))
    .setDescription(truncate(params.description, 4096))
    .setTimestamp();

  embed.addFields(
    { name: 'Resource', value: truncate(params.resource, 1024), inline: true },
    { name: 'Blocker Type', value: params.blockerType, inline: true },
  );

  if (params.taskId) {
    embed.addFields({ name: 'Task ID', value: params.taskId, inline: true });
  }

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType,
    taskId: params.taskId,
  });
}
```

### buildHandoffEmbed
```typescript
// In src/agent-status-embeds.ts
export function buildHandoffEmbed(params: {
  toAgent: string;
  what: string;
  why: string;
  agentName: string;
  taskId?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS.handoff)
    .setTitle(truncate('Handoff \u2192 ' + params.toAgent, 256))
    .setDescription(truncate(params.what + '\n\n**Why:** ' + params.why, 4096))
    .setTimestamp();

  embed.addFields(
    { name: 'To', value: params.toAgent, inline: true },
  );

  if (params.taskId) {
    embed.addFields({ name: 'Task', value: params.taskId, inline: true });
  }

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType: 'handoff',
    taskId: params.taskId,
  });
}
```

### IPC handler additions (src/ipc.ts)
```typescript
// After the existing agent_status handler (line ~144):
} else if (data.type === 'agent_blocker' && data.blockerType && data.resource) {
  if (deps.sendToAgents) {
    const agentName = data.agentName || sourceGroup || 'Agent';
    const embed = buildBlockerEmbed({
      blockerType: data.blockerType,
      resource: data.resource,
      description: data.description || 'No details provided',
      agentName,
      taskId: data.taskId,
    });
    await deps.sendToAgents(embed).catch(() => {});
  }
} else if (data.type === 'agent_handoff' && data.toAgent && data.what) {
  if (deps.sendToAgents) {
    const agentName = data.agentName || sourceGroup || 'Agent';
    const embed = buildHandoffEmbed({
      toAgent: data.toAgent,
      what: data.what,
      why: data.why || '',
      agentName,
      taskId: data.taskId,
    });
    await deps.sendToAgents(embed).catch(() => {});
  }
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/agent-status-embeds.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLOCK-01 | buildBlockerEmbed with blockerType='perm' produces correct color, title, fields, withAgentMeta | unit | `npx vitest run src/agent-status-embeds.test.ts` | Exists, needs new tests |
| BLOCK-02 | buildBlockerEmbed with blockerType='service' produces correct color | unit | `npx vitest run src/agent-status-embeds.test.ts` | Exists, needs new tests |
| BLOCK-03 | buildBlockerEmbed with blockerType='conflict' produces correct color | unit | `npx vitest run src/agent-status-embeds.test.ts` | Exists, needs new tests |
| HAND-01 | buildHandoffEmbed produces correct color, title, fields, withAgentMeta | unit | `npx vitest run src/agent-status-embeds.test.ts` | Exists, needs new tests |

### Sampling Rate
- **Per task commit:** `npx vitest run src/agent-status-embeds.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. Tests add to existing `src/agent-status-embeds.test.ts`.

## Sources

### Primary (HIGH confidence)
- `container/agent-runner/src/ipc-mcp-stdio.ts` -- existing report_agent_status tool pattern (lines 67-94)
- `src/ipc.ts` -- existing agent_status IPC handler (lines 131-144)
- `src/agent-status-embeds.ts` -- existing embed builder pattern (buildTookEmbed, buildClosedEmbed, buildProgressEmbed)
- `src/agent-message-schema.ts` -- AgentMessageType enum (8 types), AGENT_COLORS map, withAgentMeta() function
- `.planning/phases/11-blocker-handoff-reporting/11-CONTEXT.md` -- locked implementation decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, extending existing code
- Architecture: HIGH -- exact same pattern as Phase 10 (IPC tool -> host handler -> embed builder -> sendToAgents)
- Pitfalls: HIGH -- observed directly from existing codebase patterns

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- internal codebase patterns, no external API changes)
