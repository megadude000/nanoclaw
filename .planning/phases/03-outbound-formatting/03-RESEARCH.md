# Phase 3: Outbound Formatting - Research

**Researched:** 2026-03-26
**Domain:** Discord outbound messaging — embeds, chunking, buttons, editMessage, sendPhoto
**Confidence:** HIGH

## Summary

Phase 3 enhances Discord outbound messaging. The foundation already exists: `sendMessage` with basic 2000-char chunking and `setTyping` are implemented from Phase 1 (OUT-01, OUT-05 done). This phase upgrades chunking to be markdown-aware (OUT-02 enhancement), adds rich embeds (OUT-03), message editing (OUT-04), button interaction handling (OUT-06), plus `sendPhoto` and `sendMessageRaw`.

The existing codebase has a clear pattern: Telegram already implements all these methods (`sendWithButtons`, `editMessage`, `sendMessageRaw`, `sendPhoto`), and `index.ts` already wires them through `findChannel()` for IPC and ProgressTracker. Discord just needs to implement the same interface methods. The `Channel` interface in `types.ts` already declares optional `sendPhoto`, `reactToMessage`, and `sendWithButtons`. Two new optional methods must be added: `editMessage` and `sendMessageRaw` (decisions D-08, D-10).

**Primary recommendation:** Implement each Channel method on DiscordChannel following Telegram's patterns exactly, add embed builder helpers as a utility module, and enhance the existing chunking algorithm in-place.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Color-coded embeds by notification source — red for bugs, blue for tasks, green for progress, orange for alerts
- **D-02:** Consistent embed field layout: title, description, inline fields, footer with timestamp
- **D-03:** Type-specific embed builder helpers: `buildBugEmbed(issue)`, `buildTaskEmbed(task)`, `buildProgressEmbed(data)` — each knows its color, fields, and layout
- **D-04:** Markdown-aware splitting — respect code fences, bullet lists, and headers when splitting at 2000-char Discord limit
- **D-05:** Falls back to line-break split if no markdown boundary found, then hard split as last resort
- **D-06:** Full button implementation — send buttons via `sendWithButtons` AND handle `interactionCreate` events for button click callbacks
- **D-07:** Button clicks route back to the agent for processing
- **D-08:** Add `editMessage?(jid: string, messageId: string, text: string): Promise<void>` as optional method on Channel interface in types.ts
- **D-09:** Discord implements editMessage using discord.js `message.edit()` — needed for progress tracker updates (Phase 6)
- **D-10:** Add `sendMessageRaw?(jid: string, text: string): Promise<{message_id: string}>` to Channel interface — returns message ID for edit/button tracking
- **D-11:** Keeps `sendMessage` backward-compatible (void return)
- **D-12:** When outbound operations fail, send an error notification to the originating chat rather than silent logging only
- **D-13:** Requires knowing the originating JID context — router must pass origin info for cross-channel error reporting
- **D-14:** Discord implements `sendPhoto` using `channel.send({files: [path], content: caption})`
- **D-15:** Completes the Channel interface methods for Discord in one phase

### Claude's Discretion
- Exact embed color hex values
- Error message format and wording
- Internal chunking algorithm implementation details
- Button component styling (primary/secondary/danger variants)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUT-01 | Bot sends text messages to Discord channels via `sendMessage(jid, text)` | Already implemented in discord.ts:209-238. No changes needed. |
| OUT-02 | Bot splits messages exceeding 2000-char Discord limit into multiple messages | Current implementation does naive char-slicing. Enhance with markdown-aware splitting (D-04, D-05). |
| OUT-03 | Bot sends rich embeds for structured notifications | Use discord.js `EmbedBuilder`. Create embed helper module with `buildBugEmbed`, `buildTaskEmbed`, `buildProgressEmbed` (D-01 through D-03). |
| OUT-04 | Bot edits own messages via `editMessage` for progress tracker updates | Add `editMessage` to Channel interface (D-08), implement on DiscordChannel using `message.edit()`. ProgressTracker in index.ts already calls `ch?.editMessage?.(jid, msgId, text)`. |
| OUT-05 | Bot shows typing indicator while agent processes | Already implemented in discord.ts:257-268. No changes needed. |
| OUT-06 | Bot sends messages with inline keyboard buttons via `sendWithButtons` | Use discord.js `ActionRowBuilder` + `ButtonBuilder`. Handle `Events.InteractionCreate` for callbacks (D-06, D-07). IPC wiring in index.ts:718-721 already routes through `findChannel`. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | ^14.18.0 | Discord API client | Already in project. EmbedBuilder, ActionRowBuilder, ButtonBuilder all included. |
| vitest | ^4.0.18 | Test framework | Already in project. 42 existing Discord tests to extend. |

