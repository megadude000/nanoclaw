# Feature Landscape: Discord Ops Dashboard for NanoClaw

**Domain:** Private ops server bot with server management, webhook routing, and contextual AI responses
**Researched:** 2026-03-26

## Table Stakes

Features the Discord integration must have or it adds no value over the current Telegram-only setup.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Text message send/receive | Core channel functionality -- minimum viable integration | Low | Map to existing `Channel` interface; existing add-discord skill covers basics |
| Channel self-registration | NanoClaw architecture requirement -- all channels register at startup | Low | `registerChannel('discord', factory)` pattern from Telegram/Gmail |
| Per-channel group registration (`dc:<channelId>`) | Each Discord channel maps to a NanoClaw group with its own CLAUDE.md | Low | JID format already defined; follows `tg:` pattern |
| Message chunking at 2000 chars | Discord hard limit on message length (vs 4096 in Telegram) | Low | Already handled in existing add-discord skill |
| Typing indicator | Users expect feedback while agent processes | Low | `channel.sendTyping()` every 10s; already in add-discord skill |
| Reconnection handling | Discord gateway drops connections periodically | Low | discord.js handles reconnect automatically; add `shardDisconnect`/`shardReconnecting` event logging |
| Trigger pattern support | Non-main channels need @mention or trigger to invoke agent | Low | Existing NanoClaw pattern; Discord @mention maps to `TRIGGER_PATTERN` |
| Reply context | Users need to reference previous messages | Low | Discord reply API straightforward; parse `message.reference` |
| Attachment handling | Bug reports, screenshots, file sharing | Low | Describe attachments as text (existing pattern) + `channel.send({ files: [...] })` for outbound |
| Webhook routing to Discord channels | Core value proposition -- move GitHub/Notion/bug notifications out of Telegram | Medium | Currently all webhooks hardcoded to `mainJid`; needs configurable routing map |
| Embed formatting for notifications | Notifications need structured display, not raw text dumps | Medium | `EmbedBuilder` for rich formatting; color-coded by type, fields for metadata |

## Differentiators

Features that make this more than "just another channel" -- these turn Discord into an actual ops dashboard.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Programmatic server structure management | Agent creates/deletes channels, categories, sets permissions via IPC -- no manual Discord setup | Medium | Requires Administrator permission; `guild.channels.create()` with `ChannelType.GuildCategory` and parent options |
| Contextual per-channel CLAUDE.md | Agent responds differently per channel -- bug-triage in #bugs, project-management in #yw-tasks | Low | Each registered group gets themed CLAUDE.md referencing Cortex knowledge sections |
| Configurable dual-send routing | During migration, notifications go to Telegram, Discord, or both; per webhook type | Medium | Routing config: `{ github: "discord", notion: "both", bugreport: "telegram" }` |
| Progress tracker with message editing | Live-updating progress messages in `#progress` channel | Medium | `message.edit()` maps to existing optional `editMessage` on Channel interface |
| Swarm bot identities via webhooks | Friday and Alfred post with their own names/avatars, not as the main bot | Medium | Discord webhooks allow custom `username` + `avatar_url` per message; PluralKit pattern but self-hosted |
| Category-based channel auto-setup | Auto-create entire server structure (General, YourWave, Dev, Admin) programmatically | Low | `guild.channels.create({ type: ChannelType.GuildCategory })` then children with `parent` option |
| Permission-scoped channels | #bot-control restricted to admin role; #logs read-only for most users | Medium | Channel permission overwrites via `channel.permissionOverwrites.create()` |
| Auto-threading for notifications | Each GitHub issue or Notion task creates a thread under its notification | Medium | `message.startThread()` after posting; thread name = issue title; keeps channels clean |
| Server management via IPC commands | Agent restructures Discord server from within container via file-based IPC | High | New IPC command types: `discord:create-channel`, `discord:set-permissions`, etc. |
| Button interactions | Inline buttons for confirmations, choices on notifications | Low | `ActionRowBuilder` + `ButtonBuilder`; map to existing `sendWithButtons` interface |
| Reaction-as-input | User reactions on Discord messages become agent input | Low | `messageReactionAdd` event; same pattern as Telegram reaction handling |

## Anti-Features

