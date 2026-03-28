# Milestones

## v2.0 Agent Dashboard (Shipped: 2026-03-28)

**Phases completed:** 5 phases (9-13), 8 plans, 10 tasks
**Commits:** 59 | **Files changed:** 126 (+10,036 / -360) | **Tests added:** ~114

**Key accomplishments:**

- Zod schema + `withAgentMeta()` EmbedBuilder helper — structured, machine-parseable metadata contract for all #agents channel messages (Phase 9)
- Took/closed/progress embed builders + `Channel.sendEmbed` + host-side wiring — scheduled tasks auto-report to #agents, container agents call `report_agent_status` MCP tool (Phase 10)
- Blocker and handoff embed builders + `report_blocker`/`report_handoff` MCP tools — agents surface permission errors, service outages, and handoffs as actionable Discord embeds (Phase 11)
- `routing_tag` column on `scheduled_tasks` + `config/routing.json` entry — morning digest routes to #agents, suppressed from Telegram main (Phase 12)
- Host-side health monitor: `startHealthMonitor()` polls systemctl for tunnels/services, posts DOWN/UP/heartbeat embeds to #logs (Phase 13)

**Known gaps (deferred to v3.0):** SEARCH-02 (#agents history query), SEARCH-03 (message retention policy)

---

## v1.0 Discord Integration (Shipped: 2026-03-27)

**Phases completed:** 8 phases (1-8), 15 plans, 21 tasks

**Key accomplishments:**

- DiscordChannel class with self-registration via `registerChannel`, discord.js v14, 34+ unit tests
- Shard disconnect/reconnect/resume event logging
- Inbound message handling: trigger detection, reply preview with 100-char truncation, attachment metadata
- Markdown-aware 2000-char chunker with code fence handling, color-coded embed builders (bug/task/progress)
- Group auto-registration on first message, human-readable folder naming, IPC authorization for Discord JIDs
- DiscordServerManager with 5 CRUD actions (create/delete/rename channels, categories, permissions)
- Webhook routing via `config/routing.json` with Zod validation, mainJid fallback, dual-send via task ID @jid suffix
- SwarmWebhookManager: Friday/Alfred with Dicebear avatars and lazy webhook hydration per channel
- 8 themed CLAUDE.md channel templates with Cortex knowledge references, loaded via `createGroupStub()`

---
