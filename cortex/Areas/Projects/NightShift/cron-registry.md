---
type: reference
project: NightShift
updated: 2026-03-28T00:00:00.000Z
source_hash: f48ef2ed5ce58986ad96db4e80baabf311aa4aeadefdd09a7ddb0d89d73762a6
embedding_model: text-embedding-3-small
---

# Cron Registry

All scheduled tasks, their IDs, and purposes. Update this when adding/removing crons.

## Active Crons

| ID | Channel | Schedule | Purpose |
|---|---|---|---|
| `task-1774162939070-5jalv0` | Telegram | `27 7 * * *` | Morning Digest: AI + world + coffee + projects + mail. From Jarvis (no sender) |
| `task-1774298856547-uqwnhl` | Telegram | `35 7 * * *` | NightShift Approval flow. Buttons, deep links. From Jarvis |
| `task-1774208291143-izq9my` | Telegram | `0 12 * * *` | NightShift Health — checks cron registry, verifies active tasks |
| `task-1774208307200-ikra4w` | Telegram | `3 21 * * *` | NightShift Planning (v4) — Jarvis writes shared markdown plan to `nightshift/plans/YYYY-MM-DD.md` |
| `task-1774208273081-5cy9lt` | Telegram | `27 23 * * *` | NightShift Execution (v7) — Jarvis executes tonight's plan via GSD |
| `nanoclaw-gruppenfuhrer-v1` | Discord `#nightshift` | `*/2 21,22,23,0,1,2,3,4,5 * * *` | Gruppenführer watchdog — assigns tasks from shared plan, handles API limits, triggers Jarvis for backlog expansion when plan is done |

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
