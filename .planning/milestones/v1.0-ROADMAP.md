# Roadmap: Discord Integration for NanoClaw

## Overview

Transform NanoClaw from a Telegram-only assistant into a multi-channel ops dashboard by adding Discord as a structured workspace for automated notifications, project management, and contextual AI responses. The integration follows the existing channel registry pattern, layering Discord-specific capabilities (embeds, server management, webhook routing, per-channel context) in dependency order. User involvement is limited to Phase 1 (creating Discord bot token and inviting bot to server -- roughly 5 minutes). All subsequent phases are fully automated.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Discord Channel Foundation** - Bot connects to Discord server, self-registers as NanoClaw channel, handles reconnection
- [ ] **Phase 2: Inbound Message Handling** - Bot receives and processes Discord messages with trigger pattern support
- [ ] **Phase 3: Outbound Formatting** - Bot sends messages with embeds, editing, typing indicators, and buttons
- [ ] **Phase 4: Group Registration** - Discord channels become isolated NanoClaw groups with IPC authorization
- [ ] **Phase 5: Server Structure Management** - Bot programmatically creates channels, categories, and permissions
- [ ] **Phase 6: Webhook Routing Architecture** - Configurable routing replaces hardcoded mainJid, enables dual-send
- [ ] **Phase 7: Swarm Bot Identity** - Friday and Alfred post in Discord with distinct names and avatars
- [ ] **Phase 8: Per-Channel Context and Migration** - Themed CLAUDE.md per channel, gradual migration controls

## Phase Details

### Phase 1: Discord Channel Foundation
**Goal**: NanoClaw connects to Discord and registers as a first-class channel alongside Telegram
**Depends on**: Nothing (first phase)
**Requirements**: CHAN-01, CHAN-02, CHAN-03, CHAN-04
**Success Criteria** (what must be TRUE):
  1. Bot appears online in the Discord server after NanoClaw starts
  2. Bot reconnects automatically after a network interruption without manual intervention
  3. Bot disconnects cleanly when NanoClaw is stopped (no orphaned gateway sessions)
  4. Discord channel appears in NanoClaw's registered channel list at startup
**Plans:** 2 plans
Plans:
- [x] 01-01-PLAN.md — Merge nanoclaw-discord remote, resolve conflicts, verify build and tests
- [x] 01-02-PLAN.md — Add shard lifecycle logging for CHAN-03, configure bot token

### Phase 2: Inbound Message Handling
**Goal**: Users can write messages in Discord channels and have them processed by the NanoClaw agent
**Depends on**: Phase 1
**Requirements**: IN-01, IN-02, IN-03, IN-04, IN-05
**Success Criteria** (what must be TRUE):
  1. User writes a message mentioning @Andy in a Discord channel and receives an agent response
  2. User replies to a bot message and the agent sees the reply context (original message preview)
  3. User sends an image/file attachment and the agent acknowledges it with metadata description
  4. Bot responds to all messages in the main Discord channel without requiring trigger pattern
**Plans:** 1 plan
Plans:
- [x] 02-01-PLAN.md — Add reply message preview (IN-03) and verify all inbound requirement coverage

### Phase 3: Outbound Formatting
**Goal**: Bot sends well-formatted messages to Discord including rich embeds, message editing, and interactive elements
**Depends on**: Phase 2
**Requirements**: OUT-01, OUT-02, OUT-03, OUT-04, OUT-05, OUT-06
**Success Criteria** (what must be TRUE):
  1. Bot sends a message longer than 2000 characters and it arrives as multiple sequential messages (no truncation)
  2. Bot sends a structured notification (e.g., bug report) as a color-coded Discord embed
  3. Progress tracker updates appear as edits to the same message (not new messages)
  4. Bot shows typing indicator while processing a user request
  5. Bot sends messages with clickable inline buttons
**Plans:** 2 plans
Plans:
- [x] 03-01-PLAN.md — Channel interface contracts, markdown-aware chunker, embed builder helpers
- [x] 03-02-PLAN.md — Discord outbound methods (editMessage, sendMessageRaw, sendPhoto, sendWithButtons, interactionCreate) + router error feedback

### Phase 4: Group Registration
**Goal**: Each Discord channel operates as an isolated NanoClaw group with its own workspace and IPC authorization
**Depends on**: Phase 2
**Requirements**: GRP-01, GRP-02, GRP-03, GRP-04
**Success Criteria** (what must be TRUE):
  1. Each registered Discord channel has a `groups/dc-{name}/` directory with its own workspace files
  2. Main Discord channel can send IPC messages to any other group (Discord or Telegram)
  3. Non-main Discord channels can only send IPC messages to their own JID
  4. Discord channels use JID format `dc:{channelId}` consistently across all NanoClaw systems