Features to deliberately NOT build. These add complexity without value for a private ops server.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Discord slash commands | NanoClaw has its own trigger pattern system; slash commands create parallel UX, require Discord API registration, and break channel-agnostic design | Use `TRIGGER_PATTERN` (e.g., `@Andy`) consistently across all channels |
| Voice channel support | Out of scope per PROJECT.md; no ops dashboard use case for voice | Skip entirely |
| Public server features (verification, welcome, leveling) | Private 1-person ops server, not a community; multi-guild patterns add unnecessary complexity | Pin to single guild via `DISCORD_GUILD_ID` |
| Direct Discord webhook endpoints for external services | Bypasses NanoClaw routing, loses agent context and formatting control | Route everything through NanoClaw webhook server, then format and route to Discord |
| Discord-specific formatting in agent output | Agent output should be channel-agnostic; formatting is the adapter's job | Format in the Discord channel adapter layer, not in agent prompts or CLAUDE.md |
| Web dashboard for bot configuration | Over-engineered for single-user private server; config lives in `.env` and CLAUDE.md files | Edit config files directly or via agent IPC commands |
| Auto-moderation / anti-spam | Private server with one human user -- no moderation needed | Skip entirely |
| Reaction-based role assignment | Community server pattern irrelevant to private ops | Skip entirely |
| Music / entertainment / gamification | Irrelevant to ops dashboard use case | Skip entirely |

## Feature Dependencies

```
Channel self-registration (base)
  -> Text message send/receive
    -> All messaging features (replies, attachments, chunking)
    -> Message editing (editMessage)
      -> Progress tracker routing to Discord
    -> Embed formatting
      -> Webhook routing to Discord channels
        -> Configurable dual-send routing
          -> Gradual migration controls
    -> Auto-threading for notifications
    -> Button interactions
    -> Reaction-as-input

Channel self-registration (base)
  -> Per-channel group registration
    -> Contextual per-channel CLAUDE.md

Channel self-registration (base)
  -> Programmatic server structure management
    -> Category-based channel auto-setup
    -> Permission-scoped channels
    -> Server management via IPC commands

Swarm bot identities (independent path)
  -- requires: Discord webhook creation API (per-channel)
  -- no dependency on bot channel registration (webhooks are separate from bot user)
```

## MVP Recommendation

**Prioritize (Phase 1-3):**

1. **Channel self-registration + connect/disconnect lifecycle** -- foundation everything builds on
2. **Text message send/receive with 2000-char chunking** -- basic channel functionality
3. **Per-channel group registration with contextual CLAUDE.md** -- the core differentiation (contextual responses)
4. **Webhook routing to Discord channels with embed formatting** -- primary value proposition (declutter Telegram)
5. **Message editing for progress tracker** -- needed for live status updates in #progress

**Phase 4-6:**

6. **Programmatic server structure management** -- agent can create/modify channels and categories
7. **Category-based auto-setup + permissions** -- automated server provisioning
8. **Configurable dual-send routing** -- safety net for gradual migration from Telegram
9. **Auto-threading for notifications** -- keeps notification channels clean over time

**Defer (Phase 7+):**

10. **Swarm bot identities via webhooks** -- nice-to-have; main bot identity works initially
11. **Server management via IPC** -- powerful but complex; manual Discord management works at first
12. **Button interactions + reaction-as-input** -- polish features, not blocking core value

**Deferral rationale:**
- Swarm bots need design decision on webhooks vs bot pool (Telegram uses bot pool tokens; Discord alternative is per-channel webhooks with custom name/avatar)
- IPC-based server management is the most complex feature and requires new IPC command types; manual channel creation in Discord UI is fast enough initially
- Dual-send only matters once core Discord routing works; build Discord-first, add dual-send as routing config later

## Sources

- [Discord Developer Docs - Permissions](https://discord.com/developers/docs/topics/permissions)
- [discord.js Permissions Guide](https://discordjs.guide/legacy/popular-topics/permissions)
- [discord.js CategoryChannel API](https://discord.js.org/docs/packages/discord.js/main/CategoryChannel:Class)
- [Creating Categories in Discord.js V14](https://www.theyurig.com/blog/how-create-categories-discord-v14)
- [Creating Text Channels in Discord.js V14](https://www.theyurig.com/blog/how-create-text-channels-discord-v14)
- [Discord Intro to Webhooks](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)
- [PluralKit - Multiple Identities via Webhooks](https://pluralkit.me/)
- [Needle - Auto-threading Bot](https://needle.gg/)
- [Discord Bot Permissions and Intents 2025](https://friendify.net/blog/discord-bot-permissions-and-intents-explained-2025.html)
- [GitHub-Discord Webhook Integration](https://gist.github.com/jagrosh/5b1761213e33fc5b54ec7f6379034a22)
- NanoClaw codebase: `src/channels/telegram.ts`, `src/channels/index.ts`, `src/ipc.ts`, webhook handlers, `.claude/skills/add-discord/SKILL.md`
