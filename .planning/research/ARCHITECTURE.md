# Architecture Patterns

**Domain:** Discord bot integration into multi-channel chat bot (NanoClaw)
**Researched:** 2026-03-26

## Recommended Architecture

Discord integrates as a **peer channel** alongside Telegram, following the existing self-registration pattern. The Discord channel module owns all `dc:` prefixed JIDs and manages both inbound message handling and server administration capabilities.

```
                     +------------------+
                     |   NanoClaw Core  |
                     |   (index.ts)     |
                     |   Message Loop   |
                     +--------+---------+
                              |
              +---------------+---------------+
              |                               |
     +--------v--------+            +--------v--------+
     | Channel Registry |            |   IPC Watcher   |
     | (registry.ts)    |            |   (ipc.ts)      |
     +--------+---------+            +--------+--------+
              |                               |
    +---------+---------+            +--------+--------+
    |         |         |            | File-based JSON |
    v         v         v            | per group dir   |
 Telegram  Discord   Gmail          +-----------------+
 (tg:)     (dc:)     (gm:)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **DiscordChannel** (`src/channels/discord.ts`) | Connects to Discord Gateway, handles inbound messages, sends outbound messages, owns `dc:*` JIDs | Channel Registry, NanoClaw Core (via callbacks) |
| **DiscordServerManager** (internal to discord.ts) | Creates/deletes channels, categories, sets permissions programmatically | Discord API (discord.js), IPC Watcher (receives commands) |
| **Channel Registry** (`src/channels/registry.ts`) | Stores channel factories, routes JIDs to channels | All channel modules |
| **IPC Watcher** (`src/ipc.ts`) | Processes file-based commands from agent containers | DiscordChannel (for `dc:` targeted messages), DiscordServerManager (for server management IPC commands) |
| **Webhook Router** (`src/github-issues-webhook.ts`, `src/notion-webhook.ts`) | Routes webhook events to target JIDs | Any channel via `sendMessage(jid, text)` |
| **Progress Tracker** (`src/progress-tracker.ts`) | Shows real-time agent progress in chat | Any channel with `sendMessageRaw`/`editMessage`/`deleteMessage` support |
| **Bot Pool** (discord-side equivalent of Telegram pool) | Friday/Alfred identities in Discord via webhooks | Discord webhook API per channel |

### Data Flow

#### Inbound Message Flow (User writes in Discord)

```
Discord Gateway
  -> discord.js Client event: messageCreate
  -> DiscordChannel.handleMessage()
     1. Build JID: "dc:{guildId}:{channelId}" or "dc:{channelId}" for DMs
     2. Check registeredGroups() — skip if unregistered
     3. Translate @bot mentions to TRIGGER_PATTERN format
     4. Call onChatMetadata(jid, timestamp, channelName, "discord", true)
     5. Call onMessage(jid, { id, chat_jid, sender, sender_name, content, timestamp })
  -> NanoClaw message loop picks up message
  -> Spawns agent container with group's CLAUDE.md
  -> Agent produces response
  -> routeOutbound(channels, "dc:...", text)
  -> DiscordChannel.sendMessage() formats for Discord markdown
```

#### Outbound Notification Flow (Webhook to Discord)

```
GitHub/Notion webhook HTTP request
  -> Webhook handler identifies event type
  -> Looks up target JID from routing config (NEW: configurable per-webhook)
     e.g., bugs -> "dc:guild:bugs-channel-id"
           tasks -> "dc:guild:tasks-channel-id"
           fallback -> "tg:633706070" (Telegram main)
  -> routeOutbound(channels, targetJid, formattedText)
  -> DiscordChannel.sendMessage(jid, text)
  -> Discord API posts to correct channel
```

#### Server Management Flow (Agent manages Discord server)

```
Agent container writes IPC JSON:
  { type: "discord_manage", action: "create_channel", ... }
  -> to /workspace/ipc/{group}/messages/{timestamp}.json

IPC Watcher reads file
  -> Validates: sourceGroup isMain (only main can manage server)
  -> Dispatches to DiscordServerManager
  -> DiscordServerManager calls discord.js API:
     guild.channels.create(), channel.delete(), etc.
  -> Writes response to /workspace/ipc/{group}/responses/
