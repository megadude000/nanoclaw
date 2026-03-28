# Phase 10: Agent Status Reporting — Research

**Researched:** 2026-03-28
**Domain:** TypeScript / discord.js / NanoClaw IPC architecture
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reporting Architecture**
- Dual approach: host auto-posts "took"/"closed" when scheduled tasks start/end (src/index.ts + src/task-scheduler.ts); agents explicitly call `report_agent_status` MCP tool for progress updates and detailed status
- Channel wiring: add `DISCORD_AGENTS_CHANNEL_ID` env var → `sendToAgents()` function in src/index.ts (mirrors existing `sendToLogs()` pattern exactly)
- No reporting for ad-hoc chat messages — only scheduled tasks get auto-reporting; agent-triggered reporting is always explicit

**Embed Design**
- Create `src/agent-status-embeds.ts` — embed builder for took/closed/progress types
- Use `withAgentMeta()` from Phase 9 on every embed
- "took" embed: title = "Took: {task title}", color = AGENT_COLORS.took, fields: Task ID, description snippet
- "closed" embed: title = "Closed: {task title}", color = AGENT_COLORS.closed, fields: Task ID, PR link (if present), summary
- "progress" embed: title = "Progress: {task title}", color = AGENT_COLORS.progress, description = what was done
- All embeds include timestamp

**IPC MCP Tool**
- Add `report_agent_status` tool to `container/agent-runner/src/ipc-mcp-stdio.ts`
- Params: `messageType` (AgentMessageType), `title` (string), `taskId?` (string), `description?` (string), `prUrl?` (string), `summary?` (string)
- Writes IPC file to `/workspace/ipc/messages/` with `type: 'agent_status'` and full params
- Host reads this in src/ipc.ts, builds embed, sends to agentsJid

**Host-side wiring (src/index.ts)**
- `sendToAgents()` matches `sendToLogs()` signature and pattern
- Called on scheduled task start: buildTookEmbed({ title: task.prompt.slice(0,80), taskId: String(task.id), agentName })
- Called on scheduled task end (success): buildClosedEmbed(...)
- Wired in src/task-scheduler.ts via new optional `sendToAgents` dep (same as `sendMessage`)

**Agent Name**
- Auto-detect from CLAUDE.md header (`ASSISTANT_NAME` env var in container, defaults to "Agent")
- Pass `NANOCLAW_ASSISTANT_NAME` env var into container via container-runner.ts (already has `NANOCLAW_CHAT_JID`)

### Claude's Discretion
- Exact embed title wording
- Field ordering within embeds
- Whether to truncate long task prompts at 80 or 100 chars

### Deferred Ideas (OUT OF SCOPE)
- Streaming progress bar in Discord (edit message approach) — defer to v2.1
- Per-agent color customization — defer to v2.1
- Thread-based conversation per task in #agents — defer to v2.1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASTATUS-01 | Agent posts "took #N [title]" embed to #agents when picking up a task or GitHub issue | Host-side: `runTask()` in task-scheduler.ts calls `sendToAgents` with `buildTookEmbed` at task start |
| ASTATUS-02 | Agent posts "closed #N, PR #M" embed to #agents when completing a task | Host-side: `runTask()` calls `sendToAgents` with `buildClosedEmbed` on success; agent can also call `report_agent_status` with type=closed |
| ASTATUS-03 | Agent posts progress update embed to #agents during long-running tasks | Agent-side: `report_agent_status` MCP tool with messageType=progress; host builds and sends embed from IPC file |
</phase_requirements>

---

## Summary

Phase 10 wires agent lifecycle reporting into the `#agents` Discord channel. The work is purely additive — no existing files are deleted, and all new code follows patterns already established in the codebase.

There are two reporting paths. The **host path** (ASTATUS-01, ASTATUS-02) has `runTask()` in `src/task-scheduler.ts` call a new optional `sendToAgents` dependency at task start and end. The **agent path** (ASTATUS-03) adds a `report_agent_status` MCP tool in the container that writes an IPC file; the host's IPC watcher picks it up and calls `sendToAgents`.

The single most important architectural finding is about embed delivery: the current `Channel` interface and `sendMessage()` method only accept plain text. To send Discord embeds, a new `sendEmbed(jid, embed)` method must be added to the `Channel` interface and implemented in `DiscordChannel`. The `sendToAgents` function in `src/index.ts` must call this new method, not `sendMessage`. All non-Discord channels can silently no-op the new method (it is optional, following the existing pattern for `editMessage`, `sendPhoto`, etc.).

