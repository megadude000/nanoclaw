---
type: session
date: 2026-03-25
project: YourWave
topics: [storybook, merge, nightshift, crons, proactivity, quality]
status: interrupted
---

# Session: 2026-03-25 08:13 — storybook-merge-crons

## Quick Reference
Topics: storybook fix, nightshift merge, cron cleanup, proactivity feedback
Projects: YourWave, NanoClaw
Outcome: Merged nightshift branch, fixed Storybook ESM error, cancelled runaway image gen tasks
Pending: fix broken stories, remove CRM mobile stories, cron tracking file, message queue investigation

---

## Зроблено
- Merged `nightshift/2026-03-24` into `main` (20 commits, 223 files, fast-forward)
- Fixed Storybook build error: `__dirname` not defined in ESM — replaced with `fileURLToPath(import.meta.url)` in `.storybook/main.ts`
- Storybook build now succeeds (was completely broken before)
- Cancelled two runaway image generation scheduled tasks that were hitting Imagen 4 API limits
- User gave critical feedback on proactivity — need blast-radius thinking after every change

## Технічні зміни
### Storybook ESM Fix
- **Проблема:** `__dirname is not defined` — Storybook 10.3 uses ESM, `__dirname` is CJS-only
- **Фікс:** Added `fileURLToPath(import.meta.url)` + `dirname()` polyfill in `.storybook/main.ts`
- **Статус:** Build passes, runtime rendering not yet verified

### Nightshift Merge
- **Проблема:** `nightshift/2026-03-24` branch with Store+CRM prototypes needed merging
- **Фікс:** Fast-forward merge into main, no conflicts
- **Статус:** Done

## Pending / Наступні кроки
- [ ] Fix broken Storybook stories (user reported many broken)
- [ ] Remove CRM mobile viewport stories (user: "ніхто не працює в CRM із мобілок")
- [ ] Create cron tracking file — user wants all crons documented in one place
- [ ] Investigate 120+ queued messages — find source, likely orphaned crons
- [ ] Night Shift reliability — bots dying after ~10 minutes
- [ ] Centralized link system + automated validation
- [ ] Remaining Atlas image generation (~185 images)
- [ ] Embed proactivity principle in CLAUDE.md

## Технічний борг
- Storybook stories may have runtime rendering issues (build passes but not visually verified)
- Broken article references: castillo, coffee-processing, espresso, italy, single-origin, world-coffee-research
- `nightshift/2026-03-23` branch still exists, unclear if merged
- User frustrated about lack of status updates and responsiveness — MUST acknowledge and report back
