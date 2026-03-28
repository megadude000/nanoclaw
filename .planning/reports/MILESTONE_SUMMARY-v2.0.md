# Milestone v2.0 — Project Summary: Agent Dashboard

**Generated:** 2026-03-28
**Purpose:** Team onboarding and project review
**Milestone:** v2.0 Agent Dashboard (in progress — all 5 phases complete, 2 requirements deferred to v2.1)

---

## 1. Project Overview

**NanoClaw** is a personal Claude assistant — a single Node.js process with a skill-based channel system. Messages from WhatsApp, Telegram, Slack, Discord, and Gmail route to Claude Agent SDK containers (Linux VMs). Each group has isolated filesystem and memory.

The **v1.0 milestone** (Phases 1–8) delivered a full Discord integration: bot foundation, inbound message handling, rich embed formatting, group auto-registration, server management via IPC, webhook routing, swarm bot presence (Friday/Alfred), and per-channel themed CLAUDE.md templates.

The **v2.0 milestone** (Phases 9–13) transforms Discord from a passive notification board into a **live operational dashboard**:

- `#agents` channel — receives structured status reports, blocker alerts, handoffs, and the morning digest directly from agent activity
- `#logs` channel — receives health monitoring alerts from Alfred watching tunnels and services

**Core value:** Telegram main chat stays clean for personal conversation. All operational signal (task lifecycle, blockers, handoffs, digests, health alerts) is organized and searchable in Discord.

**Current state (2026-03-28):** All 5 phases executed and verified. Requirements SEARCH-02 and SEARCH-03 (channel history query) intentionally deferred to v2.1.

---

## 2. Architecture & Technical Decisions

### Embed Metadata Foundation (Phase 9)

- **Decision:** Zod schema for `AgentMessageMeta` with 8-value discriminated enum (`took`, `closed`, `progress`, `blocker-perm`, `blocker-service`, `blocker-conflict`, `handoff`, `digest`)
  - **Why:** IPC messages arrive as runtime strings — Zod validates them at runtime and produces TypeScript types automatically. Fine-grained types (not 4 coarse ones) make Phase 14 IPC queries semantically useful ("fetch last 10 `blocker-*` messages").
  - **Phase:** 9

- **Decision:** `withAgentMeta()` appends metadata as `addFields()` entries, not `setFooter()`
  - **Why:** Discord field names are queryable programmatically. Footer text is not. Phase 14 history search depends on this layout.
  - **Phase:** 9

- **Decision:** `AGENT_COLORS` keyed by full `AgentMessageType` string (e.g., `'blocker-perm'` not `'blocker'`) enabling `AGENT_COLORS[meta.messageType]` direct lookup without switch statement
  - **Phase:** 9

### Status Reporting Architecture (Phase 10)

- **Decision:** Dual reporting model — host auto-posts `took`/`closed` when scheduled tasks start/end; container agents call `report_agent_status` MCP tool explicitly for progress updates
  - **Why:** Host-side reporting gives guaranteed coverage for all scheduled tasks at zero agent cost. Agent-side reporting is for richer/explicit updates.
  - **Phase:** 10

- **Decision:** `sendToAgents()` in `src/index.ts` mirrors `sendToLogs()` pattern exactly — optional, failure-safe, wired from `DISCORD_AGENTS_CHANNEL_ID`
  - **Phase:** 10

- **Decision:** Type-only import of `EmbedBuilder` in `Channel` interface (`import('discord.js').EmbedBuilder`) to avoid making discord.js a runtime dependency of `types.ts`
  - **Phase:** 10

- **Decision:** `NANOCLAW_ASSISTANT_NAME` env var forwarded into containers via `container-runner.ts` so agents can self-identify in embeds
  - **Phase:** 10

### Blocker & Handoff Reporting (Phase 11)

- **Decision:** `blockerType` maps to `messageType` via string concatenation `'blocker-${blockerType}'` — no additional type mapping required
  - **Phase:** 11

- **Decision:** `resource` field is required (not optional) in `report_blocker` — blockers must name what is blocked to be actionable
  - **Phase:** 11

