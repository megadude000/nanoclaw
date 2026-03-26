# Requirements: Discord Integration for NanoClaw

**Defined:** 2026-03-26
**Core Value:** Clear separation of automated notifications and project workstreams into dedicated Discord channels, keeping Telegram clean for personal conversation.

## v1 Requirements

### Channel Foundation

- [ ] **CHAN-01**: Discord bot connects to server using discord.js v14 with gateway intents (Guilds, GuildMessages, MessageContent)
- [ ] **CHAN-02**: Discord channel self-registers via `registerChannel('discord', factory)` following existing pattern
- [ ] **CHAN-03**: Bot reconnects automatically after disconnection with exponential backoff
- [ ] **CHAN-04**: Bot gracefully disconnects on NanoClaw shutdown

### Inbound Messages

- [ ] **IN-01**: Bot receives text messages in registered Discord channels
- [ ] **IN-02**: Bot translates Discord @mentions to NanoClaw trigger pattern (`@Andy`)
- [ ] **IN-03**: Bot extracts reply context (who user is replying to, original message preview)
- [ ] **IN-04**: Bot handles attachment descriptions (images, files shown as metadata)
- [ ] **IN-05**: Bot respects trigger pattern for non-main channels, responds to all in main

### Outbound Messages

- [ ] **OUT-01**: Bot sends text messages to Discord channels via `sendMessage(jid, text)`
- [ ] **OUT-02**: Bot splits messages exceeding 2000-char Discord limit into multiple messages
- [ ] **OUT-03**: Bot sends rich embeds for structured notifications (bug reports, task updates)
- [ ] **OUT-04**: Bot edits own messages via `editMessage` for progress tracker updates
- [ ] **OUT-05**: Bot shows typing indicator while agent processes
- [ ] **OUT-06**: Bot sends messages with inline keyboard buttons via `sendWithButtons`

### Group Registration

- [ ] **GRP-01**: Discord channels registered as NanoClaw groups with JID format `dc:{channelId}`
- [ ] **GRP-02**: Each registered Discord channel has its own isolated `groups/{folder}/` workspace
- [ ] **GRP-03**: Main Discord channel can send to all other groups via IPC
- [ ] **GRP-04**: Non-main Discord channels restricted to own JID per IPC authorization

### Server Management

- [ ] **SRV-01**: Bot can create text channels programmatically via discord.js guild API
- [ ] **SRV-02**: Bot can create channel categories (General, YourWave, Dev, Admin)
- [ ] **SRV-03**: Bot can delete and rename channels
- [ ] **SRV-04**: Bot can set per-channel permissions
- [ ] **SRV-05**: Server management exposed via IPC `discord_manage` message type (main group only)
- [ ] **SRV-06**: Bootstrap script creates initial server structure (categories + channels from config)

### Webhook Routing

- [ ] **ROUT-01**: Webhook routing abstraction layer replacing hardcoded `mainJid` in webhook handlers
- [ ] **ROUT-02**: GitHub Issues webhook routable to Discord `#bugs` channel (`dc:{bugChannelId}`)
- [ ] **ROUT-03**: Notion webhook routable to Discord `#yw-tasks` channel (`dc:{taskChannelId}`)
- [ ] **ROUT-04**: Progress tracker output routable to Discord `#progress` channel
- [ ] **ROUT-05**: Routing config supports targeting Telegram, Discord, or both per webhook
- [ ] **ROUT-06**: Dual-send mode: same notification sent to both platforms during migration

### Swarm Bot Identity

- [ ] **SWRM-01**: Swarm agents (Friday/Alfred) post in Discord with distinct usernames via channel webhooks
- [ ] **SWRM-02**: Each swarm identity has custom avatar in Discord
- [ ] **SWRM-03**: Swarm webhook creation automated per registered Discord channel
- [ ] **SWRM-04**: Swarm identity falls back to main bot if webhook unavailable

### Per-Channel Context

