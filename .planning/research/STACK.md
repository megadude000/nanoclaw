# Technology Stack

**Project:** Discord Integration for NanoClaw
**Researched:** 2026-03-26

## Recommended Stack

### Core Library
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| discord.js | ^14.25.1 | Discord API client | De facto standard for Node.js Discord bots. 347K weekly downloads, 26K GitHub stars. First-class TypeScript support. Full guild management API (channels, categories, roles, permissions). No serious competitor in the Node.js ecosystem. | HIGH |

### Supporting Libraries (already in project)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| typescript | ^5.7.0 | Type safety | Already in project, discord.js ships its own types |
| pino | ^9.6.0 | Logging | Already in project, use same logger |
| better-sqlite3 | ^11.8.1 | Database | Already in project, store Discord channel mappings |
| zod | ^4.3.6 | Validation | Already in project, validate Discord config/events |

### No Additional Libraries Needed
discord.js v14 bundles everything required:
- `@discordjs/rest` -- REST API client (included)
- `@discordjs/ws` -- WebSocket gateway (included)
- `@discordjs/builders` -- Embed/component builders (included)
- `@discordjs/collection` -- Enhanced Map (included)
- `@discordjs/formatters` -- Markdown formatting (included)
- `discord-api-types` -- TypeScript types for Discord API (included)

No need for separate packages like `discord-api-types` or `@discordjs/rest` -- they come transitively.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Discord library | discord.js v14 | Eris v0.18 | 100x fewer downloads (3K vs 347K/week). Fewer helpers. Less documentation. Only advantage is memory efficiency, irrelevant for a single-server private bot. |
| Discord library | discord.js v14 | Oceanic.js | Niche. Requires compatibility wrappers. No ecosystem advantage. |
| Discord library | discord.js v14 | Raw Discord API via fetch | Massive effort to implement gateway, caching, rate limiting. discord.js handles all of this. |
| Slash commands | NanoClaw trigger system | Discord slash commands | PROJECT.md explicitly marks slash commands as out of scope. NanoClaw uses its own `TRIGGER_PATTERN` system. |
| Message format | Discord Markdown + EmbedBuilder | Plain text only | Embeds provide rich formatting for notifications (bugs, tasks, progress). Discord supports up to 10 embeds per message. Use EmbedBuilder from discord.js. |

## Key Technical Details

### Gateway Intents Required

```typescript
import { Client, GatewayIntentBits, Partials } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,           // Guild/channel cache population
    GatewayIntentBits.GuildMessages,     // Receive messages in channels
    GatewayIntentBits.MessageContent,    // Read message content (PRIVILEGED)
    GatewayIntentBits.GuildMessageReactions, // Reaction handling
  ],
  partials: [
    Partials.Message,    // Handle uncached message events
    Partials.Channel,    // Handle DM channels
    Partials.Reaction,   // Handle uncached reactions
  ],
});
```

**MessageContent is a privileged intent.** Must be enabled in the Discord Developer Portal under Bot > Privileged Gateway Intents. Without it, message.content will be empty for messages not mentioning the bot.

### Guild Management API Surface

All available via discord.js v14 with Administrator permission:

| Operation | API | Notes |
|-----------|-----|-------|
| Create category | `guild.channels.create({ name, type: ChannelType.GuildCategory })` | Returns CategoryChannel |
| Create text channel | `guild.channels.create({ name, type: ChannelType.GuildText, parent })` | `parent` links to category |
| Delete channel | `channel.delete()` | Requires ManageChannels |
| Edit channel | `channel.edit({ name, topic, ... })` | Update name, topic, position |
| Set permissions | `channel.permissionOverwrites.edit(roleOrUser, { ... })` | Per-channel overrides |
| Create role | `guild.roles.create({ name, permissions, color })` | For bot-managed roles |
| Move channel | `channel.setParent(category)` | Move between categories |
| Send message | `channel.send({ content, embeds })` | Text + embeds |
| Edit message | `message.edit({ content, embeds })` | For progress tracker |
| Delete message | `message.delete()` | Cleanup |
| Add reaction | `message.react(emoji)` | Reaction support |
| Typing indicator | `channel.sendTyping()` | 10-second typing indicator |