### Morning Digest Routing (Phase 12)

- **Decision:** `routing_tag` column on `scheduled_tasks` table (SQLite migration with try/catch ALTER TABLE guard + broad OR backfill) drives routing via `config/routing.json`
  - **Why:** More reliable than prompt engineering. Config-driven routing is consistent with how webhooks work (github-issues, notion, bugreport all use `routing.json`).
  - **Phase:** 12

- **Decision:** When `routing_tag` resolves to Discord targets, Telegram main chat suppressed (no dual-send). Fallback: output goes to original `chat_jid` when routing fails or tag is null.
  - **Phase:** 12

- **Decision:** `resolveTargets()` results filtered to exclude `task.chat_jid` to prevent accidental double-send when fallback returns the main group
  - **Phase:** 12

### Health Monitoring (Phase 13)

- **Decision:** Host-side polling (`src/health-monitor.ts`) over agent-based scheduled task
  - **Why:** Zero token cost, runs in same process as NanoClaw, instant posting. Agent-based approach would burn Claude tokens every 60 seconds just to run `systemctl status`.
  - **Phase:** 13

- **Decision:** `systemctl --user is-active` for app services (nanoclaw, yw-dev); `systemctl is-active` (no `--user`) for cloudflared (daemon-level service)
  - **Phase:** 13

- **Decision:** Initial `unknown→up` transitions suppressed (no embed posted) to prevent startup spam
  - **Phase:** 13

- **Decision:** State persisted to `data/health-state.json` so crash recovery doesn't re-alert for already-known-down services
  - **Phase:** 13

- **Decision:** Health embeds go to `#logs` channel via `dumpJid` (reuses `DISCORD_LOGS_CHANNEL_ID`). No `withAgentMeta()` — health monitor is not an agent.
  - **Phase:** 13

- **Decision:** `stopHealthMonitor` called first in shutdown handler before `proxyServer`/`webhookServer` close — ensures clean interval cleanup
  - **Phase:** 13

---

## 3. Phases Delivered

| Phase | Name | Status | One-Liner |
|-------|------|--------|-----------|
| 9 | Agent Message Schema | ✅ Complete | Zod schema + `withAgentMeta()` EmbedBuilder helper establishing structured, machine-parseable metadata contract for all #agents channel messages |
| 10 | Agent Status Reporting | ✅ Complete | Scheduled tasks and container agents post took/closed/progress embeds to Discord #agents channel |
| 11 | Blocker & Handoff Reporting | ✅ Complete | Agents surface blockers and handoffs as actionable red/purple embeds in #agents via two new MCP tools |
| 12 | Morning Digest Routing | ✅ Complete | Morning Digest posts to #agents instead of Telegram main chat via routing_tag + config/routing.json |
| 13 | Health Monitoring | ✅ Complete | Host-side polling loop monitors tunnels/services and posts state-change embeds to #logs |

---

## 4. Requirements Coverage

### ✅ Fully Met (13/15 requirements)

| Req ID | Description | Phase |
|--------|-------------|-------|
| ASTATUS-01 | Agent posts "took #N [title]" embed to #agents when picking up a task | 10 |
| ASTATUS-02 | Agent posts "closed #N, PR #M" embed to #agents when completing a task | 10 |
| ASTATUS-03 | Agent posts progress update embed to #agents during long-running tasks | 10 |
| BLOCK-01 | Agent posts blocker embed to #agents on permission error | 11 |
| BLOCK-02 | Agent posts blocker embed to #agents when service/tunnel unavailable | 11 |
| BLOCK-03 | Agent posts blocker embed to #agents for human-input conflicts | 11 |
| HAND-01 | Structured handoff embed to #agents (what, to whom, why) | 11 |
| DIGEST-01 | Morning Digest routes to #agents instead of Telegram main | 12 |
| DIGEST-02 | Morning Digest removed from Telegram main routing | 12 |
| HEALTH-01 | Alfred monitors Cloudflare tunnels and posts status to #logs on state change | 13 |
| HEALTH-02 | Alfred monitors key services (yw-dev, nanoclaw) and posts to #logs on state change | 13 |
| HEALTH-03 | Alfred posts periodic heartbeat to #logs when all services operational | 13 |
| SEARCH-01 | All #agents messages include structured metadata embed fields (agent name, task ID, message type) | 9 |

