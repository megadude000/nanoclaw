# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v2.0 — Agent Dashboard

**Shipped:** 2026-03-28
**Phases:** 5 (9-13) | **Plans:** 8 | **Timeline:** 1 day

### What Was Built

- Zod schema foundation (`AgentMessageMeta`, 8-type enum, `withAgentMeta()`) as the contract for all #agents embeds
- Dual-mode status reporting: host auto-posts took/closed for scheduled tasks; container agents call `report_agent_status` MCP tool explicitly
- Blocker and handoff MCP tools (`report_blocker`, `report_handoff`) with red/purple embeds in #agents
- Morning digest routed from Telegram → Discord #agents via `routing_tag` column + `config/routing.json`
- Host-side health monitor polling systemctl for tunnels/services, posting state-change embeds to #logs

### What Worked

- **TDD throughout**: every embed builder, schema validator, and IPC handler was test-driven. 114 tests across 5 phases, all passing. Verification scores were 8/8, 11/11, 8/8, 3/3, 11/11.
- **Phase isolation**: each phase had a single, clear boundary. No phase reached into another's territory. Made verification fast and confident.
- **Yolo mode**: all 5 phases ran fully autonomously (Claude's discretion on all decisions). Zero interruptions for approval.
- **Additive-only Phase 9**: schema phase touched zero existing files — purely additive. Clean unblock for Phases 10-13 in parallel.
- **Host-side health polling**: choosing host-side over agent-based saved tokens and reduced complexity. Instant alerts, zero container spawn cost.
- **routing_tag pattern**: consistent with existing webhook routing — no new concepts introduced. Digest routing was a config change, not an architecture change.

### What Was Inefficient

- **MILESTONES.md noise**: the CLI extracted some phase summaries as "One-liner:" placeholders due to YAML frontmatter parse issues in summary files. Needed manual cleanup.
- **Phase 14 removed late**: SEARCH-02/03 were scoped into Phase 14 but then the phase was removed from the milestone before execution. Could have been caught in requirements review earlier.
- **No milestone audit**: skipped `v2.0-MILESTONE-AUDIT.md` — the 5 individual VERIFICATION.md files were thorough but no cross-phase integration check was done. Acceptable given clean phase isolation, but worth running for future milestones.

### Patterns Established

- `src/agent-message-schema.ts` as single import point for all #agents embed metadata — import once, use everywhere
- `sendToAgents()` / `sendToLogs()` / `sendHealthEmbed()` naming convention for channel-targeted send functions in `src/index.ts`
- `withAgentMeta()` called last on every embed builder — append metadata, don't embed it
- IPC message types follow `agent_{noun}` naming: `agent_status`, `agent_blocker`, `agent_handoff`
- `routing_tag` column + `config/routing.json` as the pattern for any task-level routing override
- State-change-only posting (suppress `unknown→up`) as the standard for monitoring embeds

### Key Lessons

1. **Schema-first phases pay off immediately**: Phase 9 was 2 minutes of execution, but it unblocked clean, zero-rework implementations in Phases 10-13. Foundation investment is worth it.
2. **Host-side > agent-based for infrastructure work**: health monitoring, routing decisions, and lifecycle tracking all belong on the host. Agents are for reasoning tasks.
3. **Config files over code changes for routing**: `routing.json` meant digest routing was a zero-code-change feature after the column migration. Pattern reusable for any future routing needs.
4. **Yolo mode is viable for well-scoped phases**: when phase context and decisions are captured in CONTEXT.md, Claude can execute correctly without interactive approval. Quality held up (all verifications passed).

### Cost Observations

- Model mix: Opus (research/planning), Sonnet (execution)
- Sessions: estimated 3-4 sessions over 1 day
- Notable: ~114 tests written with zero flakiness reported. Verification-first approach meant no re-execution of plans.

---

## Milestone: v1.0 — Discord Integration

**Shipped:** 2026-03-27
**Phases:** 8 (1-8) | **Plans:** 15 | **Timeline:** ~1 day

### What Was Built

- Full Discord channel implementation: bot connect, inbound message handling with trigger detection and reply preview, rich outbound formatting (2000-char chunker, embeds, editMessage, sendWithButtons, sendPhoto)
- Group auto-registration on first message with human-readable folder naming and IPC authorization
- DiscordServerManager with 5 CRUD actions (create/delete/rename channels, categories, permissions)
- Webhook routing via `config/routing.json` with Zod validation, mainJid fallback, dual-send via task ID @jid suffix
- SwarmWebhookManager: Friday/Alfred with their own bot identities in Discord via webhooks, Dicebear avatars, lazy hydration
- 8 themed CLAUDE.md channel templates with Cortex knowledge references

### What Worked

- Merging from `nanoclaw-discord` remote as Phase 1 foundation — brought working code in rather than starting from scratch
- Channel template pattern (Phase 8) — simple file-based per-channel CLAUDE.md, scales to any number of channels
- IPC authorization model carried forward cleanly from Telegram — no new authorization concept needed

### What Was Inefficient

- Some worktree branch issues during execution (missing files in branch) required re-runs
- Plan checker feedback loops added latency on a few phases (12 had 2 revision cycles)

### Patterns Established

- `registerChannel()` self-registration at startup — all channels follow this pattern
- JID format: `dc:{channel_id}` for Discord channels
- `routing.json` as the single config file for webhook → channel routing

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 8 | 15 | Foundation — established channel pattern, JIDs, routing |
| v2.0 | 5 | 8 | Agent Dashboard — added schema-first approach, yolo mode execution |

### Cumulative Quality

| Milestone | Tests Added | Verification Scores | Notable |
|-----------|-------------|---------------------|---------|
| v1.0 | ~60 estimated | Not all phases verified | Some plan checker revision cycles |
| v2.0 | 114 | 8/8, 11/11, 8/8, 3/3, 11/11 | All verifications passed first time |

### Top Lessons (Verified Across Milestones)

1. **Foundation phases are worth the investment** — schema, types, and shared utilities created in early phases eliminate rework in later phases
2. **Config-driven routing beats hardcoded logic** — both `routing.json` (v1.0) and `routing_tag` (v2.0) proved that routing decisions belong in config, not code
3. **Host-side over agent-side for infrastructure** — consistently cheaper and more reliable than spinning containers for operational concerns
