---
cortex_level: L20
confidence: high
domain: nightshift
scope: nightshift — cron-registry
type: bootstrap-extract
tags:
  - nightshift
  - bootstrap
  - ops
created: '2026-03-31'
project: nightshift
source_hash: 243191519361c287126a211516aa9277505332e2dc0cabd6527d990682a7aca5
embedding_model: text-embedding-3-small
---
# Cron Registry

All scheduled tasks, their IDs, and purposes. Update this when adding/removing crons.

## Active Crons

| ID | Channel | Schedule | Purpose |
|---|---|---|---|
| `task-1774162939070-5jalv0` | Telegram | `27 7 * * *` | Morning Digest: AI + world + coffee + projects + mail. From Jarvis (no sender) |
| `task-1774208291143-izq9my` | Telegram | `0 12 * * *` | NightShift Health — checks cron registry, verifies active tasks |
| `task-1774208307200-ikra4w` | Telegram | `3 21 * * *` | NightShift Planning (v5 Learning-Aware) — Jarvis writes shared markdown plan to `nightshift/plans/YYYY-MM-DD.md` |
| `task-1774208273081-5cy9lt` | Telegram | `27 23 * * *` | NightShift Execution (v9 GSD+Freestyle+Cortex) — Jarvis executes tonight's plan |
| `task-1775296967500-kl0nir` | Discord | `15 0,1,2,3,4,5,23 * * *` | KAIROS-night nightshift supervisor — watches shift progress, manages tasks |
| `task-1775296976243-1nvfn0` | Discord | `45 0 * * *` | Post-nightshift reflection — Andy reviews shift outcomes at 00:45 |
| `task-1775141607741-l5q0h6` | Telegram | `*/30 9-20 * * *` | KAIROS-lite proactive pulse — daytime check-ins every 30 min |
| `task-1775141595490-76ng8n` | Telegram | `0 */2 10-18 * * *` | autoDream memory consolidation — idle-time Cortex sync every 2h |
| `task-1775151071703-smltfx` | Telegram | `0 15 * * 0` | Weekly behavioral fingerprint — Sunday profile analysis |
| `task-1775082459285-up6nxi` | Telegram | `0 4 * * 0` | Weekly task DB cleanup — removes old completed one-off tasks |
| `task-1775082456194-3k2tnd` | Telegram | `30 10 * * *` | Gemini API key health check — daily key validity test |

## Disabled

| ID | Name | Reason | Date |
|---|---|---|---|
| `task-1774345803544-9t2rse` | NightShift Watchdog (Telegram) | Replaced by Gruppenführer on Discord | 2026-03-28 |
| `task-1774639859806-kor3lw` | Friday Discord Planning (21:00) | Removed per-bot planning — Jarvis owns single shared plan | 2026-03-28 |
| `task-1774639859814-u5r8vi` | Alfred Discord Planning (21:01) | Removed per-bot planning — Jarvis owns single shared plan | 2026-03-28 |

## Deleted

| ID | Name | Reason | Date |
|---|---|---|---|
| `task-1774640072001-ridhd9` | Alfred Cloudflare Health (*/30) | Removed — noise, no clear owner | 2026-03-28 |
| `task-1774416957389-v7z49y` | Image Gen (09:05) | Hitting Imagen 4 API limit loop | 2026-03-25 |
| `task-1774415590454-4fow7s` | Image Gen (04:00 next day) | Hitting Imagen 4 API limit loop | 2026-03-25 |
| `task-1774298856547-uqwnhl` | NightShift Approval flow (Telegram 07:35) | Not found in active task list — presumed deleted | 2026-04-07 |
| `nanoclaw-gruppenfuhrer-v1` | Gruppenführer watchdog (Discord */2 21-5) | Not found in active task list — replaced by KAIROS-night supervisor | 2026-04-07 |
| `task-1775159671907-d5zrel` | KAIROS-night supervisor v1 (Telegram) | Paused — superseded by v2 on Discord | 2026-04-07 |
| `task-1775151050526-okyljb` | Post-nightshift reflection v1 (Telegram) | Paused — superseded by v2 on Discord | 2026-04-07 |

## Rules

- **Planning** — Jarvis writes ONE shared `nightshift/plans/YYYY-MM-DD.md`. Format: `- [ ]` checklist. No per-bot plans.
- **Bots** — Friday and Alfred are generalist. Either bot can pick any task. No role separation.
- **Gruppenführer** — reads the shared plan, assigns next `[ ]` task to idle bot, marks `[>]` in-progress. On plan exhaustion: asks Jarvis to expand from GSD backlog → Notion → cortex TODOs → free work.
- **API limits** — Gruppenführer backs off on `overloaded_error / rate_limit / 529 / quota`. Watch script also suppresses container launch on API errors (last 30 min).
- **Sender usage** — Jarvis = orchestrator + digest (no sender param). Friday + Alfred = nightshift bots (any task).
- **Tracking** — update this file whenever crons are created/removed.

## History

| Date | Change |
|---|---|
| 2026-03-22 | Created: planning (daily), execution (daily), health (daily), digest |
| 2026-03-23 | v2: Continuous 3-phase shift. Friday (code & docs) + Alfred (research & ideas) |
| 2026-03-24 | Added: Watchdog (v2) — hourly :17 from 00 to 05 |
| 2026-03-25 | Cancelled: 2 image gen tasks (API limit loop) |
| 2026-03-28 | Gruppenführer: fixed next_run=null bug (was never running). Schedule narrowed to nightshift hours only (`*/2 21-5 UTC`). Prompt translated to English. |
| 2026-03-28 | Removed per-bot Discord planning (Friday 21:00, Alfred 21:01). Jarvis now owns single shared markdown plan. |
| 2026-03-28 | Bots made generalist — no role separation. Gruppenführer handles plan exhaustion via Jarvis expansion + free work fallback. |
| 2026-03-28 | Deleted Alfred 30-min Cloudflare health check. Disabled Telegram nightshift watchdog. |
| 2026-04-07 | autoDream audit: added 7 new active crons (KAIROS-night, autoDream, KAIROS-lite, post-nightshift reflection, weekly fingerprint, DB cleanup, Gemini health). Moved NightShift Approval, Gruppenführer, and 2 paused tasks to Deleted. |
