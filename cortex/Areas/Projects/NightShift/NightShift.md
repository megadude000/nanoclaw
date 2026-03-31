---
type: project
cortex_level: L20
confidence: high
domain: nanoclaw
scope: Night Shift autonomous overnight work system hub
project: NightShift
status: active
created: 2026-03-22
updated: 2026-03-31
tags: [automation, nightshift, jarvis]
---

# Night Shift

Autonomous overnight work system. Jarvis executes tasks from 23:30 to 06:00 while the user sleeps, producing a summary report in the morning.

## Quick Reference

- Runtime: `/workspace/group/nightshift/`
- Plans: `/workspace/group/nightshift/plans/YYYY-MM-DD.json`
- Results: `/workspace/group/nightshift/results/YYYY-MM-DD/`
- Logs: `/workspace/group/nightshift/logs/YYYY-MM-DD.md`
- Learning data: `/workspace/group/nightshift/learning.json`
- Config: `/workspace/group/nightshift/config.json`
- Planning cron: 21:03 daily
- Execution cron: 23:27 daily
- Health check: 12:00 daily (auto-reinstalls expired crons)

## How It Works

See [[nightshift.architecture]] for full technical spec (v2).

## Key Features (v2)

- **Continuous shift** — 3 phases: Planned Work → Autonomous Improvement → Wrap-up. Bots work until 06:00, not just until plan is done
- **Two bots** — Friday (code & docs) + Alfred (research & ideas) work in parallel
- **Jarvis as Orchestrator** — not passive cron launcher, but active librarian: dispatches, monitors, regroups, archives
- **Phase 2: Wind Rose** — bots scan project axes (content, code, design, SEO, infra, funding, marketing, docs), work on weakest
- **Documentation steward** — Friday actively finds stale docs, outdated READMEs, misaligned ideas and fixes them
- **Change Approval Tiers** — 🟢 auto-approve (safe), 🟡 flag for review (moderate), 🔴 require approval (ground-shifting)
- **Morning Review** — structured approval flow with merge/cherry-pick/reject options
- **Git branch isolation** — all work on `nightshift/YYYY-MM-DD`, user merges in morning
- **Warm-up task** — always starts with build/env check before real work
- **Quality gates** — per-task-type validation before marking "done"
- **Circuit breakers** — max 2 retries/task, 3 consecutive fails = halt, manual STOP file
- **Learning loop** — tracks actual vs estimated time, refines future estimates
- **Rollback** — `git branch -D nightshift/YYYY-MM-DD` to undo entire shift

## Cortex Maintenance (Fallback Activity)

When no planned tasks, GSD backlog items, or Notion tasks remain, include Cortex reconciliation as a maintenance activity. The agent should send an IPC message with `type: "cortex_reconcile"` to trigger host-side reconciliation. This checks for:
- Stale entries past their TTL (L10=14d, L20=30d, L30=60d, L40=90d, L50=180d)
- Semantically similar entries that should be CROSS_LINKed
- Orphan entries with no graph edges and incomplete frontmatter

The host runs reconciliation and posts a summary to #agents automatically. No new cron entries are needed -- this integrates into the existing 21:03 planning / 23:27 execution cycle as a fallback when the idea pool is empty.

## Current Status

- [x] Architecture v1 designed + first shift completed (2026-03-22)
- [x] Architecture v2: continuous shift, 2 bots, 3 phases (2026-03-23)
- [x] Runtime directories + config + learning.json created
- [x] Project docs written (hub + architecture spec v2)
- [x] All crons updated: planning, execution (v2), health check
- [x] First shift completed: 23/23 articles, 0 failures
- [x] v2.1: Orchestrator role, Wind Rose, Approval Tiers (2026-03-23)
- [x] Morning Approval Flow — separate digest (7:35), expandable blocks, buttons per category
- [x] Cloudflare Tunnel setup (storybook.yourwave.uk + dev.yourwave.uk) — tunnels not hosting
- [x] Auto-merge for 🟢 safe tasks (translations, articles)
- [x] Both bots write articles + prototypes + docs in Phase 2
- [x] Cron: Night Shift Approval at 7:35 daily
- [ ] First v2 shift (with Phase 2 autonomous work) — scheduled tonight 23:30

## Decisions Log

| Date | Decision |
|------|----------|
| 2026-03-22 | Self-scheduling loop (Variant 1) over supervisor+workers |
| 2026-03-22 | Circuit breakers: max 2 retries per task, 3 consecutive fails = halt |
| 2026-03-22 | Planning at 21:00 with buttons, execution at 23:30 |
| 2026-03-22 | If user doesn't respond to planning prompt, Jarvis picks from TODO autonomously |
| 2026-03-22 | Git branch isolation — all work on nightshift/YYYY-MM-DD, user merges in morning |
| 2026-03-22 | Warm-up task always first — halt if environment broken |
| 2026-03-22 | Quality gates per task type — validation before "done" |
| 2026-03-22 | Difficulty estimation S/M/L with learning loop for accuracy |
| 2026-03-22 | Priority ordering: critical → high → normal |
| 2026-03-22 | Progress notification at ~50% completion |
| 2026-03-22 | Crons auto-expire in 3 days — health check at 12:00 reinstalls |
| 2026-03-23 | v2: Continuous shift — 3 phases, bots work until 06:00 not just until plan done |
| 2026-03-23 | v2: Two bots — Friday (code & docs) + Alfred (research & ideas) |
| 2026-03-23 | v2: Phase 2 autonomous — bots generate own tasks after plan complete |
| 2026-03-23 | v2: Friday as Documentation Steward — finds stale docs, keeps alignment |
| 2026-03-23 | Schedule: DAILY (not Friday-only). "Friday" = bot name, not day of week |
| 2026-03-23 | v2.1: Jarvis = Orchestrator/Archivist — active monitoring, not passive cron |
| 2026-03-23 | v2.1: Wind Rose — 8 project axes, bots work on weakest autonomously |
| 2026-03-23 | v2.1: 3-tier approval — 🟢auto 🟡review 🔴proposal. Ground-shifting = strictly approved |
| 2026-03-23 | v2.1: Morning Review flow — structured merge/cherry-pick/reject with buttons |
| 2026-03-23 | Two separate digests: 7:27 news (isolated) + 7:35 Night Shift approval (group) |
| 2026-03-23 | 🟢 Safe = AUTO-MERGE, no approval needed. Only 🟡+ needs buttons |
| 2026-03-23 | Cloudflare Tunnel for dev sites — tunnels not hosting. Rebuild after each shift |
| 2026-03-23 | Both bots (Friday + Alfred) write articles, prototypes, docs in Phase 2 |
| 2026-03-23 | Expandable blocks (`<blockquote expandable>`) mandatory for lists > 5 items |