```

#### Dual-Send Flow (Gradual Migration)

```
Webhook event arrives
  -> Routing config says: target = ["dc:guild:bugs", "tg:633706070"]
  -> For each target JID:
     routeOutbound(channels, jid, text)
  -> Both Telegram and Discord receive the notification

Config update (later): target = ["dc:guild:bugs"]
  -> Only Discord receives it now
```

## Component Design Details

### 1. DiscordChannel Class

Implements the `Channel` interface. Mirrors TelegramChannel structure:

```typescript
export class DiscordChannel implements Channel {
  name = 'discord';

  // Required by Channel interface
  async connect(): Promise<void>;           // Login to Discord Gateway
  async sendMessage(jid: string, text: string): Promise<void>;
  isConnected(): boolean;
  ownsJid(jid: string): boolean;            // jid.startsWith('dc:')
  async disconnect(): Promise<void>;

  // Optional Channel interface methods
  async setTyping?(jid: string, isTyping: boolean): Promise<void>;
  async reactToMessage?(jid: string, messageId: string, emoji: string): Promise<void>;
  async sendWithButtons?(jid, text, buttons, rowSize): Promise<void>;
  async sendPhoto?(jid, photoPath, caption?): Promise<void>;

  // Discord-specific (for progress tracker)
  async sendMessageRaw(jid, text): Promise<{ message_id: number } | undefined>;
  async editMessage(jid, messageId, text): Promise<void>;
  async deleteMessage(jid, messageId): Promise<void>;

  // Server management (called by IPC watcher)
  async createChannel(guildId, name, categoryId?, options?): Promise<string>;
  async deleteChannel(channelId): Promise<void>;
  async createCategory(guildId, name): Promise<string>;
  async setPermissions(channelId, overrides): Promise<void>;
}
```

### 2. JID Format for Discord

```
dc:{channelId}              — DM channels (no guild context)
dc:{guildId}:{channelId}    — Server channels (with guild context)
```

Rationale: Guild ID is needed for server management operations. Channel ID alone is sufficient for messaging but guild context enables the agent to understand which server a channel belongs to. Keep the simpler `dc:{channelId}` form for DMs since no guild context exists.

### 3. Discord-to-NanoClaw Markdown Translation

Discord and Claude both use standard Markdown, but Discord has specific formatting:
- **Bold**: `**text**` (Discord) vs `*text*` (Telegram Markdown v1)
- **Code blocks**: Both use triple backticks
- **Mentions**: `<@userId>`, `<#channelId>`, `<@&roleId>`
- **Embeds**: Discord supports rich embeds for structured notifications

For outbound messages, use Discord embeds for webhook notifications (bugs, tasks, progress) and plain markdown for conversational responses. No translation layer needed for inbound -- Discord markdown maps cleanly to what Claude expects.

### 4. Webhook Routing Configuration

Add to config or per-group settings:

```typescript
interface WebhookRouting {
  // Maps webhook event type to target JID(s)
  // Array enables dual-send during migration
  github_issues_bug: string[];      // e.g., ["dc:guild:bugs-channel"]
  github_issues_other: string[];    // e.g., ["dc:guild:bugs-channel", "tg:main"]
  notion_tasks: string[];           // e.g., ["dc:guild:yw-tasks"]
  progress: string[];               // e.g., ["dc:guild:progress"]
  dev_alerts: string[];             // e.g., ["dc:guild:dev-alerts"]
  default: string[];                // fallback: ["tg:633706070"]
}
```

Store in `.env` or `data/webhook-routing.json`. Agent can update via IPC.

### 5. Per-Channel CLAUDE.md (Contextual Responses)

Each Discord channel registered as a group gets its own `groups/{folder}/CLAUDE.md`:

```
groups/
  dc-bugs/
    CLAUDE.md          # "You are in the #bugs channel. Respond in bug-triage mode..."
  dc-yw-tasks/
    CLAUDE.md          # "You are in the #yw-tasks channel. Focus on project management..."
  dc-progress/
    CLAUDE.md          # "You are in #progress. Summarize agent activity..."
  dc-main/
    CLAUDE.md          # "You are in Discord #main. General conversation backup..."
```

### 6. Swarm Bot Identity in Discord

