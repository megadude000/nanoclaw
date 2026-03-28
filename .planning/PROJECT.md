# NanoClaw — Agent Intelligence Platform

## Current Milestone: v3.0 Agent Cortex Intelligence

**Goal:** Build a bullet-fast queryable knowledge layer so agents can retrieve surgically scoped context before every task — closing the "decision shadow" problem where agents see what code does but not why decisions were made.

**Target features:**
- Cortex schema: YAML frontmatter standard, L10-L50 knowledge pyramid adapted to NanoClaw ecosystem
- Qdrant: local Docker container, `cortex-entries` collection, embedding pipeline with 4-step reconciliation
- Cortex MCP tools: `cortex_search`, `cortex_read`, `cortex_write` available inside container agents
- cortex-graph.json: explicit edges (BUILT_FROM, REFERENCES, BLOCKS, CROSS_LINK)
- Lore Protocol: adopt Ian's CLI for git trailer knowledge atoms (Constraint/Rejected/Directive)
- Nightshift reconciliation: Alfred runs nightly staleness cascade, CROSS_LINK discovery, orphan cleanup
- Knowledge bootstrap: L10-L20 population for NanoClaw (src/), YourWave (YW_Core), Night Shift system, Content Factory
- Agent integration: container CLAUDE.md wiring so agents auto-query Cortex at task start

---

## Previous: v2.0 Shipped (2026-03-28)

Both v1.0 and v2.0 are complete. The Discord integration is fully operational:

**v1.0 (Phases 1-8):** Full Discord channel — bot, inbound/outbound messaging, group registration, server management, webhook routing, swarm bot presence, channel templates.

**v2.0 (Phases 9-13):** Agent Dashboard — #agents is a live operational dashboard with structured status reports, blocker alerts, handoffs, morning digest routing, and #logs health monitoring.

**Next:** v3.0 (to be defined — candidate directions: Agent Cortex Intelligence, channel history search, expanded operational coverage).

---

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
- Discord server management: DiscordServerManager with 5 CRUD actions, IPC wiring with main-only authorization — Validated in Phase 5
- Webhook routing: discord-routing.json config, Zod validation, mainJid fallback, task ID @jid suffix for dual-send uniqueness — Validated in Phase 6
- Swarm bot presence: SwarmWebhookManager, NanoClaw- prefix naming, Dicebear avatars, lazy webhook hydration — Validated in Phase 7
- Channel templates: 8 themed CLAUDE.md templates with Cortex knowledge references, loaded via createGroupStub() — Validated in Phase 8
- Agent message schema: withAgentMeta, AGENT_COLORS, AgentMessageType — typed metadata for all agent embeds — Validated in Phase 9
- Agent status reporting: buildTookEmbed/buildClosedEmbed/buildProgressEmbed builders, Channel.sendEmbed, DiscordChannel.sendEmbed; scheduled tasks auto-post took/closed to #agents; container agents call report_agent_status MCP tool; NANOCLAW_ASSISTANT_NAME forwarded — Validated in Phase 10
- Blocker & handoff reporting: buildBlockerEmbed/buildHandoffEmbed, report_blocker/report_handoff MCP tools, IPC handlers on host — Validated in Phase 11
- Morning Digest routing: routing_tag column on scheduled_tasks, resolveTargets() wiring in task-scheduler.ts, config/routing.json morning-digest entry, Telegram suppressed when routed — Validated in Phase 12
- Health monitoring: startHealthMonitor polling loop, buildDownEmbed/buildUpEmbed/buildHeartbeatEmbed, state persistence to data/health-state.json, startup spam suppression, systemctl --user for app services / system-level for cloudflared, wired to #logs via sendEmbed — Validated in Phase 13

### Active (Candidates for v3.0)

- [ ] Agent can query #agents message history via IPC command (SEARCH-02 — deferred from v2.0)
- [ ] #agents serves as persistent activity log — messages never deleted (SEARCH-03 — deferred from v2.0)
- [ ] Bidirectional handoff acknowledgement — receiving agent confirms pickup
- [ ] #logs query capability (same as SEARCH-02 but for #logs)
- [ ] Cross-channel activity summary (daily digest of #agents + #logs)

### Out of Scope

- Replacing Telegram as primary conversational interface — Telegram stays for mobile/quick interactions
- Voice channel support in Discord — not needed for ops dashboard use case
- Discord slash commands — NanoClaw uses its own trigger pattern system
- Public Discord server — this is a private ops server
- Discord webhook endpoints for external services — route through NanoClaw, not directly
- Health alerts in #agents — health monitoring routes to #logs only

## Context

**Current Architecture (post v2.0):**
- Discord is fully wired: inbound, outbound, group registration, server management, webhook routing, swarm bots, channel templates
- #agents receives: took/closed/progress embeds, blocker alerts, handoffs, morning digest
- #logs receives: health monitoring alerts (down/up/heartbeat) from host-side poller
- Telegram: remains primary conversational interface (personal chat)
- Swarm bots Friday and Alfred: Telegram + Discord presence
- Channel system JID format: `tg:`, `dc:`, `wa:`, `gm:` prefixes
- IPC authorization: main group can send to all groups; non-main groups can only send to own JID

**Discord Server Structure (as deployed):**
```
Andy HQ (server)
+-- General
|   +-- #main          (conversational, backup to Telegram)
|   +-- #agents        (Friday/Alfred swarm output — live dashboard)
+-- YourWave
|   +-- #yw-tasks      (Notion webhook -> task updates)
|   +-- #bugs          (GitHub Issues webhook -> bug reports)
|   +-- #progress      (Progress tracker output)
+-- Dev
|   +-- #dev-alerts    (CI/build/deploy notifications)
|   +-- #logs          (System logs, health alerts)
+-- Admin
    +-- #bot-control   (Server management commands)
```

**Known Gaps (v2.0):**
- MessageContent privileged intent must be enabled in Discord Developer Portal
- SEARCH-02/03 (channel history query) pending design decision: Discord paginated API vs. SQLite mirror

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
| Full server admin bot | User wants programmatic server management | ✓ Shipped in Phase 5 |
| Swarm bots in Discord | Friday/Alfred get Discord presence alongside Telegram | ✓ Shipped in Phase 7 |
| Contextual channel responses | Each channel has themed CLAUDE.md + Cortex knowledge sections | ✓ Shipped in Phase 8 |
| Fine granularity | 8-12 phases for careful, detailed implementation | ✓ Worked well — clean phase isolation |
| Zod schema for AgentMessageMeta | Runtime validation for IPC messages + 8 fine-grained types | ✓ Shipped in Phase 9, foundation for Phases 10-14 |
| addFields() not setFooter() for metadata | Field names queryable programmatically | ✓ Enables SEARCH-02 in v3.0 |
| Dual reporting model (host auto + MCP tool) | Guaranteed coverage at zero cost for scheduled tasks | ✓ Shipped in Phase 10 |
| routing_tag column for digest routing | Config-driven, consistent with webhook routing pattern | ✓ Shipped in Phase 12 |
| Host-side health polling (not agent-based) | Zero token cost, instant alerts, same process | ✓ Shipped in Phase 13 |
| Gradual migration | Dual-send during transition, disable Telegram notifications one by one | — Ongoing |
| Quality model profile | User chose Opus for research/roadmap agents | ✓ Good quality/cost balance |

## Evolution

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
*Last updated: 2026-03-28 — v2.0 Agent Dashboard complete: #agents live operational dashboard, health monitoring, morning digest routing*