### No Additional Libraries Needed
All discord.js sub-packages are bundled: `EmbedBuilder`, `ActionRowBuilder`, `ButtonBuilder`, `ButtonStyle`, `ComponentType` are all importable from `discord.js` directly.

## Architecture Patterns

### File Structure
```
src/
  channels/
    discord.ts           # Add methods: editMessage, sendMessageRaw, sendPhoto, sendWithButtons + interactionCreate handler
    discord.test.ts      # Extend with tests for new methods
  discord-embeds.ts      # NEW: embed builder helpers (buildBugEmbed, buildTaskEmbed, buildProgressEmbed)
  discord-chunker.ts     # NEW: markdown-aware message splitting
  types.ts               # Add editMessage, sendMessageRaw to Channel interface
  router.ts              # Add origin JID context for cross-channel error feedback
```

### Pattern 1: Optional Channel Methods
**What:** New methods added as optional (`?` suffix) on the Channel interface, matching existing pattern for `sendPhoto`, `reactToMessage`, `sendWithButtons`.
**When to use:** Always for methods not every channel supports.
**Example:**
```typescript
// types.ts - add these to Channel interface
editMessage?(jid: string, messageId: string, text: string): Promise<void>;
sendMessageRaw?(jid: string, text: string): Promise<{ message_id: string } | undefined>;
```

### Pattern 2: IPC Wiring via findChannel
**What:** index.ts already routes optional methods through `findChannel()` with optional chaining. `sendMessageRaw` and `editMessage` are already wired for ProgressTracker (index.ts:744-750) using `as any` cast.
**When to use:** Once the Channel interface is updated, the `as any` casts can be removed.
**Existing code (index.ts:744-750):**
```typescript
sendMsg: async (jid, text) => {
  const ch = findChannel(channels, jid) as any;
  return ch?.sendMessageRaw?.(jid, text);
},
editMsg: async (jid, msgId, text) => {
  const ch = findChannel(channels, jid) as any;
  await ch?.editMessage?.(jid, msgId, text);
},
```

### Pattern 3: Embed Builders as Pure Functions
**What:** Stateless helper functions that accept data objects and return `EmbedBuilder` instances. Keep in a dedicated module for testability.
**Example:**
```typescript
// discord-embeds.ts
import { EmbedBuilder } from 'discord.js';

const COLORS = {
  bug: 0xED4245,       // Red
  task: 0x5865F2,      // Blurple (Discord blue)
  progress: 0x57F287,  // Green
  alert: 0xFEE75C,     // Yellow/Orange
} as const;

export function buildBugEmbed(issue: {
  title: string;
  body?: string;
  reporter?: string;
  priority?: string;
  labels?: string[];
  url?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.bug)
    .setTitle(`Bug: ${issue.title}`)
    .setDescription(issue.body?.slice(0, 4096) || '')
    .setTimestamp();
  if (issue.reporter) embed.addFields({ name: 'Reporter', value: issue.reporter, inline: true });
  if (issue.priority) embed.addFields({ name: 'Priority', value: issue.priority, inline: true });
  if (issue.labels?.length) embed.addFields({ name: 'Labels', value: issue.labels.join(', '), inline: true });
  if (issue.url) embed.setURL(issue.url);
  return embed;
}
```

### Pattern 4: Markdown-Aware Chunking
**What:** Split long messages at markdown boundaries (code fences, blank lines, headers) rather than mid-word/mid-line.
**Algorithm (D-04, D-05):**
1. If text <= 2000 chars, return as-is
2. Try splitting at code fence boundaries (`\`\`\``)
3. Try splitting at double newlines (paragraph breaks)
4. Try splitting at single newlines
5. Hard split at 2000 chars as last resort
6. Each chunk must be <= 2000 chars

**Key edge case:** Code fences that span across chunk boundaries must be closed in the current chunk and reopened in the next chunk with the same language tag.