### Bot Permission Integer

For Administrator: `8` (PermissionFlagsBits.Administrator)

Bot invite URL format:
```
https://discord.com/api/oauth2/authorize?client_id={APP_ID}&permissions=8&scope=bot
```

### Message Limits
- Message content: 2000 characters (vs Telegram's 4096)
- Embeds: up to 10 per message, 6000 total characters across all embeds
- Must chunk long messages at 2000 chars, not 4096

### JID Format

Following existing NanoClaw convention:
- Telegram: `tg:{chat_id}`
- Discord: `dc:{channel_id}` (channel ID is a snowflake string)
- Guild-level: `dc:guild:{guild_id}` (if needed for server-wide operations)

## Integration Pattern

The Discord channel must follow the exact same pattern as `TelegramChannel`:

```typescript
// Self-registration at bottom of file
registerChannel('discord', (opts: ChannelOpts) => {
  const token = process.env.DISCORD_BOT_TOKEN || readEnvFile(['DISCORD_BOT_TOKEN']).DISCORD_BOT_TOKEN || '';
  if (!token) {
    logger.warn('Discord: DISCORD_BOT_TOKEN not set');
    return null;
  }
  return new DiscordChannel(token, opts);
});
```

The `Channel` interface methods map cleanly to discord.js:

| Channel Method | discord.js Equivalent |
|---------------|----------------------|
| `connect()` | `client.login(token)` + wait for `Events.ClientReady` |
| `sendMessage(jid, text)` | `channel.send(text)` with 2000-char chunking |
| `isConnected()` | `client.isReady()` |
| `ownsJid(jid)` | `jid.startsWith('dc:')` |
| `disconnect()` | `client.destroy()` |
| `setTyping(jid)` | `channel.sendTyping()` |
| `reactToMessage(jid, msgId, emoji)` | `message.react(emoji)` |
| `sendWithButtons(jid, text, buttons)` | `ActionRowBuilder` + `ButtonBuilder` |
| `sendPhoto(jid, path, caption)` | `channel.send({ files: [path], content: caption })` |
| `editMessage(jid, msgId, text)` | `message.edit(text)` |
| `sendMessageRaw(jid, text)` | `channel.send(text)` returning `{ message_id }` |

### Additional Methods Needed (beyond Channel interface)

For server management via IPC:
```typescript
// Guild management methods (called via IPC commands from agent)
createChannel(guildId: string, name: string, categoryId?: string): Promise<string>
deleteChannel(channelId: string): Promise<void>
createCategory(guildId: string, name: string): Promise<string>
setChannelPermissions(channelId: string, overwrites: PermissionOverwrite[]): Promise<void>
```

## Environment Variables

```bash
DISCORD_BOT_TOKEN=       # Bot token from Discord Developer Portal
DISCORD_GUILD_ID=        # Target guild (server) ID -- single-server bot
```

Only two env vars needed. Guild ID pins the bot to one server (matches the private ops server use case).

## Installation

```bash
# Single dependency -- everything else is already in the project
npm install discord.js
```

No dev dependencies needed -- discord.js ships TypeScript declarations.

## Node.js Compatibility

discord.js v14 requires Node.js >= 16.11.0. The project uses Node 22.x (per the spin_yw script reference). No compatibility issues.

## Sources

- [discord.js npm](https://www.npmjs.com/package/discord.js) -- v14.25.1 confirmed
- [discord.js documentation](https://discord.js.org/docs) -- API reference
- [discord.js guide](https://discordjs.guide/) -- Tutorials and best practices
- [Discord Developer Docs - Permissions](https://discord.com/developers/docs/topics/permissions)
- [Gateway Intents Guide](https://discordjs.guide/popular-topics/intents.html)
- [npm trends: discord.js vs eris](https://npmtrends.com/discord.js-vs-eris) -- download comparison