- [ ] **CTX-01**: Each Discord channel group gets a channel-specific CLAUDE.md with themed instructions
- [ ] **CTX-02**: `#bugs` channel agent responds in bug-triage mode using Cortex knowledge
- [ ] **CTX-03**: `#yw-tasks` channel agent responds in project management mode
- [ ] **CTX-04**: `#main` channel agent responds as general Jarvis assistant
- [ ] **CTX-05**: Agent uses Cortex/Obsidian knowledge base for contextual responses per channel

### Migration Controls

- [ ] **MIG-01**: Configurable per-webhook routing toggle (Telegram-only / Discord-only / both)
- [ ] **MIG-02**: Migration can be done gradually — one webhook at a time
- [ ] **MIG-03**: Telegram notifications remain functional until explicitly disabled per-webhook
- [ ] **MIG-04**: Rollback capability — switch any webhook back to Telegram-only

## v2 Requirements

### Enhanced Discord Features

- **V2-01**: Thread creation for long discussions in notification channels
- **V2-02**: Discord reaction handling (receive and send emoji reactions)
- **V2-03**: Discord forum channels for structured bug discussions
- **V2-04**: Scheduled messages / announcements in Discord
- **V2-05**: Voice channel join notifications (detect when user joins voice)

### Advanced Routing

- **V2-06**: Per-user notification preferences (which platform to receive on)
- **V2-07**: Priority-based routing (urgent to Telegram push, routine to Discord)
- **V2-08**: Notification deduplication across platforms

## Out of Scope

| Feature | Reason |
|---------|--------|
| Discord slash commands | NanoClaw uses its own trigger pattern system |
| Voice channel support | Not needed for ops dashboard use case |
| Public Discord server | Private ops server only |
| Direct Discord webhook endpoints | Route through NanoClaw, not external services directly |
| Discord moderation tools | Private server with single user, no moderation needed |
| Web dashboard for Discord management | IPC commands from agent are sufficient |
| Multiple Discord server support | Single server integration |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHAN-01 | Phase 1 | Pending |
| CHAN-02 | Phase 1 | Pending |
| CHAN-03 | Phase 1 | Pending |
| CHAN-04 | Phase 1 | Pending |
| IN-01 | Phase 2 | Pending |
| IN-02 | Phase 2 | Pending |
| IN-03 | Phase 2 | Pending |
| IN-04 | Phase 2 | Pending |
| IN-05 | Phase 2 | Pending |
| OUT-01 | Phase 3 | Pending |
| OUT-02 | Phase 3 | Pending |
| OUT-03 | Phase 3 | Pending |
| OUT-04 | Phase 3 | Pending |
| OUT-05 | Phase 3 | Pending |
| OUT-06 | Phase 3 | Pending |
| GRP-01 | Phase 4 | Pending |
| GRP-02 | Phase 4 | Pending |
| GRP-03 | Phase 4 | Pending |
| GRP-04 | Phase 4 | Pending |
| SRV-01 | Phase 5 | Pending |
| SRV-02 | Phase 5 | Pending |
| SRV-03 | Phase 5 | Pending |
| SRV-04 | Phase 5 | Pending |
| SRV-05 | Phase 5 | Pending |
| SRV-06 | Phase 5 | Pending |
| ROUT-01 | Phase 6 | Pending |
| ROUT-02 | Phase 6 | Pending |
| ROUT-03 | Phase 6 | Pending |
| ROUT-04 | Phase 6 | Pending |
| ROUT-05 | Phase 6 | Pending |
| ROUT-06 | Phase 6 | Pending |
| SWRM-01 | Phase 7 | Pending |
| SWRM-02 | Phase 7 | Pending |
| SWRM-03 | Phase 7 | Pending |
| SWRM-04 | Phase 7 | Pending |
| CTX-01 | Phase 8 | Pending |
| CTX-02 | Phase 8 | Pending |
| CTX-03 | Phase 8 | Pending |
| CTX-04 | Phase 8 | Pending |
| CTX-05 | Phase 8 | Pending |
| MIG-01 | Phase 8 | Pending |
| MIG-02 | Phase 8 | Pending |
| MIG-03 | Phase 8 | Pending |
| MIG-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