### Pattern 5: Button Interaction Handler
**What:** Register `Events.InteractionCreate` handler in `connect()` to handle button clicks. Route callbacks back to agent via IPC.
**Example:**
```typescript
// In connect(), after client creation:
this.client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  // Acknowledge the interaction immediately (3-second timeout)
  await interaction.deferUpdate();
  // Route button data back to agent
  const chatJid = `dc:${interaction.channelId}`;
  this.opts.onMessage(chatJid, {
    id: interaction.id,
    chat_jid: chatJid,
    sender: interaction.user.id,
    sender_name: interaction.member?.displayName || interaction.user.displayName || interaction.user.username,
    content: `@${ASSISTANT_NAME} [button:${interaction.customId}]`,
    timestamp: new Date().toISOString(),
    is_from_me: false,
  });
});
```

### Anti-Patterns to Avoid
- **Fetching message by ID for editMessage:** Do NOT fetch the message first then call `.edit()`. Use `channel.messages.edit(messageId, content)` or fetch-then-edit. Discord.js requires the Message object, so you must fetch it.
- **Blocking on interaction response:** Interactions have a 3-second acknowledgment deadline. Always `deferUpdate()` or `deferReply()` before any async processing.
- **Ignoring embed character limits:** Embed description max is 4096 chars, total across all embeds is 6000 chars. Truncate before building.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich message formatting | Custom markdown-to-Discord converter | `EmbedBuilder` from discord.js | Handles field validation, color, timestamps, footers automatically |
| Button layouts | Raw JSON action rows | `ActionRowBuilder` + `ButtonBuilder` from discord.js | Type-safe, validates button count per row (max 5), handles component IDs |
| Message chunking code fences | Regex-only fence detection | State machine tracking open/close fences | Regex fails on nested fences, incomplete fences, fences in blockquotes |

## Common Pitfalls

### Pitfall 1: Discord Message ID is a String (Snowflake)
**What goes wrong:** Telegram uses numeric message IDs. Discord uses string snowflake IDs. Mixing types causes silent failures.
**Why it happens:** Telegram's `editMessage` takes `messageId: number`, Discord needs `messageId: string`. The Channel interface must use `string` for Discord compatibility.
**How to avoid:** Channel interface `editMessage` uses `string` for messageId (D-08 already specifies this). `sendMessageRaw` returns `{ message_id: string }`.
**Warning signs:** TypeScript type errors when passing message IDs between ProgressTracker and Discord channel.

### Pitfall 2: Interaction Acknowledgment Timeout
**What goes wrong:** Button click handlers that do async work before responding get a "This interaction failed" error in Discord.
**Why it happens:** Discord requires interaction acknowledgment within 3 seconds.
**How to avoid:** Always call `interaction.deferUpdate()` immediately, then do async work.
**Warning signs:** "Unknown interaction" errors in logs.

### Pitfall 3: Code Fence Splitting
**What goes wrong:** A message with a code block gets split mid-fence, producing broken markdown rendering.
**Why it happens:** Naive chunking doesn't track open/close state of triple-backtick fences.
**How to avoid:** Track fence state during splitting. If a chunk ends inside a fence, close it and reopen with the same language tag in the next chunk.
**Warning signs:** Messages with unclosed code blocks appearing in Discord.

### Pitfall 4: Embed Field Limits
**What goes wrong:** Embed creation fails silently or throws when exceeding limits.
**Why it happens:** Discord enforces: title 256 chars, description 4096 chars, field name 256, field value 1024, 25 fields max, total 6000 chars across all embeds.
**How to avoid:** Truncate all fields before passing to EmbedBuilder. Add a utility `truncate(str, max)`.
**Warning signs:** DiscordAPIError with code 50035 (Invalid Form Body).

### Pitfall 5: Button customId Length Limit
**What goes wrong:** Buttons with long callback data fail to send.
**Why it happens:** Discord limits `customId` to 100 characters.
**How to avoid:** Keep button data short. If complex data is needed, store a lookup key and resolve on callback.
**Warning signs:** DiscordAPIError when sending messages with buttons.

## Code Examples

