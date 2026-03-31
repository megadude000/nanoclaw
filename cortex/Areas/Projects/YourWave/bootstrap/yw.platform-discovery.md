---
cortex_level: L10
confidence: high
domain: yourwave
scope: yourwave — yw.platform-discovery
type: bootstrap-extract
tags:
  - yourwave
  - bootstrap
  - platform
created: '2026-03-31'
project: yourwave
source_hash: f7ac9fd9adce3beb4727b254dfd04eef1c5586bbec2878e9b4bc41556b30a106
embedding_model: text-embedding-3-small
---
# YourWave Platform — Discovery Q&A

> Structured discovery session for YWProject v2 architecture.
> Original repo: https://github.com/megadude000/YWProject (.NET 8 + Next.js 15 + PostgreSQL)
> Goal: rebuild better, preserve all business logic, make it modular and extensible.

## Progress

| # | Category | Question | Status | Answer |
|---|----------|----------|--------|--------|
| 1 | Stack | Why was .NET clumsy? What specifically was hard to extend? | ✅ | "Все і відразу" — проблема не в файлах, а в неповороткості. Структура має бути чіткою але гнучкою. Андрій більше не пише код — тільки я, тому DX для мене важливіший за DX для людини. |
| 2 | Stack | Preferred stack for v2? (proposal: Astro+React+Supabase) | ✅ | Варіант А підходить повністю. PostgreSQL ок, але якщо є щось краще — на мій розсуд. КРИТИЧНО: максимум security — RLS, ніяких витоків персональних даних, ніяких секретів у Git. Боти можуть мати доступ до DB але не повинні експоузити sensitive дані назовні. |
| 3 | Product | Bundle Builder — what's the UX vision? | ✅ | Два режими: 1) Готові бандли (по регіону, обробці, обжарці, variety) 2) Кастомний конструктор: 3 кроки — пошук кави (фільтри) → вибір форми (drip/capsule/bag) + кількість → кошик. Прогрес-бар по грамах, знижка росте з обсягом, безкоштовна доставка як incentive. Мін. порція 30г. Без обмежень кількості — але gamification щоб купував більше. |
| 4 | Product | Subscription model — separate or part of bundle? | ✅ | Phase 2, не пріоритет зараз. Візія: і repeat bundle, і Surprise Wave (ми обираємо). Бандли мають містити бонуси: міні-журнал, стикери, шоколадки — unboxing experience. Архітектурно закласти, але не реалізовувати зараз. |
| 5 | Product | Guest Wave curators — separate product type or tag? | ✅ | Phase 3, не думати зараз. Просто не заблокувати архітектурно. |
| 6 | CRM | Who will use CRM? Solo or team? | ✅ | TEAM. Multi-tenant архітектура! Різні "інстанси" (sub-instances) під різні бізнеси: кава (кг, штуки), квіти (інші юніти, інші продукти, інший flow). Спільні інструменти, різний контент/конфіг. Платформа як SaaS для малого бізнесу. |
| 7 | CRM | Roast batch — core or Phase 2? | ✅ | Не MVP. Простий inventory спочатку (є/немає). Batch tracking як окремий модуль що легко підключити пізніше. |
| 8 | CRM | Mobile CRM needed? + Roles | ✅ | Desktop only! Якщо мобілка — показати "перейдіть на десктоп". iPad для обжарщика ок (web). Jarvis (Telegram) = notification layer: "закінчується Ефіопія", "треба заплатити за воду", трекінг всього. Окремий інтерфейс для обжарки можна потім. RBAC per module (обжарщик → batch roasting only). |
| 9 | Business | Payment provider? (Stripe/Comgate/GoPay) | ✅ | Seamless як у найкращих магазинах: Apple Pay, Google Pay, збережені карти, оплата в одне торкання. Конкретний провайдер — дослідити в Night Shift сесії. Записати findings в Notion. |
| 10 | Business | Shipping provider? (PPL/Zásilkovna/DPD/self) | ✅ | Всі! Zásilkovna, PPL, DPD, FedEx — клієнт обирає. Доставка по Європі (2-5 днів). API інтеграції через уніфікований layer. Авто-розрахунок ціни по адресу, безкоштовна доставка при великому замовленні. Окремий Integration Hub модуль в CRM — tiles для всіх підключень (payments, shipping, etc). Дослідити найкращі підходи в Night Shift. |
| 11 | Business | Multi-currency? (CZK+EUR?) | ✅ | Мультивалюта — CZK, EUR, PLN, NOK/SEK/DKK (Nordic). Продажі по всій EU. Дослідити best practices (як робить Shopify, specialty coffee shops). Night Shift research task. |
| 12 | UX | Atlas + Shop = one site or two? | ✅ | 🅰 Один сайт — yourwave.coffee. Atlas + Shop разом. Читач → покупець seamless. Один SEO домен. |
| 13 | Vision | What's the dream CRM experience? (auto-inventory? AI suggestions?) | ✅ | Ранок: дайджест від Jarvis в Telegram + окремий бот для бізнес-ops (ордери, посилки, compliance — НЕ Alfred, новий бот, потім). Dashboard: модульна система, можливо GraphQL, швидкий fetch багато даних. Модулі контекстні — Jarvis вирішує які показати сьогодні на основі поточних проблем/notifications. AI-driven dynamic dashboard. |
| 14 | Vision | What modules do you wish you had in v1? / Pain points v1 | ✅ | Головний біль = UX/UI. Дизайн без flow, безкінечні списки, не зрозуміло навіщо зайшов у секцію. ВИМОГИ: 1) Контекстна допомога — "що ви хочете зробити?" в кожній секції. 2) Compact але не тісно — не 3 продукти на екран. 3) Дистинктивні елементи (ордери, продукти чітко відрізняються). 4) Info hierarchy — мінімум на поверхні, один клік = деталі. 5) Statuses видимі одразу. 6) AI-guided navigation. ВЕЛИКИЙ Night Shift research: UI patterns для CRM, best practices, Snatch-level compact but clear design. |
| 15 | Learning | What do YOU want to learn building this? | ✅ | Дизайн-системи: що входить, як будуються, best practices, patterns. NotebookLM інтеграція: для складних концепцій — не Telegram повідомлення, а презентації / відео / інтерактивні пояснення. NotebookLM = база знань проекту + learning tool. Deep link з Telegram → NotebookLM app (вже встановлений). Кожен research має генерувати NotebookLM-ready матеріал. |
| 16 | Prototyping | Storybook for visual prototypes — deep links to specific components | ✅ | Обов'язково Storybook! Агенти працюють над візуальними компонентами → все в Storybook. Deep link прямо на потрібний компонент (не головна сторінка). Швидкий review без зайвих кліків. |
| 16b | Docs | Project wiki structure — how to organize platform docs? | 🔜 new | — |
| 17 | Integration | NotebookLM pipeline — research → presentation → deep link | 🔜 new | — |
| 18 | Design | Design system research — patterns, examples, approach | 🔜 new | — |
| 19 | Git | Branch strategy for platform dev | ✅ | Головна dev ветка (nightshift або platform-dev) → дрібніші feature branches per research/implementation. Merge назад. Не одна гігантська ветка. |
| 20 | Knowledge | Research data redundancy — зберігати в кількох місцях | ✅ | Research results → Obsidian (primary) + Notion (backup/sharing). Складна робота не повинна загубитись. |
| — | — | More questions will be added as answers reveal new areas | — | — |

