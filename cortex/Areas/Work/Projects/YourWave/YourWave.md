---
cortex_level: L40
confidence: high
domain: yourwave
scope: project-hub
type: project
project: YourWave
status: active
last_updated: 2026-07-19T09:30:00.000Z
tags:
  - coffee
  - startup
  - prague
  - ecommerce
source_hash: 899c9a7232c8918463ecd0b8f6355a315ce2f636cf0eeed757b6ea80fc589b04
embedding_model: text-embedding-3-small
---

# ☕ YourWave — Project Summary

> Coffee Discovery Experience. Не просто кава — ритуал відкриття нових смаків.

## Sub-files (deep dive by domain)
- [[yw.branding]] — назва, tone of voice, продуктові лінії, дизайн
- [[yw.ecommerce]] — Shopify, bundle builder, email, підписка, домен
- [[yw.market]] — CZ ринок, конкуренти, аудиторія, канали
- [[yw.ops]] — legal, HACCP, contract roasters, операції, timeline
- [[yw-core-status]] — поточний стан платформи (GSD, Atlas, blocker)
- [[milestone-2-auth-infra]] — Milestone 2: Auth + DB + Feature Flags ✅ COMPLETE (2026-04-05)
- [[gemini-api-key-status]] — ✅ Gemini API key resolved (working)

## Platform v2 (YWProject rebuild)
- Stack: Astro 6 + React 19 Islands + Supabase + Vercel adapter (SSR). Dev hosting: VPS + Cloudflare Tunnel (Pages/Workers explicitly rejected)
- CRM routing: TanStack Router island at `/crm/*`
- Domain: yourwave.uk (dev), yourwave.coffee (prod)
- Repo: `megadude000/YW_Core` (GitHub) — ⚠️ 34 commits unpushed as of 2026-07-19

## Related Projects
- [[ContentFactory]] — Content Factory. Claude-orchestrated pipeline для публікації контенту. YourWave = перший клієнт.

---

## Quick Reference
Status (business): Phase 1 planning — contract roasting
Status (platform): GSD Milestone 4 (CRM Inventory) verifying; Phase 24 (Products) merged. ⚠️ Supabase cloud PAUSED, inventory render bug open — see [[yw-core-status]]
Next focus (2026-07-19): frontend architecture refactor → Atlas engagement + Shop + Bundle Builder + working CRM
Last active branch: main @ d1ad708 (Phase 24 products module)
Location: Прага, Чехія
Solo founder, budget €5–15k (still saving), timeline 6–12 міс to first sale
Notion board: https://www.notion.so/3259e7f6c2ca815785c0f9d6f6c34142

## GSD Platform Progress
- **Milestone 1:** ✅ ALL 9 PHASES COMPLETE (as of 2026-04-01)
  - 01 Astro Foundation, 02 Shell Layout, 03 Sidebar RBAC, 04 CommandPalette
  - 05 DataTable, 06 FilterBar, 07 UI Primitives, 08 Module Registry, 09 Storybook
- **Milestone 2:** ✅ COMPLETE (2026-04-05) — Phases 10 (Vercel) ✅, 11 (Supabase Schema) ✅, 12 (Auth Pages) ✅, 13 (CRM RBAC) ✅, 14 (PostHog Feature Flags) ✅, 15 (Observability+CI/CD) ✅
- **Milestone 3 (Stripe, phases 16–19):** ⚠️ abandoned mid-flight — planning docs removed, but payments code shipped (orphaned half-build)
- **Milestone 4 (CRM Inventory, phases 20–23):** 4/4 phases complete, status `verifying` (inventory infinite-render bug still open)
- **Phase 24 (CRM Products):** merged to main via worktree (chunks 1–3)

## Coffee Atlas Status (2026-04-07)
- EN: **140 articles** ✅
- CS: **140 articles** ✅
- UK: **140 articles** ✅
- ✅ Hero images generated for all articles (Imagen 4 Fast)
- ✅ 30 inline figures generated (2026-04-02)
- ⚠️ Audio generation not started

## Founder Profile
- Income: Full-time job (side project)
- Design: Self (Figma TBD)
- Legal: S.R.O. not yet — plan ~2 months before launch
- First origin preference: Colombia

---

## Brand

- **Назва:** YourWave ✅
- **Слоган:** "Збери свою хвилю. Відкривай нову каву кожен день."
- **Концепція:** Coffee Discovery Experience
- **Аудиторія:** Coffee Explorers (психографічна)
- **Мова:** EN (primary) + CS + UK (secondary)

## Business Model