### editMessage Implementation
```typescript
async editMessage(jid: string, messageId: string, text: string): Promise<void> {
  if (!this.client) return;
  try {
    const channelId = jid.replace(/^dc:/, '');
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !('messages' in channel)) return;
    const textChannel = channel as TextChannel;
    const message = await textChannel.messages.fetch(messageId);
    await message.edit(text);
  } catch (err) {
    logger.debug({ jid, messageId, err }, 'Failed to edit Discord message');
  }
}
```

### sendMessageRaw Implementation
```typescript
async sendMessageRaw(jid: string, text: string): Promise<{ message_id: string } | undefined> {
  if (!this.client) return undefined;
  try {
    const channelId = jid.replace(/^dc:/, '');
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !('send' in channel)) return undefined;
    const textChannel = channel as TextChannel;
    const msg = await textChannel.send(text.slice(0, 2000));
    return { message_id: msg.id };
  } catch (err) {
    logger.debug({ jid, err }, 'sendMessageRaw failed');
    return undefined;
  }
}
```

### sendWithButtons Implementation
```typescript
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

async sendWithButtons(
  jid: string,
  text: string,
  buttons: Array<{ label: string; data: string }>,
  rowSize: number = 5,
): Promise<void> {
  if (!this.client) return;
  try {
    const channelId = jid.replace(/^dc:/, '');
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !('send' in channel)) return;
    const textChannel = channel as TextChannel;

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += rowSize) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      row.addComponents(
        buttons.slice(i, i + rowSize).map((b) =>
          new ButtonBuilder()
            .setCustomId(b.data.slice(0, 100))
            .setLabel(b.label)
            .setStyle(ButtonStyle.Primary)
        ),
      );
      rows.push(row);
    }
    await textChannel.send({ content: text, components: rows });
  } catch (err) {
    logger.error({ jid, err }, 'Failed to send Discord message with buttons');
  }
}
```

### sendPhoto Implementation
```typescript
async sendPhoto(jid: string, photoPath: string, caption?: string): Promise<void> {
  if (!this.client) return;
  try {
    const channelId = jid.replace(/^dc:/, '');
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !('send' in channel)) return;
    const textChannel = channel as TextChannel;
    await textChannel.send({
      content: caption || undefined,
      files: [photoPath],
    });
    logger.info({ jid, photoPath, hasCaption: !!caption }, 'Discord photo sent');
  } catch (err) {
    logger.error({ jid, photoPath, err }, 'Failed to send Discord photo');
  }
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npx vitest run src/channels/discord.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUT-01 | sendMessage sends text | unit | `npx vitest run src/channels/discord.test.ts -t "sendMessage"` | Exists (4 tests) |
| OUT-02 | Markdown-aware chunking | unit | `npx vitest run src/discord-chunker.test.ts` | Wave 0 |
| OUT-03 | Embed builders produce correct structure | unit | `npx vitest run src/discord-embeds.test.ts` | Wave 0 |
| OUT-04 | editMessage fetches and edits | unit | `npx vitest run src/channels/discord.test.ts -t "editMessage"` | Wave 0 |
| OUT-05 | setTyping sends typing indicator | unit | `npx vitest run src/channels/discord.test.ts -t "setTyping"` | Exists (3 tests) |
| OUT-06 | sendWithButtons creates ActionRow + handles interactionCreate | unit | `npx vitest run src/channels/discord.test.ts -t "sendWithButtons"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/channels/discord.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/discord-chunker.test.ts` -- covers OUT-02 (markdown-aware splitting, code fence handling, fallback splitting)
- [ ] `src/discord-embeds.test.ts` -- covers OUT-03 (embed color, fields, truncation, timestamp)
- [ ] Tests in `discord.test.ts` for: editMessage, sendMessageRaw, sendPhoto, sendWithButtons, interactionCreate handler

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/channels/discord.ts`, `src/channels/telegram.ts`, `src/types.ts`, `src/index.ts`, `src/router.ts`
- CLAUDE.md Technology Stack section -- discord.js API surface, message limits, integration pattern table

### Secondary (MEDIUM confidence)
- discord.js documentation (discordjs.guide) -- EmbedBuilder, ActionRowBuilder, ButtonBuilder, interaction handling patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - discord.js already installed, all needed classes bundled
- Architecture: HIGH - existing Telegram implementations provide exact pattern to follow
- Pitfalls: HIGH - Discord API limits well-documented, interaction timeout is well-known

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, discord.js v14 is mature)