**Primary recommendation:** Add `sendEmbed?(jid, embed): Promise<void>` to the `Channel` interface as an optional method. Wire it in `DiscordChannel`. Use this method exclusively for `sendToAgents`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | ^14.25.1 | EmbedBuilder for building agent status embeds | Already in project; EmbedBuilder is the standard way to construct Discord rich embeds |
| zod | ^4.3.6 | Validate IPC payload from `report_agent_status` tool | Already in project; all IPC validation uses zod |

### No New Dependencies
All libraries needed for this phase are already installed. No `npm install` step required.

---

## Architecture Patterns

### Recommended Project Structure (new files only)
```
src/
├── agent-status-embeds.ts    # NEW: buildTookEmbed, buildClosedEmbed, buildProgressEmbed
src/
├── agent-message-schema.ts   # EXISTING: withAgentMeta, AGENT_COLORS, AgentMessageType (Phase 9)
container/agent-runner/src/
├── ipc-mcp-stdio.ts          # MODIFIED: add report_agent_status tool
src/
├── ipc.ts                    # MODIFIED: add agent_status case to processIpcFiles
├── task-scheduler.ts         # MODIFIED: sendToAgents dep, called around runContainerAgent
├── index.ts                  # MODIFIED: wire sendToAgents, pass to scheduler deps
├── container-runner.ts       # MODIFIED: pass NANOCLAW_ASSISTANT_NAME to MCP server env
src/channels/
├── discord.ts                # MODIFIED: add sendEmbed() method
src/
├── types.ts                  # MODIFIED: add sendEmbed? to Channel interface
```

### Pattern 1: sendToLogs → sendToAgents (mirror exactly)

`sendToLogs` is declared at module scope in `src/index.ts`:

```typescript
// src/index.ts (existing)
let sendToLogs: ((text: string) => Promise<void>) | undefined;

// Wired around line 877:
const logsEnv = readEnvFile(['DISCORD_LOGS_CHANNEL_ID']);
const logsChannelId = process.env.DISCORD_LOGS_CHANNEL_ID || logsEnv.DISCORD_LOGS_CHANNEL_ID || '';
const dumpJid = logsChannelId ? `dc:${logsChannelId}` : undefined;
sendToLogs = dumpJid
  ? async (text: string) => {
      const ch = findChannel(channels, dumpJid);
      if (ch) await ch.sendMessage(dumpJid, text).catch(() => {});
    }
  : undefined;
```

`sendToAgents` follows the same shape but calls `sendEmbed` instead of `sendMessage`:

```typescript
// src/index.ts (new)
import { EmbedBuilder } from 'discord.js';

let sendToAgents: ((embed: EmbedBuilder) => Promise<void>) | undefined;

// Wired after sendToLogs wiring block:
const agentsEnv = readEnvFile(['DISCORD_AGENTS_CHANNEL_ID']);
const agentsChannelId = process.env.DISCORD_AGENTS_CHANNEL_ID || agentsEnv.DISCORD_AGENTS_CHANNEL_ID || '';
const agentsJid = agentsChannelId ? `dc:${agentsChannelId}` : undefined;
sendToAgents = agentsJid
  ? async (embed: EmbedBuilder) => {
      const ch = findChannel(channels, agentsJid) as any;
      if (ch?.sendEmbed) await ch.sendEmbed(agentsJid, embed).catch(() => {});
    }
  : undefined;
```

### Pattern 2: Channel interface extension (optional method)

The `Channel` interface in `src/types.ts` uses optional methods for capabilities not all channels support:

```typescript
// src/types.ts — add after editMessage?:
sendEmbed?(jid: string, embed: EmbedBuilder): Promise<void>;
```

`DiscordChannel` in `src/channels/discord.ts` implements it:

```typescript
async sendEmbed(jid: string, embed: EmbedBuilder): Promise<void> {
  if (!this.client) return;
  try {
    const channelId = jid.replace(/^dc:/, '');
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !('send' in channel)) return;
    await (channel as TextChannel).send({ embeds: [embed] });
    logger.info({ jid }, 'Discord embed sent');
  } catch (err) {
    logger.error({ jid, err }, 'Failed to send Discord embed');
  }
}
```

Non-Discord channels (Telegram, WhatsApp) do not implement this method — they simply don't have it, which the interface allows since it is optional.