- Phase 1: Contract roasting (без власного ростера)
- Phase 2: Aillio Bullet R2 (~€3,700) після перших продажів
- Канали: DTC e-shop + підписка + bundle builder
- Bundle builder = core UX (preset bundles + custom 3-step constructor)

## Product Lines

| Лінія | Опис |
|-------|------|
| Wave Origins | Ротаційна колекція по країнах |
| Morning Wave | Ранковий blend, підписка |
| Explorer Wave | Discovery box, щомісячна ротація |
| Limited Wave | Мікролоти, лімітовані дропи |
| Guest Wave | Куратори: барісти, музиканти, художники |

---

## Market (CZ)

- Ринок: $459M (2024), 9% CAGR. Спешлті <2% → рання стадія
- 354k іноземців у Празі (1 з 4 жителів)
- Gap: English-first DTC subscription + discovery model — ніхто не займає
- Конкуренти: Mama Coffee, Doubleshot, Kofio (найближчий), MazeLab, Candy Cane

---

## Suppliers & Partners

### Contract Roasters (CZ)
- Chroast (Прага) — https://chroast.cz
- Industra Coffee (Брно) — https://www.industra.coffee
- The Miners (Прага) — https://theminers.eu

### Зелена кава
- Jaká káva — https://www.jakakava.cz/zelena-kava
- Algrano — https://www.algrano.com
- Trabocca — https://www.trabocca.com
- Nordic Approach — https://www.nordicapproach.no

---

## Legal & Ops (CZ)

- Форма: S.R.O. (чеський ТОВ)
- Реєстрація: Justice.cz або Domu Tax
- SZPI реєстрація обов'язкова, ПДВ на каву: 12%

---

## Pending Tasks

### Platform
- [ ] Generate remaining inline figures — `gen_remaining.py` at `/workspace/group/nightshift/gen_remaining.py`
- [x] ~~Plan + execute Milestone 2~~ — ✅ COMPLETE 2026-04-05
- [ ] Plan Milestone 3 (next phase TBD)

### Business
- [ ] Instagram @yourwave.coffee — перший пост
- [ ] Написати Chroast, Industra, The Miners — умови contract roasting
- [ ] Зареєструвати домен yourwave.coffee

---

## Decisions Log

| Date | Decision |
|------|----------|
| 2026-03-16 | Назва YourWave підтверджена |
| 2026-03-16 | Phase 1 = contract roasting |
| 2026-03-19 | Atlas design: Variant D — Hybrid Wiki + Magazine |
| 2026-03-19 | YW_Core repo initialized, scaffolded |
| 2026-03-20 | CI pipeline — all 5/5 jobs green |
| 2026-03-23 | Platform v2: Astro + React Islands + Supabase |
| 2026-03-23 | Security-first: RLS, no secrets in Git |
| 2026-03-23 | Storybook mandatory, deep links |
| 2026-04-01 | GSD Milestone 1 complete — all 9 CRM phases shipped |
| 2026-04-01 | Atlas: 102 articles per locale (EN/CS/UK) |
| 2026-04-01 | Milestone 2 unblocked |
| 2026-04-02 | Atlas: 114 articles per locale; Getting Started category added |
| 2026-04-02 | Phase 12 (Auth) + Phase 13 (CRM RBAC) complete — nightshift/2026-04-02 |
| 2026-04-03 | Test suite: 299 passing / 0 failing |
| 2026-04-03 | Atlas: 117 articles per locale; 3 new articles merged to main 09:05 |
| 2026-04-05 | GSD Milestone 2 complete — Phase 14 (PostHog) + Phase 15 (Observability+CI/CD) shipped |
| 2026-04-05 | Atlas: 123 articles per locale — batch 3 (+6/locale) with Imagen 4 hero images |
| 2026-04-05 | Test suite: 371 passing / 0 failing — branch nightshift/2026-04-05 |
| 2026-04-06 | PR #18 (nightshift/2026-04-05) merged to main; +36 tests (Users module, useUsers hook, computeMetrics) |
| 2026-04-07 | Atlas: 140 articles per locale (+17 batch: tasting-wheel, whole-bean, cleaning, certifications, aeropress, siphon, moka-pot, cold-brew × 3 locales) |
| 2026-04-07 | Test suite: 409 passing / 0 failing — branch nightshift/2026-04-07 |
| 2026-04-07 | CRM a11y fixes; gen_remaining.mjs (Node.js, no pip) preferred over .py wrapper |
| 2026-07-19 | Docs refreshed after 3.5-month gap. Verified: Supabase cloud paused, local stack adopted for dev; Milestone 3 payments = orphaned; Milestone 4 verifying; Phase 24 merged. New goal set: frontend refactor → Atlas+Shop+Bundle Builder+CRM |
