---
type: session
date: 2026-03-25
project: YourWave
topics: [quality-gates, broken-links, storybook, nightshift, image-generation, development-principles]
status: completed
---

# Session: 2026-03-25 06:56 — quality-gates

## Quick Reference
Topics: broken links fix, storybook fix, nightshift reliability, development principles, impact analysis
Projects: YourWave
Outcome: Fixed all broken atlas links (6 categories), fixed Storybook @/ alias, rewrote Night Shift execution v5 with quality gates, established "Impact Analysis" as core development principle
Pending: ~195 atlas images remaining (Night Shift over 3 nights), merge nightshift branches when ready

---

## Зроблено

### Broken Atlas Links — Centralized Fix
- `/atlas/espresso` → `/atlas/espresso-method` (16 EN + UK articles)
- `/atlas/coffee-processing` → `/atlas/what-is-processing` (catuai)
- `/atlas/single-origin` → `/atlas/what-is-origin` (aeropress)
- Removed links to non-existent articles: `castillo`, `italy`, `world-coffee-research` (converted to plain text)
- Created `scripts/validate-links.ts` — build-time validator, checks all internal links + related frontmatter
- Result: 114 articles, 0 broken links ✅

### Storybook Fixes
- **@/ alias broken** — added `viteFinal` с Vite alias config до `.storybook/main.ts`
- **CRM mobile variants** — видалив Mobile/Tablet stories з Dashboard, Customers, Orders, Products (CRM = desktop only)

### Night Shift Reliability
- **Root cause found**: планувальник (21:03) впав з "hit your limit" → план не створився → виконавець (23:27) побачив "no plan" і вийшов → watchdog мовчав
- **Execution v5**: НІКОЛИ не виходить рано. Без плану → автономна робота до 05:30
- **Watchdog v2**: детектить коли боти зупинились, перезапускає autonomous work
- **Quality Gate**: build + link validator обов'язкові перед КОЖНИМ комітом (в промпті)
- `no_paid_apis: false` — дозволено Imagen API для генерації картинок

### Development Principle — Impact Analysis
- User feedback: якість поганіє бо нема side-effect awareness
- Проблема: "done" = "код написаний", а не "працює і не зламало інше"
- **Принцип**: після КОЖНОЇ зміни → зупинись → подумай що зачепив → перевір blast radius → пофікси → ТОДІ done
- Записано в `YW_Core/CLAUDE.md` і `cortex/CLAUDE.md`
- Це НЕ чеклист, а спосіб мислення — щоразу інший набір перевірок

## Технічні зміни

### validate-links.ts
- **Що:** Build-time скрипт перевірки всіх internal atlas links
- **Як:** Зчитує slugs з `src/content/atlas/en/` та `uk/`, сканує markdown links + related frontmatter
- **Режими:** звичайний (report) і `--strict` (exit 1 для CI)
- **Статус:** працює, 0 broken links

### .storybook/main.ts
- **Проблема:** `@/` imports не резолвились → 6 shared component stories broken
- **Фікс:** додав `viteFinal` з `resolve.alias: { '@': resolve(__dirname, '..', 'src') }`

### Night Shift cron prompts
- **Execution** (task-...-5cy9lt): v4→v5, додано fallback на autonomous + quality gate
- **Watchdog** (task-...-9t2rse): v1→v2, детектує ранні зупинки, запускає autonomous work
- **Config**: `no_paid_apis: true → false`

### CLAUDE.md (project)
- Створено `/workspace/host/YW_Core/CLAUDE.md`
- Impact Analysis principle замість static checklist
- Atlas URL rules, Storybook notes, tech stack

### CLAUDE.md (cortex)
- Оновлено Development Principles секцію
- "Надо робити добре. Погано воно само вийде." — impact analysis мислення

## Pending / Наступні кроки
- [ ] ~195 atlas images залишилось (70/day quota, ~3 ночі через Night Shift)
- [ ] Перевірити що Night Shift v5 працює сьогодні ввечері
- [ ] 7 articles мають broken image paths (bourbon, brazil, burundi, catuai, caturra, chemex, coffee-belt) — картинки ще не згенеровані

## Технічний борг
- Playwright broken in Docker (SIGTRAP crash with /usr/bin/chromium)
- Imagen 4 paid_tier_1 = 70 images/day limit (need upgrade for faster gen)
- Storybook default example stories (Button, Header, Page) — можна видалити