**Plans:** 1/2 plans executed
Plans:
- [x] 04-01-PLAN.md — Discord group utilities (sanitization, collision detection, stub creation) + extend ChannelOpts with registerGroup
- [ ] 04-02-PLAN.md — Wire auto-registration in discord.ts messageCreate handler + IPC authorization tests

### Phase 5: Server Structure Management
**Goal**: Bot can programmatically create and manage the Discord server structure without manual Discord UI interaction
**Depends on**: Phase 1
**Requirements**: SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, SRV-06
**Success Criteria** (what must be TRUE):
  1. Agent sends an IPC command and a new text channel appears in the Discord server
  2. Agent creates the full target server structure (General, YourWave, Dev, Admin categories with channels) via bootstrap script
  3. Agent can rename or delete a Discord channel via IPC command
  4. Agent can set per-channel permissions (e.g., restrict a channel to bot-only posting)
  5. Server management IPC commands are restricted to the main group only
**Plans:** 1/2 plans executed
Plans:
- [x] 05-01-PLAN.md — DiscordServerManager CRUD operations + IPC discord_manage wiring
- [x] 05-02-PLAN.md — Bootstrap config and idempotent server structure creation

### Phase 6: Webhook Routing Architecture
**Goal**: Automated notifications (GitHub Issues, Notion, progress tracker) route to specific Discord channels instead of only Telegram
**Depends on**: Phase 3, Phase 4
**Requirements**: ROUT-01, ROUT-02, ROUT-03, ROUT-04, ROUT-05, ROUT-06
**Success Criteria** (what must be TRUE):
  1. A new GitHub Issue triggers a formatted notification in the Discord #bugs channel
  2. A Notion task update triggers a notification in the Discord #yw-tasks channel
  3. Progress tracker output appears in the Discord #progress channel with live editing
  4. Routing config file determines which platform(s) receive each webhook type
  5. Dual-send mode delivers the same notification to both Telegram and Discord simultaneously
**Plans:** 2 plans
Plans:
- [x] 06-01-PLAN.md — Routing abstraction layer (webhook-router.ts, Zod schema, resolveTargets, unit tests, routing.json config)
- [x] 06-02-PLAN.md — Migrate webhook handlers (github-issues, github-ci, notion, progress tracker) to resolveTargets

### Phase 7: Swarm Bot Identity
**Goal**: Friday and Alfred post in Discord with their own distinct identities (names and avatars), not as the main bot
**Depends on**: Phase 3
**Requirements**: SWRM-01, SWRM-02, SWRM-03, SWRM-04
**Success Criteria** (what must be TRUE):
  1. When Friday generates output, it appears in Discord under the username "Friday" with a custom avatar
  2. When Alfred generates output, it appears under "Alfred" with a different custom avatar
  3. Swarm identity webhooks are created automatically when a Discord channel is registered
  4. If a swarm webhook is unavailable, the message still posts via the main bot as fallback
**Plans:** 1/2 plans executed
Plans:
- [x] 07-01-PLAN.md — SwarmWebhookManager class, config, and unit tests
- [x] 07-02-PLAN.md — Thread sender through IPC and wire swarm routing into DiscordChannel

### Phase 8: Per-Channel Context and Migration
**Goal**: Each Discord channel has themed AI behavior via channel-specific CLAUDE.md, and notifications migrate gradually from Telegram to Discord
**Depends on**: Phase 4, Phase 6
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, MIG-01, MIG-02, MIG-03, MIG-04
**Success Criteria** (what must be TRUE):
  1. User writes in #bugs and the agent responds in bug-triage mode referencing Cortex bug knowledge
  2. User writes in #yw-tasks and the agent responds in project management mode
  3. User writes in #main and the agent responds as the general Jarvis assistant
  4. User can switch any webhook from Telegram-only to Discord-only to both, one at a time
  5. User can roll back any webhook to Telegram-only if Discord routing has issues
**Plans:** 2 plans
Plans:
- [x] 08-01-PLAN.md — Channel-specific CLAUDE.md templates + enhanced createGroupStub()
- [ ] 08-02-PLAN.md — Routing enabled toggle + migration checklist documentation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
Note: Phase 4 and Phase 5 can execute in parallel (both depend on earlier phases, not each other).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Discord Channel Foundation | 0/2 | Planning complete | - |
| 2. Inbound Message Handling | 0/1 | Planning complete | - |
| 3. Outbound Formatting | 0/2 | Planning complete | - |
| 4. Group Registration | 2/2 | Complete | 2026-03-26 |
| 5. Server Structure Management | 2/2 | Complete | 2026-03-26 |
| 6. Webhook Routing Architecture | 2/2 | Complete | 2026-03-26 |
| 7. Swarm Bot Identity | 2/2 | Complete | 2026-03-27 |
| 8. Per-Channel Context and Migration | 0/2 | Planning complete | - |
