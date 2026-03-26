---
type: reference
project: NightShift
updated: 2026-03-25
---

# Cron Registry

All scheduled tasks, their IDs, and purposes. Update this when adding/removing crons.

## Active Crons

| ID | Name | Schedule | Purpose |
|---|---|---|---|
| `task-1774162939070-5jalv0` | Morning Digest | `27 7 * * *` (7:27 щодня) | Ранковий дайджест: AI + світ + кава + проєкти + пошта. Від Jarvis (без sender) |
| `task-1774298856547-uqwnhl` | NightShift Approval | `35 7 * * *` (7:35 щодня) | Approval flow по результатах Night Shift. Кнопки, deep links. Від Jarvis |
| `task-1774208291143-izq9my` | NightShift Health | `0 12 * * *` (12:00 щодня) | Перевіряє результати нічної зміни |
| `task-1774208307200-ikra4w` | NightShift Planning | `3 21 * * *` (21:03 щодня) | Планує задачі на нічну зміну. Sender: Friday |
| `task-1774208273081-5cy9lt` | NightShift Execution (v5) | `27 23 * * *` (23:27 щодня) | 3-фазна зміна: Planned → Autonomous → Wrap-up. Friday + Alfred до 06:00 |
| `task-1774345803544-9t2rse` | NightShift Watchdog | `17 0,1,2,3,4,5 * * *` (щогодини 00-05, :17) | Перевіряє чи Night Shift ще працює, перезапускає якщо впав |

## Cancelled / Removed

| ID | Name | Reason | Date |
|---|---|---|---|
| `task-1774416957389-v7z49y` | Image Gen (09:05) | Hitting Imagen 4 API limit loop | 2026-03-25 |
| `task-1774415590454-4fow7s` | Image Gen (04:00 next day) | Hitting Imagen 4 API limit loop | 2026-03-25 |

## Completed (one-shot, inactive)

| ID | Purpose | Status |
|---|---|---|
| `github-ci-23338277509` | GitHub Actions workflow | completed |
| `notion-comment-3269e7f6-...` | Notion task processing | completed |

## Rules

- *Digest* — від Jarvis (без sender param), з WebSearch для новин, посилання вбудовані в текст
- *NightShift* — ЩОДНЯ. Planning 21:03 → Execution 23:27 → Watchdog :17 щогодини → Health Check наступного дня 12:00. Sender = Friday (назва бота, НЕ день тижня)
- *Sender usage* — Friday = code & docs bot. Alfred = research & ideas bot. Jarvis = orchestrator + digest (без sender)
- *Tracking* — при створенні/видаленні крону ОБОВ'ЯЗКОВО оновити цей файл
- *Доступ* — цей файл доступний усім агентам через Obsidian vault: `Areas/Work/Projects/NightShift/cron-registry.md`

## History

| Date | Change |
|---|---|
| 2026-03-22 | Created: planning (daily), execution (daily), health (daily), digest |
| 2026-03-23 | Fixed: nightshift → DAILY. Friday = sender name (бот), НЕ день тижня. Digest → Jarvis, news + links |
| 2026-03-23 | v2: Continuous 3-phase shift. Friday (code & docs) + Alfred (research & ideas). Працюють до 06:00 |
| 2026-03-23 | Added: NightShift Approval (7:35) — окремий від новинного дайджесту (7:27). 🟢 safe = auto-merge, 🟡+ = approval з кнопками |
| 2026-03-24 | Added: Watchdog (v2) — щогодини :17 з 00 до 05. Detect failures + continue |
| 2026-03-25 | Cancelled: 2 image gen tasks (API limit loop). Updated all task IDs to full format |