Discord approach differs from Telegram's bot pool:
- **Telegram**: Multiple bot tokens, each renamed to match agent identity (Friday, Alfred)
- **Discord**: Use **channel webhooks** per agent identity. Each webhook has its own name and avatar.

```typescript
// Per-channel webhook for each swarm bot identity
interface DiscordSwarmBot {
  name: string;           // "Friday", "Alfred"
  avatarUrl: string;      // Bot-specific avatar
  webhookId: string;      // Discord webhook ID (created via API)
  webhookToken: string;   // Discord webhook token
}
```

The IPC message handler checks `data.sender` -- if it matches a swarm bot name and target is `dc:*`, route through that bot's webhook instead of the main bot.

### 7. IPC Extensions for Discord Server Management

New IPC message types (main group only):

```typescript
// Create a channel
{ type: "discord_manage", action: "create_channel", guildId, name, categoryId?, topic? }

// Delete a channel
{ type: "discord_manage", action: "delete_channel", channelId }

// Create a category
{ type: "discord_manage", action: "create_category", guildId, name }

// Set channel permissions
{ type: "discord_manage", action: "set_permissions", channelId, overrides: [...] }

// Create webhook for swarm bot
{ type: "discord_manage", action: "create_webhook", channelId, name, avatarUrl? }
```

Response written to `ipc/{group}/responses/discord-manage-{timestamp}.json`.

## Patterns to Follow

### Pattern 1: Self-Registration (Existing)
**What:** Channel modules call `registerChannel()` at import time with a factory function.
**When:** Always -- this is how NanoClaw discovers channels.
**Implementation:**
```typescript
// Bottom of src/channels/discord.ts
registerChannel('discord', (opts: ChannelOpts) => {
  const envVars = readEnvFile(['DISCORD_BOT_TOKEN']);
  const token = process.env.DISCORD_BOT_TOKEN || envVars.DISCORD_BOT_TOKEN || '';
  if (!token) {
    logger.warn('Discord: DISCORD_BOT_TOKEN not set');
    return null;
  }
  return new DiscordChannel(token, opts);
});
```

### Pattern 2: JID-Based Routing (Existing)
**What:** Every chat has a JID with channel prefix. Router finds correct channel via `ownsJid()`.
**When:** All message routing -- inbound identification and outbound delivery.

### Pattern 3: IPC Authorization (Existing)
**What:** Main group can send to any JID. Non-main groups can only send to their own JID.
**When:** All IPC message processing. Discord server management is main-only.

### Pattern 4: Embed-Based Notifications (New, Discord-specific)
**What:** Use Discord embeds for structured webhook notifications instead of plain text.
**When:** GitHub Issues, Notion tasks, progress updates routed to Discord channels.
**Why:** Embeds provide color-coded, structured display. Bug = red sidebar, task = blue, progress = green.

### Pattern 5: Webhook-Based Identities (New, Discord-specific)
**What:** Swarm bots (Friday/Alfred) post via Discord channel webhooks with custom name/avatar.
**When:** Any IPC message with a `sender` field targeting a `dc:` JID.
**Why:** Discord webhooks natively support custom display names and avatars per message, cleaner than Telegram's bot-rename approach.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Slash Commands for Bot Interaction
**What:** Using Discord slash commands (`/ping`, `/restart`) for bot control.
**Why bad:** NanoClaw uses its own trigger pattern (`@Andy ...`). Slash commands create a parallel control system, fragment interaction patterns, and require OAuth2 scope management.
**Instead:** Use the same `@mention` -> `TRIGGER_PATTERN` translation that Telegram uses. Discord `@BotName` mention translates to `@Andy` prefix.

### Anti-Pattern 2: One Group Per Server
**What:** Mapping the entire Discord server to a single NanoClaw group.
**Why bad:** Loses the channel-specific context that makes Discord valuable. Agent would not know if a message is about bugs or tasks.
**Instead:** One NanoClaw group per Discord channel. Each channel gets its own JID, CLAUDE.md, and agent context.

### Anti-Pattern 3: Direct Database Access from Discord Module
**What:** Discord channel code directly calling `createTask()`, `getTaskById()`, etc.
**Why bad:** Breaks the IPC boundary. Channel modules should only handle message I/O. Task scheduling, group registration, and management flow through IPC.
**Instead:** Channel delivers messages via `onMessage()` callback. Agent handles logic. Management commands flow through IPC files.

