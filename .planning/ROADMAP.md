# Roadmap: Discord Integration for NanoClaw

## Milestones

- ✅ **v1.0 Discord Integration** — Phases 1-8 (shipped 2026-03-27)
- ✅ **v2.0 Agent Dashboard** — Phases 9-13 (shipped 2026-03-28)
- 📋 **v3.0** — Phases 14+ (planned)

## Phases

<details>
<summary>✅ v1.0 Discord Integration (Phases 1-8) — SHIPPED 2026-03-27</summary>

### Phase 1: Bot Foundation
**Goal**: Discord bot connects and self-registers as a channel
**Plans**: 2 plans

Plans:
- [x] 01-01: Merge DiscordChannel from nanoclaw-discord remote
- [x] 01-02: Shard disconnect/reconnect/resume event logging

### Phase 2: Inbound Message Handling
**Goal**: Discord messages trigger agent with full context
**Plans**: 1 plan

Plans:
- [x] 02-01: Trigger detection, reply preview, attachment metadata

### Phase 3: Outbound Formatting
**Goal**: Rich embeds and markdown-aware chunking for all outbound message types
**Plans**: 2 plans

Plans:
- [x] 03-01: Markdown-aware 2000-char chunker, color-coded embed builders
- [x] 03-02: editMessage, sendWithButtons + callbacks, sendPhoto

### Phase 4: Group Registration
**Goal**: Discord channels auto-register as groups with isolated filesystem and memory
**Plans**: 2 plans

Plans:
- [x] 04-01: Auto-registration, human-readable folder naming, DISCORD_MAIN_CHANNEL_ID
- [x] 04-02: IPC authorization for Discord JIDs

### Phase 5: Server Management
**Goal**: Agent can create/delete/rename channels and categories via IPC commands
**Plans**: 2 plans

Plans:
- [x] 05-01: DiscordServerManager with 5 CRUD actions
- [x] 05-02: IPC wiring with main-only authorization

### Phase 6: Webhook Routing
**Goal**: Webhooks (GitHub Issues, Notion, bugs, progress) routable to any Discord channel
**Plans**: 2 plans

Plans:
- [x] 06-01: discord-routing.json config, Zod validation, mainJid fallback
- [x] 06-02: Task ID @jid suffix for dual-send uniqueness

### Phase 7: Swarm Bot Presence
**Goal**: Friday and Alfred post with their own identities in Discord via webhooks
**Plans**: 2 plans

Plans:
- [x] 07-01: SwarmWebhookManager, NanoClaw- prefix naming, Dicebear avatars
- [x] 07-02: Lazy webhook hydration per channel

### Phase 8: Channel Templates
**Goal**: Each Discord channel has a themed CLAUDE.md with Cortex knowledge references
**Plans**: 1 plan

Plans:
- [x] 08-01: 8 themed CLAUDE.md templates loaded via createGroupStub()

</details>

<details>
<summary>✅ v2.0 Agent Dashboard (Phases 9-13) — SHIPPED 2026-03-28</summary>

### Phase 9: Agent Message Schema
**Goal**: All #agents messages carry structured, machine-parseable embed metadata
**Plans**: 1 plan

Plans:
- [x] 09-01: Zod schema, AgentMessageMeta types, withAgentMeta() helper, AGENT_COLORS

### Phase 10: Agent Status Reporting
**Goal**: Agents announce task lifecycle events (picked up, in progress, closed) to #agents
**Plans**: 2 plans

Plans:
- [x] 10-01: Embed builders (took/closed/progress) with tests, sendEmbed channel method
- [x] 10-02: Host-side wiring: sendToAgents, scheduler reporting, IPC handler, MCP tool

### Phase 11: Blocker & Handoff Reporting
**Goal**: Agents surface blockers and handoffs as actionable embeds in #agents
**Plans**: 2 plans

Plans:
- [x] 11-01: Blocker and handoff embed builders with unit tests
- [x] 11-02: IPC MCP tools (container) and host-side IPC handlers

### Phase 12: Morning Digest Routing
**Goal**: Morning Digest posts to #agents instead of Telegram main chat
**Plans**: 1 plan

Plans:
- [x] 12-01: Schema migration, routing.json config, task-scheduler routing logic

### Phase 13: Health Monitoring
**Goal**: Alfred monitors tunnel and service health and posts state changes to #logs
**Plans**: 2 plans

Plans:
- [x] 13-01: Health monitor embeds, core polling loop, state tracking with tests
- [x] 13-02: Wire startHealthMonitor into index.ts startup and shutdown

</details>

### 📋 v3.0 (Planned)

*Next milestone to be defined. See /gsd:new-milestone.*
