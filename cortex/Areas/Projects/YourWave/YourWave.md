---
type: project
project: YourWave
status: active
last_updated: 2026-03-26
tags: [coffee, startup, prague, ecommerce]
---

# ☕ YourWave — Project Summary

> Coffee Discovery Experience. Не просто кава — ритуал відкриття нових смаків.

## Sub-files (deep dive by domain)
- [[yw.branding]] — назва, tone of voice, продуктові лінії, дизайн
- [[yw.coffee-wiki]] — origins, постачальники зеленої кави, обжарка
- [[yw.ecommerce]] — Shopify, bundle builder, email, підписка, домен
- [[yw.market]] — CZ ринок, конкуренти, аудиторія, канали
- [[yw.ops]] — legal, HACCP, contract roasters, операції, timeline

## Platform v2 (YWProject rebuild)
- [[yw.platform-spec]] — 🏗 повна специфікація платформи v2 (Astro + Supabase + Cloudflare)
- [[yw.platform-discovery]] — 📋 discovery Q&A (20 питань, всі відповіді)
- Stack: Astro + React Islands + Supabase + Cloudflare Pages
- Domain: yourwave.uk (dev), yourwave.coffee (prod)
- Original repo: https://github.com/megadude000/YWProject

## Related Projects
- [[ContentFactory]] — Content Factory (окремий проект). Claude-orchestrated pipeline для публікації контенту. YourWave = перший клієнт.

---

## Quick Reference
Status: Phase 1 planning — contract roasting
Last merge: PR #1 merged 2026-03-26 — Night Shift v7 (38 CZ articles, GA4, sitemap, EmailCapture, 9 Storybook stories, 4 research docs)
Location: Прага, Чехія
Solo founder, budget €5–15k (still saving), timeline 6–12 міс to first sale
Notion board: https://www.notion.so/3259e7f6c2ca815785c0f9d6f6c34142

## Founder Profile
- **Income:** Full-time job (side project for now)
- **Coffee background:** Enthusiast, knows well
- **Design:** Self (Figma recommended, tool not yet chosen)
- **Legal:** S.R.O. not yet — plan closer to launch (~2 months before)
- **Ops:** Will rent space for storage/packing
- **Audience:** Starting from 0 — build NOW, don't wait for launch
- **First origin preference:** Colombia

---

## Brand

- **Назва:** YourWave ✅
- **Слоган:** "Збери свою хвилю. Відкривай нову каву кожен день."
- **Концепція:** Coffee Discovery Experience — відкриття + подарунок собі + ритуал
- **Аудиторія:** Психографічна — Coffee Explorers (не демографічна). Всі хто хоче досліджувати каву.
- **Мова:** EN (primary) + CZ (secondary)
- **Естетика:** TBD — назва є, візуальний стиль ще відкритий

## Business Model

- **Phase 1:** Contract roasting (без власного ростера)
- **Phase 2:** Aillio Bullet R2 (~€3,700) після перших продажів
- **Канали:** DTC e-shop + підписка + bundle builder
- **Формати:** зерно 200g, дріп-беги 10шт, mix box (bundle builder = core UX)

## Product Lines

| Лінія | Опис |
|-------|------|
| Wave Origins | Ротаційна колекція по країнах |
| Morning Wave | Ранковий blend, підписка |
| Explorer Wave | Discovery box, щомісячна ротація |
| Limited Wave | Мікролоти, лімітовані дропи |
| Guest Wave | Куратори: барісти, музиканти, художники |

**Phase 1 SKU:** 2–3 походження × 2 формати + 1 Starter Wave Box

---

## Market (CZ)

- Ринок: $459M (2024), 9% CAGR. Спешлті <2% → рання стадія
- 354k іноземців у Празі (1 з 4 жителів)
- Gap: English-first DTC subscription + discovery model — ніхто не займає
- Конкуренти: Mama Coffee, Doubleshot, Kofio (найближчий), MazeLab, Candy Cane

---

## Suppliers & Partners

### Contract Roasters (CZ) — Phase 1
- Chroast (Прага) — https://chroast.cz
- Industra Coffee (Брно) — https://www.industra.coffee
- The Miners (Прага) — https://theminers.eu

### Зелена кава
- Jaká káva — https://www.jakakava.cz/zelena-kava (мін. 5kg, легкий старт)
- Algrano — https://www.algrano.com (пряма торгівля з фермерами)
- Trabocca — https://www.trabocca.com (від ~60kg)
- Nordic Approach — https://www.nordicapproach.no

---

## Legal & Ops (CZ)