### Anti-Pattern 4: Hardcoded Channel IDs
**What:** Storing Discord channel IDs in source code or `.env` as constants.
**Why bad:** Channel IDs change when channels are recreated. The bot can create channels dynamically.
**Instead:** Store channel mapping in `data/discord-channels.json` or SQLite. Agent discovers and updates via IPC. Server setup is a one-time bootstrap task.

### Anti-Pattern 5: Blocking Gateway Connection
**What:** Waiting for Discord gateway to fully connect before starting other channels.
**Why bad:** Discord reconnection can take seconds to minutes. Should not block Telegram.
**Instead:** Connect channels in parallel (existing pattern). Discord posts a "connected" log when ready. Messages queue until connected.

## Suggested Build Order

Dependencies flow top-down. Each layer requires the one above it.

```
Phase 1: Foundation
  DiscordChannel class (implements Channel interface)
  Self-registration via registerChannel()
  Basic connect/disconnect/sendMessage/ownsJid
  JID format: dc:{guildId}:{channelId}
  Enable in src/channels/index.ts

Phase 2: Inbound Messages
  messageCreate handler (text, attachments, replies)
  @mention -> TRIGGER_PATTERN translation
  onMessage() + onChatMetadata() callbacks
  Group registration for Discord channels

Phase 3: Outbound + Formatting
  Discord markdown handling (embeds for notifications)
  Message splitting (2000 char Discord limit vs 4096 Telegram)
  sendMessageRaw/editMessage/deleteMessage for progress tracker
  setTyping indicator

Phase 4: Server Management
  IPC handler for discord_manage commands
  createChannel, deleteChannel, createCategory, setPermissions
  Bootstrap script to set up initial server structure
  Response files for agent feedback

Phase 5: Webhook Routing
  Configurable routing (webhook-routing.json)
  Dual-send support (Telegram + Discord simultaneously)
  GitHub Issues -> #bugs channel
  Notion -> #yw-tasks channel
  Progress tracker -> #progress channel

Phase 6: Swarm Bot Identity
  Discord webhook creation per channel per bot identity
  IPC sender detection -> webhook routing
  Friday/Alfred custom names and avatars

Phase 7: Per-Channel Context
  Channel-specific CLAUDE.md files
  Cortex knowledge section references
  Auto-registration of Discord channels as groups

Phase 8: Migration Controls
  Dual-send toggle per webhook type
  Telegram notification disable (per type)
  Status dashboard in #bot-control
```

**Phase ordering rationale:**
- Phase 1-2 must come first: cannot do anything without basic connectivity and message handling.
- Phase 3 before 4: outbound messaging is needed for server management feedback.
- Phase 4 before 5: server channels must exist before webhooks can route to them.
- Phase 5 before 6: notifications must work before adding identity layers.
- Phase 7 can run in parallel with 5-6 but benefits from channels existing.
- Phase 8 is last: requires everything working before migration makes sense.

## Scalability Considerations

| Concern | Current (1 server) | At 5 servers | Notes |
|---------|-------------------|--------------|-------|
| JID uniqueness | `dc:guildId:channelId` is globally unique | Same format scales | No changes needed |
| Gateway connection | Single bot, single shard | Single shard up to 2500 guilds | discord.js handles auto-sharding if needed |
| Rate limits | Discord: 50 requests/second global | Same limit shared | Use queue for burst notifications |
| IPC volume | ~10 messages/day | ~50 messages/day | File polling at 1s interval is fine |
| Webhook routing | Simple JSON config | Same config, more entries | No architectural changes |

## Sources

- NanoClaw source code: `src/channels/telegram.ts`, `src/channels/registry.ts`, `src/types.ts`, `src/ipc.ts`, `src/router.ts`, `src/config.ts`, `src/github-issues-webhook.ts`, `src/progress-tracker.ts`
- Discord.js documentation (HIGH confidence -- well-established library, stable v14 API)
- Discord API documentation for webhooks, embeds, gateway intents
- `.planning/PROJECT.md` project requirements and target server structure