### Pattern 3: agent-status-embeds.ts (mirrors discord-embeds.ts style)

```typescript
// src/agent-status-embeds.ts
import { EmbedBuilder } from 'discord.js';
import { AGENT_COLORS, withAgentMeta } from './agent-message-schema.js';

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

export function buildTookEmbed(params: {
  title: string;
  taskId: string;
  agentName: string;
  description?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS.took)
    .setTitle(truncate('Took: ' + params.title, 256))
    .setTimestamp();

  embed.addFields({ name: 'Task ID', value: params.taskId, inline: true });
  if (params.description) {
    embed.addFields({ name: 'Description', value: truncate(params.description, 1024), inline: false });
  }

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType: 'took',
    taskId: params.taskId,
  });
}

export function buildClosedEmbed(params: {
  title: string;
  taskId: string;
  agentName: string;
  prUrl?: string;
  summary?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS.closed)
    .setTitle(truncate('Closed: ' + params.title, 256))
    .setTimestamp();

  embed.addFields({ name: 'Task ID', value: params.taskId, inline: true });
  if (params.prUrl) {
    embed.addFields({ name: 'PR', value: params.prUrl, inline: true });
  }

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType: 'closed',
    taskId: params.taskId,
    summary: params.summary,
  });
}

export function buildProgressEmbed(params: {
  title: string;
  agentName: string;
  taskId?: string;
  description: string;
  summary?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS.progress)
    .setTitle(truncate('Progress: ' + params.title, 256))
    .setDescription(truncate(params.description, 4096))
    .setTimestamp();

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType: 'progress',
    taskId: params.taskId,
    summary: params.summary,
  });
}
```

### Pattern 4: SchedulerDependencies extension

```typescript
// src/task-scheduler.ts — add to SchedulerDependencies interface
import { EmbedBuilder } from 'discord.js';

export interface SchedulerDependencies {
  // ... existing fields ...
  sendToAgents?: (embed: EmbedBuilder) => Promise<void>; // optional, same as sendToLogs
}
```

Inside `runTask()`, call before and after `runContainerAgent`:

```typescript
// Before runContainerAgent call (ASTATUS-01):
deps.sendToAgents?.(buildTookEmbed({
  title: task.prompt.slice(0, 80),
  taskId: task.id,
  agentName: ASSISTANT_NAME,
}));

// On success, after result is known (ASTATUS-02):
deps.sendToAgents?.(buildClosedEmbed({
  title: task.prompt.slice(0, 80),
  taskId: task.id,
  agentName: ASSISTANT_NAME,
  summary: result?.slice(0, 200) ?? undefined,
}));
```

### Pattern 5: report_agent_status MCP tool

The tool writes to `MESSAGES_DIR` (same as `send_message`), NOT `TASKS_DIR`. The IPC watcher processes `MESSAGES_DIR` in `processIpcFiles`, not `processTaskIpc`, so `agent_status` is a message-type IPC, handled inline in the watcher loop.