- Форма: S.R.O. (чеський ТОВ)
- Реєстрація: Justice.cz або Domu Tax
- Харчова безпека: SZPI реєстрація обов'язкова
- HACCP: спрощений self-declaration план
- ПДВ на каву в CZ: 12%

---

## Tech Stack

### Platform v2 (current direction)
- Frontend: Astro + React Islands + Tailwind CSS 4 + shadcn/ui
- Backend: Supabase (PostgreSQL + Auth + RLS + Realtime + Storage)
- Hosting: Cloudflare Pages
- Dev domain: yourwave.uk
- Prototyping: Storybook (mandatory, deep links)
- CRM: desktop-only, AI-driven dashboard

### Legacy (Phase 1 — deprecated)
- E-shop: Shopify Basic (~€29/міс)
- Email: Klaviyo (free до 500 контактів)
- Bundle builder: Assortion або Infinite Options app
- Analytics: GA4 + Shopify Analytics

### Coffee Atlas (YW_Core)
- Repo: `megadude000/YW_Core` (GitHub)
- Stack: Astro 6 + React 19 + Tailwind CSS 4 + shadcn/ui
- Content: MDX Content Collections (no CMS for MVP)
- Testing: Vitest (unit) + Playwright (E2E + a11y) + Storybook 10
- CI: GitHub Actions (5 jobs: build, lint, unit, e2e, a11y) — all green ✅
- Design: Variant D — Hybrid Wiki + Magazine (Stripe Press style)
- MCP: Figma, Astro Docs, shadcn/ui — all connected

---

## Notion Board

DB ID: `3259e7f6-c2ca-8157-85c0-f9d6f6c34142`

| Task | Page ID |
|------|---------|
| 📊 Бізнес-план | 3259e7f6-c2ca-8109-9a1c-d4b12d930aa9 |
| ⚖️ Юридична база | 3259e7f6-c2ca-8128-a6af-c0d1022c5c13 |
| ☕ Продукт/постачання | 3259e7f6-c2ca-814c-a73d-f81cef920cf3 |
| 📣 Маркетинг | 3259e7f6-c2ca-813e-9b80-db643b72092f |
| 💻 Цифрова платформа | 3259e7f6-c2ca-8115-88f9-e035c72d4586 |

---

## Pending Tasks

### Next 30 days (priority)
- [ ] Відкрити Instagram @yourwave.coffee — перший пост (brand building від сьогодні)
- [ ] Написати Chroast, Industra, The Miners — умови contract roasting (MOQ, ціна/kg)
- [ ] Зареєструвати домен yourwave.coffee (перевірити доступність)

### Next 3 months
- [ ] Вибрати перший origin: Colombia — знайти постачальника (Jaká káva або Algrano)
- [ ] Фінансова модель — unit economics spreadsheet
- [ ] Вибрати design tool (Figma) + почати brand identity
- [ ] Shopify store — базове налаштування

### Before launch (~2 months prior)
- [ ] Зареєструвати S.R.O. (Domu Tax або Justice.cz)
- [ ] SZPI реєстрація
- [ ] Орендувати простір для зберігання/пакування

---

## Decisions Log

| Date | Decision |
|------|----------|
| 2026-03-16 | Назва YourWave підтверджена |
| 2026-03-16 | Phase 1 = contract roasting (гнучко переглянути після перших продажів) |
| 2026-03-16 | Аудиторія психографічна, не демографічна — Coffee Explorers |
| 2026-03-16 | Bundle builder = core UX |
| 2026-03-17 | Notion board оновлено з форматуванням + посиланнями |
| 2026-03-19 | Atlas design: Variant D — Hybrid Wiki + Magazine (Stripe Press style) |
| 2026-03-19 | MVP content: MDX files in repo (no Notion CMS) |
| 2026-03-19 | YW_Core repo initialized, scaffolded, pushed to GitHub |
| 2026-03-20 | Full testing stack added + CI pipeline — all 5/5 jobs green |
| 2026-03-20 | CI notifications: webhooks preferred over polling |
| 2026-03-23 | Platform v2: Astro + React Islands + Supabase (replaces .NET + Shopify) |
| 2026-03-23 | Security-first: RLS, no secrets in Git, bot access via read-only views |
| 2026-03-23 | Bundle Builder = core UX: preset bundles + custom 3-step constructor |
| 2026-03-23 | Multi-tenant SaaS vision (Phase 2), Phase 1 = flexible single-tenant |
| 2026-03-23 | RBAC per module, Desktop-only CRM, Jarvis = notification layer |
| 2026-03-23 | Один сайт: Atlas + Shop on yourwave.coffee |
| 2026-03-23 | Storybook mandatory, deep links for component review |
| 2026-03-23 | yourwave.uk domain bought, Cloudflare MCP integrated |
