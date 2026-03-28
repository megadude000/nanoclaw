# Roadmap: Discord Integration for NanoClaw

## Milestones

- ✅ **v1.0 Discord Integration** - Phases 1-8 (shipped 2026-03-27)
- 🚧 **v2.0 Agent Dashboard** - Phases 9-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 Discord Integration (Phases 1-8) - SHIPPED 2026-03-27</summary>

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

### 🚧 v2.0 Agent Dashboard (In Progress)

**Milestone Goal:** Make #agents a live operational dashboard where agents report status, blockers, handoffs, and health alerts — keeping Telegram main chat clean for personal conversation.

#### Phase 9: Agent Message Schema
**Goal**: All #agents messages carry structured, machine-parseable embed metadata
**Depends on**: Phase 8
**Requirements**: SEARCH-01
**Success Criteria** (what must be TRUE):
  1. Every message posted to #agents includes embed fields: agent name, task ID, message type (status/blocker/handoff/digest)
  2. Embed fields use consistent, documented field names that can be filtered programmatically
  3. A TypeScript type or schema defines the required fields and valid message-type values
**Plans**: 1 plan

Plans:
- [x] 09-01-PLAN.md — Zod schema, AgentMessageMeta types, withAgentMeta() helper, AGENT_COLORS

#### Phase 10: Agent Status Reporting
**Goal**: Agents announce task lifecycle events (picked up, in progress, closed) to #agents
**Depends on**: Phase 9
**Requirements**: ASTATUS-01, ASTATUS-02, ASTATUS-03
**Success Criteria** (what must be TRUE):
  1. When an agent picks up a task or GitHub issue, a "took #N [title]" embed appears in #agents
  2. When an agent closes a task, a "closed #N, PR #M" embed appears in #agents with PR link
  3. During a long-running task, progress update embeds appear in #agents at meaningful intervals
  4. All status embeds carry the structured metadata defined in Phase 9
**Plans**: TBD

#### Phase 11: Blocker & Handoff Reporting
**Goal**: Agents surface blockers and handoffs as actionable embeds in #agents
**Depends on**: Phase 9
**Requirements**: BLOCK-01, BLOCK-02, BLOCK-03, HAND-01
**Success Criteria** (what must be TRUE):
  1. When an agent hits a permission error, a blocker embed appears in #agents naming the resource and the error
  2. When a service or tunnel is unavailable, a blocker embed appears in #agents naming the service
  3. When an agent needs human input due to ambiguity, a blocker embed appears in #agents with the question
  4. When an agent hands off to another agent, a structured handoff embed appears in #agents with what, to whom, and why
  5. All blocker and handoff embeds carry the structured metadata defined in Phase 9
**Plans**: TBD

#### Phase 12: Morning Digest Routing
**Goal**: Morning Digest posts to #agents instead of Telegram main chat
**Depends on**: Phase 6
**Requirements**: DIGEST-01, DIGEST-02
**Success Criteria** (what must be TRUE):
  1. The Morning Digest message appears in the Discord #agents channel each morning
  2. The Morning Digest no longer appears in the Telegram main chat
  3. The routing change is driven by discord-routing.json config (no hardcoded JIDs)
**Plans**: TBD

#### Phase 13: Health Monitoring
**Goal**: Alfred monitors tunnel and service health and posts state changes to #logs
**Depends on**: Phase 8
**Requirements**: HEALTH-01, HEALTH-02, HEALTH-03
**Success Criteria** (what must be TRUE):
  1. When a Cloudflare tunnel goes down or comes back up, a status embed appears in #logs within one check interval
  2. When a monitored service (yw-dev, nanoclaw systemd) changes state, a status embed appears in #logs
  3. When all monitored services are operational, a periodic heartbeat embed appears in #logs confirming health
  4. Health monitoring runs as a scheduled task without requiring manual agent invocation
**Plans**: TBD
**UI hint**: no

#### Phase 14: Agent History Search
**Goal**: Agents can query #agents message history via IPC and the channel serves as a persistent activity log
**Depends on**: Phase 10, Phase 11
**Requirements**: SEARCH-02, SEARCH-03
**Success Criteria** (what must be TRUE):
  1. An agent can send an IPC command requesting #agents history filtered by message type, task ID, or agent name
  2. The IPC command returns matching messages with their structured metadata fields
  3. Messages in #agents are never deleted — the channel accumulates a complete chronological activity log
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11 → 12 → 13 → 14
Note: Phase 12 depends only on Phase 6 (already complete) and can execute in parallel with 10-11 if desired.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Bot Foundation | v1.0 | 2/2 | Complete | 2026-03-27 |
| 2. Inbound Message Handling | v1.0 | 1/1 | Complete | 2026-03-27 |
| 3. Outbound Formatting | v1.0 | 2/2 | Complete | 2026-03-27 |
| 4. Group Registration | v1.0 | 2/2 | Complete | 2026-03-27 |
| 5. Server Management | v1.0 | 2/2 | Complete | 2026-03-27 |
| 6. Webhook Routing | v1.0 | 2/2 | Complete | 2026-03-27 |
| 7. Swarm Bot Presence | v1.0 | 2/2 | Complete | 2026-03-27 |
| 8. Channel Templates | v1.0 | 1/1 | Complete | 2026-03-27 |
| 9. Agent Message Schema | v2.0 | 0/1 | Not started | - |
| 10. Agent Status Reporting | v2.0 | 0/? | Not started | - |
| 11. Blocker & Handoff Reporting | v2.0 | 0/? | Not started | - |
| 12. Morning Digest Routing | v2.0 | 0/? | Not started | - |
| 13. Health Monitoring | v2.0 | 0/? | Not started | - |
| 14. Agent History Search | v2.0 | 0/? | Not started | - |