## Key Findings from v1 Analysis

### Domain Model (preserve)
- Template-driven catalog (product = template + dynamic JSONB fields)
- Recipe-based inventory (material consumption per sell unit → auto availability)
- Roast batch tracking (raw kg → roasted kg conversion)
- Inventory ledger with typed transactions (Add, Reserve, Consume, Release, Adjust)
- Sell Unit as first-class entity (pod, drip, bag30, bag250) with own pricing

### Architecture (v1 — .NET 8)
- Clean Architecture: Domain → Infrastructure → Application → API
- Unit of Work + Generic Repository
- EF Core 9 + PostgreSQL + JSONB
- Next.js 15 frontend (App Router, Zustand, SWR)
- SignalR for real-time (backend only, frontend not connected)
- JWT auth (15min, no refresh tokens)
- Docker + .NET Aspire orchestration

### What was incomplete in v1
- Frontend SignalR not wired
- Auth without refresh tokens
- RabbitMQ/Redis configured but unused
- Minimal tests (2 tests)
- No payment/shipping integrations
- Bundle Builder UX not built
- Subscription logic not implemented

## Decisions (filled as we go)

| Date | Decision |
|------|----------|
| 2026-03-23 | Stack: Astro + React Islands + Supabase (PostgreSQL + Auth + RLS + Realtime + Storage) |
| 2026-03-23 | Security-first: RLS на всіх таблицях, .env не в Git, bot access з read-only views |
| 2026-03-23 | Multi-tenant SaaS: платформа з sub-instances (кава, квіти, etc.), спільні інструменти, різні юніти/продукти/flow |
| 2026-03-23 | Multi-tenant = Phase 2. Phase 1: гнучка архітектура (юніти/типи в конфізі), без хардкоду, але тільки кавовий інстанс |
| 2026-03-23 | RBAC per module: ролі визначають доступ до модулів (обжарщик → batch roasting only, owner → все) |
| 2026-03-23 | Один сайт: yourwave.coffee = Atlas + Shop. Без субдоменів. Seamless reader→buyer. |
| 2026-03-23 | NotebookLM = learning tool + knowledge base. Research → presentation/video → deep link до телефону. |
| 2026-03-23 | Проект потребує wiki-style документацію (модулі, архітектура, рішення) — не розгубити потім. |
| 2026-03-23 | Storybook обов'язковий — всі візуальні компоненти, deep links на конкретні stories для швидкого review |