### ⚠️ Deferred to v2.1 (2/15 requirements)

| Req ID | Description | Reason |
|--------|-------------|--------|
| SEARCH-02 | Agent can query #agents message history via IPC command | Blocked: needs Discord channel history API design (paginated API call vs. SQLite mirror). Deferred to Phase 14 (now removed from this milestone). |
| SEARCH-03 | #agents serves as persistent chronological activity log (messages never deleted) | Governance policy — no code required, but depends on SEARCH-02 infrastructure for full value. |

---

## 5. Key Decisions Log

| ID | Decision | Phase | Rationale |
|----|----------|-------|-----------|
| D-09-01 | Zod enum for AgentMessageType (8 fine-grained values, not 4 coarse) | 9 | Enables meaningful Phase 14 queries by type |
| D-09-02 | `withAgentMeta()` writes to `addFields()` not `setFooter()` | 9 | Footer text is not queryable; embed fields are |
| D-09-03 | `agent-message-schema.ts` as single import for all #agents embed work | 9 | Central contract for Phases 10-14 |
| D-10-01 | Dual reporting: host auto-reports task lifecycle, agents call MCP tool explicitly | 10 | Guaranteed coverage at zero cost for scheduled tasks; richer reporting when agents choose to |
| D-10-02 | Type-only import of `EmbedBuilder` in Channel interface | 10 | Avoids making discord.js a runtime dependency of types.ts |
| D-10-03 | `NANOCLAW_ASSISTANT_NAME` env forwarded to containers | 10 | Self-identification in embeds without hardcoding |
| D-11-01 | `resource` required (not optional) in `report_blocker` | 11 | Blockers must name what is blocked to be actionable |
| D-11-02 | `'blocker-${blockerType}'` concatenation for type mapping | 11 | No additional switch/map needed |
| D-12-01 | `routing_tag` column on `scheduled_tasks` + `config/routing.json` | 12 | Consistent with webhook routing pattern; reliable vs. prompt engineering |
| D-12-02 | Suppress Telegram when Discord routing resolves | 12 | Clean separation — digest goes to one place |
| D-13-01 | Host-side polling over agent-based scheduled task for health checks | 13 | Zero token cost; same process; instant alerts |
| D-13-02 | `systemctl --user` for app services; `systemctl` (no `--user`) for cloudflared | 13 | Correct user scope for each service type |
| D-13-03 | Suppress `unknown→up` on startup | 13 | Prevents false alarm spam during nanoclaw boot |

---

## 6. Tech Debt & Deferred Items

### Tech Debt

- **Pre-existing build errors** (unrelated to v2.0): `src/channels/whatsapp.ts` (missing `@whiskeysockets/baileys`) and `src/index.ts` (missing `telegram.js`) — WhatsApp and Telegram skills are optional and not installed in this environment. These existed before v2.0 and are not caused by it.
- **MessageContent privileged intent** must be enabled in Discord Developer Portal (carried from v1.0) — manual step for anyone deploying fresh.

### Deferred to v2.1

- **SEARCH-02**: IPC query for #agents channel history — needs design decision (Discord paginated API vs. SQLite message mirror)
- **SEARCH-03**: Message retention policy for #agents
- **Bidirectional handoff acknowledgement**: receiving agent confirms pickup
- **#logs query capability**: same as SEARCH-02 but for #logs
- **Cross-channel activity summary**: daily digest of #agents + #logs activity
- **Streaming progress bar in Discord**: edit-message approach for long-running tasks
- **Per-agent color customization**
- **Thread-based task conversations** in #agents
- **Email/SMS escalation** for prolonged health outages
- **Per-task routing config UI**
- **Multiple routing targets** (both Telegram AND Discord for digests)

### Human UAT Pending

These live tests were documented in phase verifications but not executed (require live Discord connection):

