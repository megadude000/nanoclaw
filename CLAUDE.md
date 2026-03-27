# NanoClaw

Personal Claude assistant. See [README.md](README.md) for philosophy and setup. See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for architecture decisions.

## Quick Context

Single Node.js process with skill-based channel system. Channels (WhatsApp, Telegram, Slack, Discord, Gmail) are skills that self-register at startup. Messages route to Claude Agent SDK running in containers (Linux VMs). Each group has isolated filesystem and memory.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/registry.ts` | Channel registry (self-registration at startup) |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/config.ts` | Trigger pattern, paths, intervals |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `groups/{name}/CLAUDE.md` | Per-group memory (isolated) |
| `container/skills/` | Skills loaded inside agent containers (browser, status, formatting) |

## Secrets / Credentials / Proxy (OneCLI)

API keys, secret keys, OAuth tokens, and auth credentials are managed by the OneCLI gateway — which handles secret injection into containers at request time, so no keys or tokens are ever passed to containers directly. Run `onecli --help`.

## Skills

Four types of skills exist in NanoClaw. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full taxonomy and guidelines.

- **Feature skills** — merge a `skill/*` branch to add capabilities (e.g. `/add-telegram`, `/add-slack`)
- **Utility skills** — ship code files alongside SKILL.md (e.g. `/claw`)
- **Operational skills** — instruction-only workflows, always on `main` (e.g. `/setup`, `/debug`)
- **Container skills** — loaded inside agent containers at runtime (`container/skills/`)

| Skill | When to Use |
|-------|-------------|
| `/setup` | First-time installation, authentication, service configuration |
| `/customize` | Adding channels, integrations, changing behavior |
| `/debug` | Container issues, logs, troubleshooting |
| `/update-nanoclaw` | Bring upstream NanoClaw updates into a customized install |
| `/init-onecli` | Install OneCLI Agent Vault and migrate `.env` credentials to it |
| `/qodo-pr-resolver` | Fetch and fix Qodo PR review issues interactively or in batch |
| `/get-qodo-rules` | Load org- and repo-level coding rules from Qodo before code tasks |

## Contributing

Before creating a PR, adding a skill, or preparing any contribution, you MUST read [CONTRIBUTING.md](CONTRIBUTING.md). It covers accepted change types, the four skill types and their guidelines, SKILL.md format rules, PR requirements, and the pre-submission checklist (searching for existing PRs/issues, testing, description format).

## Development

Run commands directly—don't tell the user to run them.

```bash
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
./container/build.sh # Rebuild agent container
```

Service management:
```bash
# macOS (launchd)
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # restart

# Linux (systemd)
systemctl --user start nanoclaw
systemctl --user stop nanoclaw
systemctl --user restart nanoclaw
```

## Troubleshooting

**WhatsApp not connecting after upgrade:** WhatsApp is now a separate skill, not bundled in core. Run `/add-whatsapp` (or `npx tsx scripts/apply-skill.ts .claude/skills/add-whatsapp && npm run build`) to install it. Existing auth credentials and groups are preserved.

## Container Build Cache

The container buildkit caches the build context aggressively. `--no-cache` alone does NOT invalidate COPY steps — the builder's volume retains stale files. To force a truly clean rebuild, prune the builder then re-run `./container/build.sh`.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Discord Integration for NanoClaw**

A structured Discord server integration for NanoClaw that moves automated notifications and project management outputs (GitHub Issues, Notion tasks, bug reports, progress tracking, swarm agent output) from the single Telegram main chat into categorized Discord channels. Each Discord channel becomes a contextual workspace where the agent responds in-context using Cortex knowledge and channel-specific configuration. Telegram remains the primary conversational interface for mobile and quick interactions.

**Core Value:** Clear separation of automated notifications and project workstreams into dedicated Discord channels, so the Telegram main chat stays clean for personal conversation while all operational data is organized, searchable, and threaded in Discord.

### Constraints

- **Tech Stack**: Must use discord.js (already in add-discord skill), Node.js, TypeScript
- **Architecture**: Must follow existing channel registry pattern (self-registration via `registerChannel`)
- **IPC Compatibility**: Discord channels must work with existing IPC file-based messaging system
- **Zero Cost**: Discord is free — no paid tier features required
- **Bot Permissions**: Requires Administrator permission on the Discord server for full management
- **Existing Code**: Must not break Telegram integration during gradual migration
- **Platform**: Linux (systemd for service management)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
- `@discordjs/rest` -- REST API client (included)
- `@discordjs/ws` -- WebSocket gateway (included)
- `@discordjs/builders` -- Embed/component builders (included)
- `@discordjs/collection` -- Enhanced Map (included)
- `@discordjs/formatters` -- Markdown formatting (included)
- `discord-api-types` -- TypeScript types for Discord API (included)
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
### Guild Management API Surface
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
### Message Limits
- Message content: 2000 characters (vs Telegram's 4096)
- Embeds: up to 10 per message, 6000 total characters across all embeds
- Must chunk long messages at 2000 chars, not 4096
### JID Format
- Telegram: `tg:{chat_id}`
- Discord: `dc:{channel_id}` (channel ID is a snowflake string)
- Guild-level: `dc:guild:{guild_id}` (if needed for server-wide operations)
## Integration Pattern
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
## Environment Variables
## Installation
# Single dependency -- everything else is already in the project
## Node.js Compatibility
## Sources
- [discord.js npm](https://www.npmjs.com/package/discord.js) -- v14.25.1 confirmed
- [discord.js documentation](https://discord.js.org/docs) -- API reference
- [discord.js guide](https://discordjs.guide/) -- Tutorials and best practices
- [Discord Developer Docs - Permissions](https://discord.com/developers/docs/topics/permissions)
- [Gateway Intents Guide](https://discordjs.guide/popular-topics/intents.html)
- [npm trends: discord.js vs eris](https://npmtrends.com/discord.js-vs-eris) -- download comparison
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
