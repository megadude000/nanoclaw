# Project Research Summary

**Project:** Discord Integration for NanoClaw
**Domain:** Multi-channel bot system -- adding Discord as ops dashboard alongside existing Telegram
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

This project adds Discord as a peer channel to NanoClaw's existing multi-channel architecture (Telegram, Gmail). The integration follows a well-established pattern: discord.js v14 is the only serious Node.js Discord library (347K weekly downloads, first-class TypeScript), and NanoClaw's self-registering channel architecture means Discord slots in as another `Channel` implementation with a `dc:` JID prefix. The existing `add-discord` skill already covers basic connectivity; this project extends it into a full ops dashboard with server management, webhook routing, and per-channel contextual AI responses.

The recommended approach is incremental: start with the basic `DiscordChannel` class implementing the existing `Channel` interface, then layer on Discord-specific capabilities (embeds, server management, webhook routing) in later phases. The single new dependency is `discord.js` -- everything else (TypeScript, pino, better-sqlite3, zod) is already in the project. Discord's channel-per-topic model maps naturally to NanoClaw's group-per-JID model, making each Discord channel an independent agent context with its own CLAUDE.md.

The primary risks are (1) silent message loss from misconfigured Gateway Intents (bot appears online but receives nothing), (2) hardcoded `mainJid` routing in all webhook handlers preventing notifications from reaching Discord channels, and (3) message edit rate limits breaking the progress tracker. All three are well-understood and preventable with early design decisions: validate intents at startup, build a routing abstraction before wiring webhooks, and buffer progress updates to stay under Discord's edit rate limits.

## Key Findings

### Recommended Stack

Single new dependency: `discord.js ^14.25.1`. It bundles REST client, WebSocket gateway, embed builders, and TypeScript types. No additional packages needed. All supporting libraries (TypeScript, pino, better-sqlite3, zod) are already in the project.

**Core technologies:**
- **discord.js v14**: Discord API client -- de facto standard, no viable alternative in Node.js ecosystem
- **Gateway Intents**: Must declare `Guilds`, `GuildMessages`, `MessageContent` (privileged), `GuildMessageReactions`
- **EmbedBuilder**: Rich formatted notifications -- color-coded by type (bugs=red, tasks=blue, progress=green)

**Critical requirement:** `MessageContent` privileged intent must be enabled in Discord Developer Portal before first deploy, or bot silently receives empty message content.

### Expected Features

**Must have (table stakes):**
- Text message send/receive with 2000-char chunking
- Channel self-registration via `registerChannel('discord', factory)`
- Per-channel group registration (`dc:{guildId}:{channelId}`)
- Typing indicator, reconnection handling, trigger pattern support
- Webhook routing to Discord channels with embed formatting

