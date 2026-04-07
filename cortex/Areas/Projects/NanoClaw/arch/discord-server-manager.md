---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  NanoClaw Discord server manager - guild management, JID format, 2000-char
  chunking, group-to-channel mapping
project: nanoclaw
tags:
  - nanoclaw
  - discord
  - server-manager
  - channels
  - jid
  - chunking
created: 2026-03-31T00:00:00.000Z
source_hash: 111b2022c5039ab535088f7eabf617d97351e8b036c77c5fa117a9edc7bef2eb
embedding_model: text-embedding-3-small
---

# NanoClaw — Discord Server Manager

## What It Does

The `DiscordServerManager` class in `src/discord-server-manager.ts` provides programmatic guild management operations dispatched via IPC `action` messages. An agent can create categories, create or delete channels, rename channels, set permissions, and bootstrap an entire server structure in one call — all without direct Discord API access from inside the container.

Actions supported:
- `create_channel`: creates a text channel, optionally inside a category
- `create_category`: creates a category (channel group)
- `delete_channel`: deletes a channel by ID
- `rename_channel`: renames a channel by ID
- `set_permissions`: sets permission overwrites on a channel for roles/users
- `bootstrap`: creates the full server structure from a config object (categories + channels + permissions in one call)

The manager is instantiated once in the Discord channel module and passed to the IPC handler via `deps.discordServerManager`. Agents dispatch to it via IPC `discord_manage` messages.

## JID Format: `dc:{channel_id}`

Discord JIDs use the format `dc:{channel_id}` where `channel_id` is the Discord snowflake ID of the text channel. This is a 64-bit integer as a string (e.g., `dc:1234567890123456789`). The Discord channel's `ownsJid()` method checks the `dc:` prefix.

Why channel IDs rather than channel names: Discord allows duplicate channel names in different categories. The snowflake ID is globally unique and stable — channel names can be renamed without affecting the JID. The IPC system stores JIDs in registered groups, so using names would require updating registrations whenever channels are renamed.

## 2000-Character Chunking

Discord has a 2000-character limit per message. Long agent responses (code blocks, analysis, reports) frequently exceed this. The `discord-chunker.ts` module handles splitting with awareness of markdown:

Split priority order:
1. **Code fence boundary** — never split inside a code block; always split at a fence close/open boundary
2. **Paragraph boundary** — double newline (`\n\n`)
3. **Line boundary** — single newline (`\n`)
4. **Hard split** — at `maxLength` characters (last resort)

When a split occurs inside a code fence, the current chunk gets a closing ` ``` ` appended and the next chunk starts with ` ```{lang} ` to maintain proper markdown rendering in Discord.

This approach was chosen over simple character splitting because Discord renders markdown, so cutting in the middle of a code block produces broken display.

## EmbedBuilder Usage

Discord channel responses use plain text for agent messages. However, status notifications (health monitor, agent status, reconciliation results, task completion) use `EmbedBuilder` from `discord.js`. Embeds provide structured display: title, description, color, fields, timestamp, footer. They cannot be used for agent chat responses because they don't support markdown body text and don't display as part of a conversation thread.

The distinction: agent outputs → plain chunked text; system notifications → EmbedBuilder. This is why the `sendToAgents()` function takes an `EmbedBuilder`, while `sendMessage()` takes a plain string.

## How Discord Groups Map to IPC Groups

Each Discord text channel corresponds to a registered NanoClaw group with `jid = "dc:{channel_id}"`. When the Discord channel receives a message in a monitored channel, it calls `onMessage(jid, message)` with the channel's JID. The main message loop treats this identically to a Telegram message — the channel type is abstracted away by the JID prefix.

Group registration for Discord channels can happen manually (via IPC `register_group`) or via the bootstrap action (which creates channels and registers them in sequence). The `folder` name for Discord groups is typically derived from the channel name, normalized to lowercase with underscores.