```typescript
// container/agent-runner/src/ipc-mcp-stdio.ts — new tool
server.tool(
  'report_agent_status',
  `Report task lifecycle status to the #agents channel. Call this to announce task pickup, completion, or progress updates. DO NOT use for chat messages — use send_message for that.`,
  {
    messageType: z.enum(['took', 'closed', 'progress']).describe('Status type: took=started, closed=completed, progress=in-flight update'),
    title: z.string().describe('Short task title (≤80 chars recommended)'),
    taskId: z.string().optional().describe('Task ID, e.g. task-1234567890-abc123'),
    description: z.string().optional().describe('What is being worked on (progress) or description snippet (took)'),
    prUrl: z.string().optional().describe('PR URL if applicable (closed type)'),
    summary: z.string().optional().describe('What was accomplished (closed/progress types — prevents opaque messages)'),
  },
  async (args) => {
    const data = {
      type: 'agent_status',
      messageType: args.messageType,
      title: args.title,
      taskId: args.taskId,
      description: args.description,
      prUrl: args.prUrl,
      summary: args.summary,
      groupFolder,
      timestamp: new Date().toISOString(),
    };
    writeIpcFile(MESSAGES_DIR, data);
    return { content: [{ type: 'text' as const, text: `Status "${args.messageType}" reported.` }] };
  },
);
```

### Pattern 6: IPC watcher — agent_status message handling

In `src/ipc.ts`, the message-type IPC files are processed in the `processIpcFiles` inner loop (not `processTaskIpc`). The `agent_status` case needs to be added alongside the existing `message` and `restart` cases:

```typescript
// src/ipc.ts — inside the messageFiles for-loop, after the restart case
} else if (data.type === 'agent_status' && data.messageType && data.title) {
  // No authorization check needed — any group agent may post to #agents
  if (deps.sendToAgents) {
    const agentName = data.agentName || data.groupFolder || 'Agent';
    let embed: EmbedBuilder;
    if (data.messageType === 'took') {
      embed = buildTookEmbed({ title: data.title, taskId: data.taskId || '-', agentName, description: data.description });
    } else if (data.messageType === 'closed') {
      embed = buildClosedEmbed({ title: data.title, taskId: data.taskId || '-', agentName, prUrl: data.prUrl, summary: data.summary });
    } else {
      embed = buildProgressEmbed({ title: data.title, agentName, taskId: data.taskId, description: data.description || data.title, summary: data.summary });
    }
    await deps.sendToAgents(embed).catch(() => {});
  }
}
```

`IpcDeps` needs `sendToAgents` added as optional:

```typescript
// src/ipc.ts — IpcDeps interface
sendToAgents?: (embed: EmbedBuilder) => Promise<void>;
```

### Pattern 7: NANOCLAW_ASSISTANT_NAME in container

The MCP server in `container/agent-runner/src/index.ts` spawns `ipc-mcp-stdio.ts` as a subprocess with env vars passed explicitly:

```typescript
// container/agent-runner/src/index.ts — line ~466
mcpServers: {
  nanoclaw: {
    command: 'node',
    args: [mcpServerPath],
    env: {
      NANOCLAW_CHAT_JID: containerInput.chatJid,
      NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
      NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
      NANOCLAW_ASSISTANT_NAME: containerInput.assistantName || 'Agent', // ADD THIS
    },
  },
```

Then in `ipc-mcp-stdio.ts`, read it at the top:

```typescript
const assistantName = process.env.NANOCLAW_ASSISTANT_NAME || 'Agent';
```

And use `assistantName` as the `agentName` field when writing `report_agent_status` IPC files (so agent-side reports identify the agent by name, not group folder).

### Anti-Patterns to Avoid

- **Sending embeds via `sendMessage()`**: `sendMessage` takes plain text; passing an `EmbedBuilder` object as text produces `[object Object]`. Always use the new `sendEmbed` path for embeds.
- **Putting `agent_status` in TASKS_DIR**: Task-type IPC goes through `processTaskIpc()` with complex authorization. Agent status is a notification — it belongs in MESSAGES_DIR alongside `send_message`.
- **Making `sendToAgents` required on `SchedulerDependencies`**: It must be optional (`| undefined`) to preserve backward compatibility with tests that construct `SchedulerDependencies` without a Discord agents channel.
- **Blocking `runTask()` on `sendToAgents`**: The reporting calls should use `?.()` and swallow errors with `.catch(() => {})` — a Discord outage must never prevent task execution or log its error as a task failure.
- **Sending `agentName` as empty string**: If `NANOCLAW_ASSISTANT_NAME` is unset, always fall back to `'Agent'` in the MCP tool. Empty string in embed fields is a Discord API error (field values must be non-empty).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Discord embed construction | Custom JSON object shaped like an embed | `EmbedBuilder` from discord.js | Field limit validation, auto-truncation hooks, type safety |
| IPC file atomicity | Direct `writeFileSync` to final path | `writeFileSync` to `.tmp` then `renameSync` | Rename is atomic on Linux; direct write can produce partial reads |
| Message type validation | Hand-coded enum checks | `z.enum([...])` from zod | Already imported in ipc-mcp-stdio.ts; validates at tool call boundary |

---

## Common Pitfalls

### Pitfall 1: EmbedBuilder imported from wrong place
**What goes wrong:** `EmbedBuilder` imported from `discord-embeds.ts` fails (it is not re-exported there). Importing `withAgentMeta` from `discord-embeds.ts` also fails — Phase 9 made `agent-message-schema.ts` self-contained.
**Why it happens:** Developer assumes a central re-export file.
**How to avoid:** Import `EmbedBuilder` from `discord.js` directly. Import `withAgentMeta` and `AGENT_COLORS` from `./agent-message-schema.js`.
**Warning signs:** TypeScript error "Module 'discord-embeds' has no exported member 'withAgentMeta'".

### Pitfall 2: Discord field values must be non-empty strings
**What goes wrong:** Passing `taskId: undefined` to `addFields` where value is `undefined` (or empty string) causes Discord API error 50035 "Invalid Form Body".
**Why it happens:** Optional fields aren't guarded before being added.
**How to avoid:** Conditionally call `addFields` only when value is a non-empty string (matching the pattern in `discord-embeds.ts`). For taskId specifically, pass a fallback like `'-'` when missing.
**Warning signs:** Discord API rejecting the embed silently (caught by `.catch(() => {})`), embed never appears in #agents.

### Pitfall 3: SchedulerDependencies interface change breaks existing tests
**What goes wrong:** Adding `sendToAgents` as a required field to `SchedulerDependencies` causes `src/task-scheduler.test.ts` to fail because test fixtures don't supply it.
**Why it happens:** Interface required-vs-optional distinction overlooked.
**How to avoid:** Declare `sendToAgents?: (embed: EmbedBuilder) => Promise<void>` with `?` (optional). Existing call sites that omit it keep working.
**Warning signs:** TypeScript compilation error in test files referencing SchedulerDependencies.

### Pitfall 4: IpcDeps update missed in tests
**What goes wrong:** `IpcDeps` in `src/ipc.ts` gains `sendToAgents?`, but the IPC integration tests that supply a `deps` object don't include it. Since it's optional this is actually fine — but if `sendToAgents` is accidentally made required, tests break.
**Why it happens:** Forgetting to mark as optional.
**How to avoid:** Keep `sendToAgents?` optional. Add test coverage for the `agent_status` case separately.

### Pitfall 5: NANOCLAW_ASSISTANT_NAME not forwarded to MCP subprocess
**What goes wrong:** `report_agent_status` embeds show "Agent" as the agent name even after setting `ASSISTANT_NAME=Andy` in `.env`.
**Why it happens:** The MCP server is spawned as a subprocess from `container/agent-runner/src/index.ts` with an explicit `env` object. Environment variables not listed in that env object are NOT inherited by the subprocess (the SDK's mcpServers env is a whitelist, not a merge).
**How to avoid:** Explicitly add `NANOCLAW_ASSISTANT_NAME: containerInput.assistantName || 'Agent'` to the nanoclaw mcpServer env in `index.ts`.
**Warning signs:** Embed shows "Agent" for all agents regardless of ASSISTANT_NAME setting.

### Pitfall 6: Embed field count exceeds 25
**What goes wrong:** Discord rejects embeds with more than 25 fields.
**Why it happens:** `withAgentMeta` adds 2-4 fields (Agent, Type, Task, Summary). If the embed builder in `agent-status-embeds.ts` adds many fields before calling `withAgentMeta`, the total can exceed 25.
**How to avoid:** Keep embed builders to 3-4 content fields. The current design (2 content fields max per embed type) stays well within limits.
**Warning signs:** Discord API error in logs.

---

## Code Examples

### Existing send_message tool (template for report_agent_status)
```typescript
// Source: container/agent-runner/src/ipc-mcp-stdio.ts (existing)
server.tool(
  'send_message',
  "Send a message to the user...",
  {
    text: z.string().describe('The message text to send'),
    sender: z.string().optional().describe('...'),
    target_jid: z.string().optional().describe('...'),
  },
  async (args) => {
    const data: Record<string, string | undefined> = {
      type: 'message',
      chatJid: args.target_jid || chatJid,
      text: args.text,
      // ...
    };
    writeIpcFile(MESSAGES_DIR, data);
    return { content: [{ type: 'text' as const, text: 'Message sent.' }] };
  },
);
```

### Existing sendToLogs wiring (template for sendToAgents)
```typescript
// Source: src/index.ts ~line 877
let sendToLogs: ((text: string) => Promise<void>) | undefined;
// ...
sendToLogs = dumpJid
  ? async (text: string) => {
      const ch = findChannel(channels, dumpJid);
      if (ch) await ch.sendMessage(dumpJid, text).catch(() => {});
    }
  : undefined;
```

### Existing withAgentMeta usage pattern
```typescript
// Source: src/agent-message-schema.ts
export function withAgentMeta(embed: EmbedBuilder, meta: AgentMessageMeta): EmbedBuilder {
  embed.addFields(
    { name: 'Agent', value: meta.agentName, inline: true },
    { name: 'Type', value: meta.messageType, inline: true },
  );
  if (meta.taskId) {
    embed.addFields({ name: 'Task', value: meta.taskId, inline: true });
  }
  if (meta.summary) {
    embed.addFields({ name: 'Summary', value: truncate(meta.summary, 1024), inline: false });
  }
  return embed;
}
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code changes with no new external dependencies. Discord.js and all required packages are already installed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts present) |
| Config file | `/home/andrii-panasenko/nanoclaw/vitest.config.ts` |
| Quick run command | `npx vitest run src/agent-status-embeds.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASTATUS-01 | `buildTookEmbed` returns embed with correct color, title, fields | unit | `npx vitest run src/agent-status-embeds.test.ts` | ❌ Wave 0 |
| ASTATUS-02 | `buildClosedEmbed` returns embed with correct color, title, PR field | unit | `npx vitest run src/agent-status-embeds.test.ts` | ❌ Wave 0 |
| ASTATUS-03 | `buildProgressEmbed` returns embed with correct color, description | unit | `npx vitest run src/agent-status-embeds.test.ts` | ❌ Wave 0 |
| ASTATUS-01 | `runTask()` calls `sendToAgents` with took embed at start | unit | `npx vitest run src/task-scheduler.test.ts` | existing (needs new test) |
| ASTATUS-02 | `runTask()` calls `sendToAgents` with closed embed on success | unit | `npx vitest run src/task-scheduler.test.ts` | existing (needs new test) |
| ASTATUS-03 | IPC watcher processes `agent_status` type and calls `sendToAgents` | unit | `npx vitest run src/ipc.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/agent-status-embeds.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/agent-status-embeds.test.ts` — unit tests for buildTookEmbed, buildClosedEmbed, buildProgressEmbed (covers ASTATUS-01, ASTATUS-02, ASTATUS-03)
- [ ] `src/ipc.test.ts` — IPC watcher test for `agent_status` message type (covers ASTATUS-03 agent path)
- [ ] New test cases in `src/task-scheduler.test.ts` — verify sendToAgents called at task start/end

---

## Open Questions

1. **sendToAgents signature: embed vs. pre-built function**
   - What we know: `sendToLogs` takes `string`. `sendToAgents` must take `EmbedBuilder` because `sendMessage` doesn't accept embeds.
   - What's unclear: Should `sendToAgents` take the `EmbedBuilder` directly, or take a builder function `() => EmbedBuilder` to avoid building if not configured?
   - Recommendation: Accept `EmbedBuilder` directly (same simplicity as `sendToLogs`). The build cost is negligible.

2. **Error task embed: should there be a "failed" embed type?**
   - What we know: CONTEXT.md only specifies took/closed/progress for Phase 10. AGENT_COLORS has no "failed" entry.
   - What's unclear: When a scheduled task fails (error path), should it post a closed embed with an error indicator, or nothing?
   - Recommendation: On error, skip the closed embed (send nothing). Phase 11 covers blocker reporting. This keeps Phase 10 minimal.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `src/index.ts` (lines 877-888) — exact `sendToLogs` wiring pattern
- Direct code inspection of `src/task-scheduler.ts` (lines 67-254) — `SchedulerDependencies`, `runTask` call sites
- Direct code inspection of `src/ipc.ts` (lines 84-143) — IPC message watcher loop structure
- Direct code inspection of `container/agent-runner/src/index.ts` (lines 461-469) — MCP subprocess env injection
- Direct code inspection of `container/agent-runner/src/ipc-mcp-stdio.ts` (lines 42-64) — `send_message` tool template
- Direct code inspection of `src/agent-message-schema.ts` — `withAgentMeta`, `AGENT_COLORS`, `AgentMessageType`
- Direct code inspection of `src/discord-embeds.ts` — embed builder style guide
- Direct code inspection of `src/channels/discord.ts` (lines 420-526) — `sendMessage` accepts text only (no embed support currently)
- Direct code inspection of `src/types.ts` — `Channel` interface, `ScheduledTask` shape

### Secondary (MEDIUM confidence)
- Phase 10 CONTEXT.md — locked decisions from discuss phase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already present in project, versions verified in package.json
- Architecture: HIGH — based on direct code inspection of all integration points
- Pitfalls: HIGH — sourced from actual code shape (embed-only path required, optional fields, subprocess env whitelist)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable codebase; no fast-moving external dependencies)