**Should have (differentiators):**
- Programmatic server structure management (create channels/categories via IPC)
- Per-channel contextual CLAUDE.md (bug-triage mode in #bugs, project-management in #yw-tasks)
- Configurable dual-send routing for gradual Telegram-to-Discord migration
- Progress tracker with live message editing in #progress
- Auto-threading for notifications (each GitHub issue gets its own thread)

**Defer (v2+):**
- Swarm bot identities via Discord webhooks (Friday/Alfred custom names/avatars)
- Full server management via IPC commands (manual Discord UI is fast enough initially)
- Button interactions and reaction-as-input (polish features)

**Anti-features (do NOT build):** Slash commands, voice support, public server features, web dashboard, auto-moderation.

### Architecture Approach

Discord integrates as a peer channel following the self-registration pattern. `DiscordChannel` class implements the `Channel` interface, owns all `dc:` JIDs, and includes an internal `DiscordServerManager` for guild operations. Webhook routing needs a new configurable routing table to replace the hardcoded `mainJid` pattern. One NanoClaw group per Discord channel (not per server) -- this is the key architectural decision that enables contextual responses.

**Major components:**
1. **DiscordChannel** (`src/channels/discord.ts`) -- Gateway connection, message I/O, JID ownership for `dc:*`
2. **Webhook Routing Table** (`data/webhook-routing.json`) -- Maps event types to target JID arrays, enables dual-send
3. **DiscordServerManager** (internal to discord.ts) -- Channel/category CRUD, permissions, called via IPC
4. **Per-channel CLAUDE.md** (`groups/dc-*/CLAUDE.md`) -- Contextual agent behavior per Discord channel

### Critical Pitfalls

1. **Silent deafness from missing Gateway Intents** -- Validate intents at startup; write an echo test before building anything else. Must enable `MessageContent` privileged intent in Developer Portal.
2. **Hardcoded mainJid in webhook handlers** -- Build a routing abstraction layer that wraps existing handlers. Do NOT modify webhook handlers inline. This is the number one migration blocker.
3. **Message edit rate limits breaking progress tracker** -- Buffer updates for 2-3 seconds before editing. Use discord.js built-in rate limit handler. Test with synthetic rapid-fire edits.
4. **Channel name vs ID confusion in JIDs** -- ALWAYS use snowflake IDs in JIDs (`dc:1234567890123456`), never channel names. Names are mutable; IDs are permanent.
5. **Gateway disconnection causing silent message loss** -- Track last processed message ID per channel in SQLite. After reconnect, fetch recent history to catch missed messages.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Discord Channel Foundation
**Rationale:** Nothing works without basic connectivity and the Channel interface implementation.
**Delivers:** DiscordChannel class with connect/disconnect, sendMessage with 2000-char chunking, JID ownership, self-registration.
**Addresses:** Channel self-registration, text send/receive, message chunking (table stakes).
**Avoids:** Missing intents (P1) via startup validation; snowflake-only JIDs from day one (P4); event handler leak prevention (P10); string-type snowflake IDs (P12).

### Phase 2: Inbound Message Handling
**Rationale:** Must receive and process messages before building anything interactive.
**Delivers:** messageCreate handler, @mention-to-trigger translation, group registration for Discord channels, reconnection resilience with gap recovery.
**Addresses:** Trigger pattern support, reply context, attachment handling, per-channel group registration.
**Avoids:** Gateway disconnect message loss (P5) via last-message-ID tracking; Markdown format mismatch (P6) via format adapter; token exposure in CLAUDE.md (P11).

### Phase 3: Outbound Formatting and Progress Tracker
**Rationale:** Outbound messaging with embeds is needed before webhook routing makes sense, and progress tracker needs editMessage support.
**Delivers:** EmbedBuilder formatting for notifications, sendMessageRaw/editMessage/deleteMessage, typing indicator with 10-sec refresh.
**Addresses:** Embed formatting, message editing for progress tracker, typing indicator.
**Avoids:** Edit rate limits (P3) via buffered updates with 2-3 sec consolidation.

### Phase 4: Webhook Routing Architecture
**Rationale:** The routing abstraction must exist before individual webhooks can target Discord channels. This is the critical migration enabler.
**Delivers:** Configurable routing table (`webhook-routing.json`), routing layer wrapping existing webhook handlers, dual-send support.
**Addresses:** Webhook routing to Discord, configurable dual-send routing.
**Avoids:** Hardcoded mainJid (P2) by design; IPC auth model conflicts (P8) by routing through the router layer rather than cross-group IPC; dual-send deduplication (P9) via one-platform-authoritative rule.

### Phase 5: Server Structure Management
**Rationale:** Programmatic server setup enables automated provisioning and is needed for channels that do not exist yet.
**Delivers:** IPC handlers for discord_manage commands (create channel, delete channel, create category, set permissions), bootstrap script for initial server structure.
**Addresses:** Programmatic server management, category-based auto-setup, permission-scoped channels.
**Avoids:** Category/channel creation race conditions (P15) via sequential creation with awaits.

### Phase 6: Per-Channel Context and Migration Controls
**Rationale:** With server structure and routing in place, add the contextual intelligence layer and finalize migration.
**Delivers:** Channel-specific CLAUDE.md files with behavioral context, dual-send toggle per webhook type, Telegram notification disable per type.
**Addresses:** Contextual per-channel CLAUDE.md, migration controls, auto-threading for notifications.

### Phase 7: Swarm Bot Identity and Polish
**Rationale:** Nice-to-have features that build on everything above. Main bot identity works fine until this point.
**Delivers:** Discord webhook-based bot identities (Friday/Alfred), button interactions, reaction-as-input.
**Addresses:** Swarm bot identities, button interactions, reaction-as-input.
**Avoids:** Bot rename approach (P14) by using per-channel webhooks with custom name/avatar.

### Phase Ordering Rationale

- Phases 1-2 are strict prerequisites: no messaging capability means nothing else works.
- Phase 3 before 4: outbound formatting is needed for webhook notification display.
- Phase 4 before 5: routing must exist before creating channels that webhooks target.
- Phase 5 before 6: server structure must exist before per-channel CLAUDE.md makes sense.
- Phase 7 is purely additive polish with no downstream dependencies.
- The dependency chain reflects both the architecture (components build on each other) and the pitfall mitigation order (routing abstraction early prevents the hardcoded-mainJid trap).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Webhook Routing):** Requires understanding current webhook handler internals to design the routing layer without breaking existing Telegram delivery. Examine exact `mainJid` lookup patterns in all three webhook files.
- **Phase 5 (Server Management):** IPC extension design needs careful consideration of authorization model and response format. Research the existing IPC message schema.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** discord.js documentation is excellent; Channel interface is well-defined in codebase.
- **Phase 2 (Inbound Messages):** Direct mirror of TelegramChannel pattern; well-documented.
- **Phase 3 (Outbound/Embeds):** EmbedBuilder has extensive documentation and examples.
- **Phase 7 (Swarm/Polish):** Discord webhooks are straightforward; PluralKit proves the pattern works.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | discord.js v14 is the only viable choice; npm stats, docs, and community all confirm |
| Features | HIGH | Derived from NanoClaw source code analysis and Discord API capabilities; anti-features clearly scoped |
| Architecture | HIGH | Mirrors existing TelegramChannel pattern; component boundaries follow established NanoClaw conventions |
| Pitfalls | HIGH | Verified against Discord API docs, discord.js guide, and NanoClaw source code analysis |

