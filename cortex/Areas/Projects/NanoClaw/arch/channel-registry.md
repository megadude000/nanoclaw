---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  NanoClaw channel self-registration system - registerChannel pattern, Channel
  interface, JID formats
project: nanoclaw
tags:
  - nanoclaw
  - channels
  - registry
  - jid
  - telegram
  - discord
  - whatsapp
created: 2026-03-31T00:00:00.000Z
source_hash: 7a8efae3ed6d1976484d79cfb2699dd780bd6e5235733bb9a6316639b653c156
embedding_model: text-embedding-3-small
---

# NanoClaw — Channel Registry

## Why Self-Registration Over Explicit List

NanoClaw uses a self-registration pattern for channels rather than a central explicit list. Each channel module calls `registerChannel(name, factory)` when it is imported, and the barrel file `src/channels/index.ts` imports all channel modules. This means:
- Adding a new channel requires only creating the module and adding a single import to index.ts
- Channels that aren't installed (e.g., WhatsApp's `@whiskeysockets/baileys` is optional) fail gracefully — the import is wrapped in a `.catch()` so a missing optional channel doesn't crash the startup
- Channel configuration (tokens, bot IDs) is checked at factory time — if the required config is absent, the factory returns `null` and the channel is not instantiated

The alternative (an explicit array in index.ts) would require updating two places when adding a channel and wouldn't give channels the ability to self-describe their startup requirements.

## Channel Interface Contract

Every channel implements the `Channel` interface from `src/types.ts`:

```typescript
interface Channel {
  ownsJid(jid: string): boolean       // Does this channel handle this JID?
  isConnected(): boolean               // Is the connection currently live?
  sendMessage(jid: string, text: string): Promise<void>
  setTyping?(jid: string, on: boolean): Promise<void>  // optional
  reactToMessage?(jid: string, messageId: string, emoji: string): Promise<void>  // optional
  sendWithButtons?(jid, text, buttons, rowSize?): Promise<void>  // optional
  sendPhoto?(jid, photoPath, caption?): Promise<void>  // optional
}
```

The `ownsJid()` method is how the router determines which channel to use for outbound messages. Each channel's implementation checks the JID prefix.

## JID Format Per Channel

JIDs (Jabber IDs, repurposed as NanoClaw's universal address format) use a prefix scheme:
- **Telegram:** `tg:{chat_id}` — e.g., `tg:123456789` (private) or `tg:-100123456789` (group)
- **Discord:** `dc:{channel_id}` — e.g., `dc:1234567890123456789`
- **WhatsApp:** `wa:{phone}@s.whatsapp.net` or `wa:{groupid}@g.us`
- **Gmail:** `gmail:{email_address}`

This prefix scheme enables the router and IPC system to handle cross-channel message delivery without knowing which specific channel instance is active. `ownsJid('tg:123')` returns true only in the Telegram channel.

## Channel Factory Pattern

The registry stores `ChannelFactory` functions, not `Channel` instances. A factory takes `ChannelOpts` (shared deps: `onMessage`, `onChatMetadata`, `registeredGroups`, `registerGroup`, `onCriticalCommand`) and returns either a `Channel` or `null`. This deferred instantiation means:
- Channels can check environment variables and return null if not configured (Discord token missing → return null)
- Main loop iterates `getRegisteredChannelNames()`, attempts to create each factory with the shared opts, filters out nulls
- Failed channels don't prevent other channels from starting

## Discord Server Manager Integration

Discord channels have an extended capability: `discordServerManager`. This handles guild management operations (create/update categories, channels, set permissions) dispatched via the `action` IPC type. The Discord channel is the only one with structured guild management because Discord's server structure is hierarchical (server → categories → channels) and needs programmatic management for the group-as-channel model.