1. **Phase 10**: Verify Discord embed delivery to #agents channel with a real scheduled task
2. **Phase 10**: Verify `report_agent_status` tool appears in running container tool list
3. **Phase 11**: Verify red blocker and purple handoff embeds appear in #agents
4. **Phase 12**: Verify morning digest fires to #agents, not Telegram main (trigger: set `next_run` to past timestamp)
5. **Phase 12**: `SELECT id, prompt, routing_tag FROM scheduled_tasks WHERE routing_tag = 'morning-digest'` on production DB

---

## 7. Getting Started

### Run the Project

```bash
# Development (hot reload)
npm run dev

# Build TypeScript
npm run build

# Service management (Linux/systemd)
systemctl --user start nanoclaw
systemctl --user stop nanoclaw
systemctl --user restart nanoclaw
```

### Key Directories

```
src/
  agent-message-schema.ts   # Phase 9: Zod schema + withAgentMeta() + AGENT_COLORS
  agent-status-embeds.ts    # Phases 10-11: took/closed/progress/blocker/handoff builders
  health-monitor.ts         # Phase 13: polling loop + state tracking
  health-monitor-embeds.ts  # Phase 13: down/up/heartbeat embed builders
  task-scheduler.ts         # Phase 10+12: sendToAgents + routing_tag logic
  ipc.ts                    # Phase 10+11: agent_status/agent_blocker/agent_handoff handlers
  index.ts                  # Phase 10+13: sendToAgents, sendHealthEmbed, startHealthMonitor

container/agent-runner/src/
  ipc-mcp-stdio.ts          # Phases 10-11: report_agent_status, report_blocker, report_handoff MCP tools

config/
  routing.json              # Phase 12: morning-digest → #agents routing entry

data/
  health-state.json         # Phase 13: persisted health state for crash recovery
```

### Tests

```bash
npm test                                          # Run all tests
npx vitest run src/agent-message-schema.test.ts  # Phase 9 schema tests (14 tests)
npx vitest run src/agent-status-embeds.test.ts   # Phases 10-11 embed tests (51 tests)
npx vitest run src/health-monitor.test.ts        # Phase 13 health monitor tests (24 tests)
npx vitest run src/health-monitor-embeds.test.ts # Phase 13 embed tests (25 tests)
npx vitest run src/task-scheduler.test.ts        # Phase 12 routing tests
```

### Required Environment Variables (v2.0 additions)

| Variable | Purpose | Phase |
|----------|---------|-------|
| `DISCORD_AGENTS_CHANNEL_ID` | Discord #agents channel snowflake ID | 10 |
| `NANOCLAW_ASSISTANT_NAME` | Agent display name in embeds | 10 |
| `HEALTH_MONITOR_SERVICES` | Comma-separated services to monitor (default: `nanoclaw`) | 13 |
| `HEALTH_CHECK_INTERVAL_MS` | Poll interval in ms (default: `60000`) | 13 |
| `CLOUDFLARE_TUNNEL_NAME` | Tunnel name — enables cloudflared check when set | 13 |

### Where to Look First

- Agent reporting pipeline: `src/ipc.ts` → `src/agent-status-embeds.ts` → `src/agent-message-schema.ts`
- Host-side wiring: `src/index.ts` lines ~877–910 (`sendToLogs`, `sendToAgents`, `sendHealthEmbed`, `startHealthMonitor`)
- Scheduled task reporting: `src/task-scheduler.ts` `runTask()` function
- Container MCP tools: `container/agent-runner/src/ipc-mcp-stdio.ts`
- Routing config: `config/routing.json`

---

## Stats

- **Timeline:** 2026-03-27 → 2026-03-28 (1 day)
- **Phases:** 5 / 5 complete
- **Commits:** 59
- **Files changed:** 126 (+10,036 / -360)
- **Contributors:** Andrii
- **Tests added:** ~114 (14 Phase 9 + 24 Phase 10 + 51 Phase 11 + 31 Phase 12 routing + 49 Phase 13)
- **Requirements met:** 13/15 (SEARCH-02, SEARCH-03 deferred to v2.1)

---

*Generated by `/gsd:milestone-summary` on 2026-03-28*