**Overall confidence:** HIGH

### Gaps to Address

- **Webhook routing implementation details:** Current webhook handlers need source-level review during Phase 4 planning to determine exact refactoring approach (wrapper vs inline modification).
- **IPC message schema extension:** New `discord_manage` IPC types need schema validation design. Existing IPC types should be audited for extensibility.
- **Gap recovery after disconnect:** The `channel.messages.fetch()` approach for catching missed messages needs load testing -- fetching history for many channels simultaneously after a reconnect could hit rate limits.
- **Dual-send deduplication edge cases:** The "one platform authoritative" rule is simple but may frustrate users who naturally respond in Discord. Need a clear UX decision during Phase 4 planning.

## Sources

### Primary (HIGH confidence)
- [discord.js npm](https://www.npmjs.com/package/discord.js) -- v14.25.1, download stats, dependency tree
- [discord.js documentation](https://discord.js.org/docs) -- Full API reference for v14
- [discord.js guide](https://discordjs.guide/) -- Intents, permissions, common errors, best practices
- [Discord Developer Docs](https://docs.discord.com/developers/) -- Gateway, rate limits, permissions, webhooks
- NanoClaw source code -- `src/channels/telegram.ts`, `src/channels/registry.ts`, `src/types.ts`, `src/ipc.ts`, `src/github-issues-webhook.ts`, `src/notion-webhook.ts`, `src/progress-tracker.ts`

### Secondary (MEDIUM confidence)
- [npm trends: discord.js vs eris](https://npmtrends.com/discord.js-vs-eris) -- Library comparison
- [PluralKit](https://pluralkit.me/) -- Webhook-based identity pattern validation
- [Needle](https://needle.gg/) -- Auto-threading pattern reference

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
