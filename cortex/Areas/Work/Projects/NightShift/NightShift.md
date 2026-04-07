---
cortex_level: L40
confidence: high
scope: automation-system
domain: nightshift
type: project
status: active
created: 2026-03-22T00:00:00.000Z
updated: 2026-04-07T03:00:00.000Z
tags:
  - automation
  - nightshift
  - jarvis
source_hash: c9ebcf5b750388b672bfdd5c3951771e9ccf95dcc25633b8d5306e65b1317a2b
embedding_model: text-embedding-3-small
---

# Night Shift

Autonomous overnight work system. Jarvis executes tasks from 23:27 to 05:30 CET while the user sleeps.

## Quick Reference

- Plans: `/workspace/group/nightshift/plans/YYYY-MM-DD.md` (+ .json archive)
- Logs: `/workspace/group/nightshift/logs/YYYY-MM-DD.md`
- Learning: `/workspace/group/nightshift/learning.json`
- Config: `/workspace/group/nightshift/config.json`

### Cron Schedule (2026-04-01)
| Task | Cron | ID | Status |
|------|------|----|--------|
| Morning Digest | 7:27 daily | `task-1774162939070-5jalv0` | ✅ active |
| NightShift Planning | 21:03 daily | `task-1774208307200-ikra4w` | ✅ active |
| NightShift Execution | 23:27 daily | `task-1774208273081-5cy9lt` | ✅ active |
| NightShift Health | 12:00 daily | `task-1774208291143-izq9my` | ✅ active |
| Gruppenführer | */2 21-05h | `nanoclaw-gruppenfuhrer-v1` | ✅ active |
| Watchdog | 0-5h :17 | `task-1774345803544-9t2rse` | ❌ disabled |

Planning task skips if today's `.md` plan already exists — user can pre-create plan to control tasks.
Gruppenführer (every 2 min) effectively replaces the disabled Watchdog.

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

## Current Status (2026-04-05)

- [x] Architecture v1–v7 — COMPLETE
- [x] 10+ shifts executed since 2026-03-22
- [x] First shift: 23 articles, 0 failures (2026-03-22)
- [x] First v2 shift with Phase 2 autonomous work — DONE (2026-03-23)
- [x] GSD Milestone 1: ALL 9 PHASES COMPLETE via night shifts
- [x] GSD Milestone 2: ALL 6 PHASES COMPLETE (2026-04-05) — incl. PostHog + Observability/CI
- [x] Atlas: 0 → 140 articles per locale (EN/CS/UK) as of 2026-04-07
- [x] Gruppenführer covers watchdog role
- [ ] Watchdog cron disabled — not critical (Gruppenführer covers)
- [ ] PR for nightshift/2026-04-01 not yet created

## Shift History (key milestones)

| Date | Key Output |
|------|------------|
| 2026-03-22 | First shift — 23 articles, architecture v1 |
| 2026-03-23 | v2: continuous shift, 2 bots, Phase 2 autonomous |
| 2026-03-28 | Phase 04 CommandPalette |
| 2026-03-31 | Phase 05 DataTable + Phase 06 FilterBar; EN→102, CS/UK→97 |
| 2026-04-01 | Phase 07+08+09 complete; CS/UK→102; Cortex reconciliation |
| 2026-04-02 | Phase 10–13 complete: Vercel adapter, Supabase schema+RLS, Auth pages, RBAC wiring; Atlas→114/locale; 299 tests passing |
| 2026-04-03 | Atlas +3 articles/locale (→117): coffee-acidity-chemistry, green-coffee-storage, coffee-tasting-glossary; merged to main 09:05 |
| 2026-04-05 | GSD M2 complete: Phase 14 (PostHog feature flags, 4/4 verified) + Phase 15 (Observability+CI/CD, 6/6 verified); Atlas +6/locale (→123); 371 tests passing |
| 2026-04-06 | PR #18 (nightshift/2026-04-05) merged to main; +36 tests (Users module, useUsers hook, computeMetrics) |
| 2026-04-07 | Atlas +17/locale (→140): 8 new articles (tasting-wheel, whole-bean, cleaning, certifications, aeropress, siphon, moka-pot, cold-brew) × 3 locales; CRM a11y fixes; 409 tests passing |

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
