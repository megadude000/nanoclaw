---
type: reference
project: NightShift
updated: 2026-04-04T12:00:00.000Z
source_hash: 87a85deb31af8909e72b3a36c94a09604e21fd6517799c78b21266d0e9fa6401
embedding_model: text-embedding-3-small
---

# Cron Registry

All scheduled tasks, their IDs, and purposes. Update this when adding/removing crons.

## Active Crons

| ID | Name | Schedule | Purpose |
|---|---|---|---|
| `task-1774162939070-5jalv0` | Morning Digest | `27 7 * * *` (7:27 щодня) | Ранковий дайджест: AI + світ + кава + проєкти + пошта. Від Jarvis (без sender) |
| `task-1774208291143-izq9my` | NightShift Health | `0 12 * * *` (12:00 щодня) | Jarvis cron health check — перевіряє нічну зміну |
| `task-1774208307200-ikra4w` | NightShift Planning | `3 21 * * *` (21:03 щодня) | Planning v5 (Learning-Aware). Sender: Friday |
| `task-1774208273081-5cy9lt` | NightShift Execution | `27 23 * * *` (23:27 щодня) | Execution v9 — GSD + Freestyle + Cortex. Friday + Alfred до 06:00 |
| `task-1775082456194-3k2tnd` | Gemini Health Check | `30 10 * * *` (10:30 щодня) | Перевіряє статус Gemini API ключа |
| `task-1775082459285-up6nxi` | Weekly DB Cleanup | `0 4 * * 0` (04:00 нд) | Тижневе очищення task DB |
| `task-1775141595490-76ng8n` | autoDream | `0 */2 10-18 * * *` (кожні 2 год, 10-18) | Lightweight Cortex sync при idle — Andy |
| `task-1775141607741-l5q0h6` | KAIROS-lite Pulse | `*/30 9-20 * * *` (кожні 30 хв, 9-20) | Проактивний пульс — Andy. Перевіряє CI, email, сигнали |
| `task-1775296976243-1nvfn0` | Post-Nightshift Reflection | `45 0 * * *` (00:45 щодня) | Andy рефлектує підсумки нічної зміни |
| `task-1775151071703-smltfx` | Weekly Behavioral Fingerprint | `0 15 * * 0` (15:00 нд) | Andy будує поведінковий профіль користувача |
| `task-1775296967500-kl0nir` | KAIROS-Night Supervisor | `15 0,1,2,3,4,5,23 * * *` (:15 о 23-05) | Andy наглядає за нічною зміною, watchdog + context |

## Cancelled / Removed

| ID | Name | Reason | Date |
|---|---|---|---|
| `task-1774416957389-v7z49y` | Image Gen (09:05) | Hitting Imagen 4 API limit loop | 2026-03-25 |
| `task-1774415590454-4fow7s` | Image Gen (04:00 next day) | Hitting Imagen 4 API limit loop | 2026-03-25 |
| `task-1774298856547-uqwnhl` | NightShift Approval | Replaced by KAIROS-night supervisor flow | 2026-04-02 |
| `task-1774345803544-9t2rse` | NightShift Watchdog | Replaced by KAIROS-Night Supervisor (task-1775159671907) | 2026-04-02 |

## Completed (one-shot, inactive)

| ID | Purpose | Status |
|---|---|---|
| `github-ci-23338277509` | GitHub Actions workflow | completed |
| `notion-comment-3269e7f6-...` | Notion task processing | completed |

## Rules

- *Digest* — від Jarvis (без sender param), з WebSearch для новин, посилання вбудовані в текст
- *NightShift* — ЩОДНЯ. Planning 21:03 → Execution 23:27 → KAIROS-Night :15 о 23-05 → Health Check 12:00. Sender = Friday (назва бота, НЕ день тижня)
- *Sender usage* — Friday = code & docs bot. Alfred = research & ideas bot. Jarvis = orchestrator + digest (без sender). Andy = orchestrator/main
- *KAIROS features* — autoDream (idle Cortex sync), KAIROS-lite (daytime pulse), KAIROS-night (overnight supervisor)
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
| 2026-04-02 | Added: KAIROS suite — autoDream, KAIROS-lite pulse, post-nightshift reflection, weekly fingerprint, KAIROS-night supervisor. Removed Approval + Watchdog (superseded) |
| 2026-04-03 | autoDream sync: updated registry to reflect live cron state (11 active) |
