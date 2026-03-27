# Discord Integration for NanoClaw

## Current Milestone: v2.0 Agent Dashboard

**Goal:** Make #agents a live operational dashboard where agents report status, blockers, handoffs, and health alerts — keeping Telegram main chat clean for personal conversation.

**Target features:**
- Task status reporting: agents post "took #9" / "closed #9, PR #12" to #agents
- Blocker reporting: agent reports when blocked (no permissions, service down, conflict)
- Handoffs: structured handoff messages between Friday/Alfred (e.g. "passing to Alfred — service X down, needs restart")
- Morning Digest routing: nightly summary goes to #agents instead of main chat
- Health alerts: Alfred monitors tunnels/services and posts to #agents

## What This Is

A structured Discord server integration for NanoClaw that moves automated notifications and project management outputs (GitHub Issues, Notion tasks, bug reports, progress tracking, swarm agent output) from the single Telegram main chat into categorized Discord channels. Each Discord channel becomes a contextual workspace where the agent responds in-context using Cortex knowledge and channel-specific configuration. Telegram remains the primary conversational interface for mobile and quick interactions.

## Core Value

Clear separation of automated notifications and project workstreams into dedicated Discord channels, so the Telegram main chat stays clean for personal conversation while all operational data is organized, searchable, and threaded in Discord.

## Requirements

### Validated

- Channel registry system with self-registration at startup — existing
- IPC message routing between groups via file-based watcher — existing
- Telegram integration with swarm bot pool (Friday/Alfred) — existing
- GitHub Issues webhook routing to main chat — existing
- Notion webhook routing to main chat — existing
- Progress tracker with live message editing — existing
- Task scheduler with per-group targeting — existing
- Cortex/Obsidian knowledge base for agent context — existing
- Discord bot foundation: connect, send/receive, channel registry — Validated in Phase 1
- Discord inbound message handling: trigger detection, reply context with preview, attachment metadata — Validated in Phase 2
- Discord outbound formatting: rich embeds, markdown-aware chunking, editMessage, sendWithButtons + callbacks, sendPhoto, cross-channel error feedback — Validated in Phase 3
- Discord group registration: auto-registration on first message, human-readable folder naming, DISCORD_MAIN_CHANNEL_ID env var, IPC authorization for Discord JIDs — Validated in Phase 4

### Active

- [ ] Discord bot with full server admin capabilities (create/delete channels, categories, permissions)
- [ ] Contextual agent responses — agent responds in-theme per channel using Cortex knowledge
- [ ] GitHub Issues webhook routable to Discord `#bugs` channel
- [ ] Notion webhook routable to Discord `#yw-tasks` channel
- [ ] Progress tracker routable to Discord `#progress` channel
- [ ] Dev/CI notifications to Discord `#dev-alerts` channel
- [ ] Swarm bot presence in Discord (Friday/Alfred post with their identities)
- [ ] Server management via IPC commands (create channels, set permissions from agent)
- [ ] Gradual migration support — dual-send to both Telegram and Discord during transition
- [ ] Configurable routing per webhook/notification — target Telegram, Discord, or both
- [ ] Discord message handling (text, attachments, replies, threads, reactions)

### Out of Scope

- Replacing Telegram as primary conversational interface — Telegram stays for mobile/quick interactions
- Voice channel support in Discord — not needed for ops dashboard use case
- Discord slash commands — NanoClaw uses its own trigger pattern system
- Public Discord server — this is a private ops server
- Discord webhook endpoints for external services — route through NanoClaw, not directly

## Context

**Current Architecture:**
- Single registered group: `tg:633706070` (personal Telegram chat, main, no trigger required)
- All webhooks (GitHub Issues, Notion, bug reports) route to `mainJid` in Telegram
- Swarm bots Friday and Alfred are Telegram bot pool members
- Existing `add-discord` skill provides base Discord channel integration (discord.js, self-registration)
- Channel system uses JID format: `tg:`, `dc:`, `wa:`, `gm:` prefixes
- IPC authorization: main group can send to all groups; non-main groups can only send to own JID

**Target Discord Server Structure:**
```
Andy HQ (server)
+-- General
|   +-- #main          (conversational, backup to Telegram)
|   +-- #agents        (Friday/Alfred swarm output)
+-- YourWave
|   +-- #yw-tasks      (Notion webhook -> task updates)
|   +-- #bugs          (GitHub Issues webhook -> bug reports)
|   +-- #progress      (Progress tracker output)
+-- Dev
|   +-- #dev-alerts    (CI/build/deploy notifications)
|   +-- #logs          (System logs, container events)
+-- Admin
    +-- #bot-control   (Server management commands)
```

**Key Insight:** Discord bot with Administrator permission can programmatically manage the entire server — no SSH or manual config needed. The agent can restructure the server via IPC commands.

**Cortex Integration:** Each Discord channel gets a channel-specific CLAUDE.md that instructs the agent on the channel's theme and available Cortex knowledge sections. When a user writes in `#bugs`, the agent responds in bug-triage mode. When in `#yw-tasks`, it responds in project management mode.

## Constraints

- **Tech Stack**: Must use discord.js (already in add-discord skill), Node.js, TypeScript
- **Architecture**: Must follow existing channel registry pattern (self-registration via `registerChannel`)
- **IPC Compatibility**: Discord channels must work with existing IPC file-based messaging system
- **Zero Cost**: Discord is free — no paid tier features required
- **Bot Permissions**: Requires Administrator permission on the Discord server for full management
- **Existing Code**: Must not break Telegram integration during gradual migration
- **Platform**: Linux (systemd for service management)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full server admin bot | User wants programmatic server management (channels, categories, permissions) | -- Pending |
| Gradual migration | Dual-send during transition, disable Telegram notifications one by one | -- Pending |
| Contextual channel responses | Each channel has themed CLAUDE.md + Cortex knowledge sections | -- Pending |
| Quality model profile | User chose Opus for research/roadmap agents | -- Pending |
| Fine granularity | 8-12 phases for careful, detailed implementation | -- Pending |
| Swarm bots in Discord | Friday/Alfred get Discord presence alongside Telegram | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 — Milestone v2.0 Agent Dashboard started*
