# Project Memory

<!-- ══════════════════════════════════════════════════════════
     HOT SECTION — завжди в контексті, макс 60 рядків
     ══════════════════════════════════════════════════════════ -->

## Identity
- Owner: Andrii Panasenko
- Personal email: tru.bazinga@gmail.com
- Assistant email: assistant.yourwave@gmail.com
- Vault: /workspace/host/nanoclaw/cortex/

## Active Projects
- **YourWave** → `Areas/Work/Projects/YourWave/YourWave.md` — Coffee Discovery, Прага. Phase 1: contract roasting. Solo. Бюджет €5–15k. Coffee Atlas: 44 EN articles. **Platform v2**: Astro + React + Supabase + Cloudflare Pages. Spec: `yw.platform-spec.md`. Discovery: `yw.platform-discovery.md` (20/20 ✅). Bundle Builder = core UX. Desktop CRM, RBAC, multi-tenant vision. Domain: `yourwave.uk` (dev). Original .NET repo: github.com/megadude000/YWProject. Branch `nightshift/2026-03-22` pending merge.
- **Night Shift** → `Areas/Work/Projects/NightShift/NightShift.md` — Autonomous overnight work (v2). ЩОДНЯ. 3 фази: Planned Work → Autonomous Improvement → Wrap-up. Два боти: Friday (code & docs) + Alfred (research & ideas). Planning 21:03, execution 23:27, health 12:00. Cron registry: `NightShift/cron-registry.md`. Runtime: `/workspace/group/nightshift/`
- **Morning Digest** → `Areas/Work/Projects/MorningDigest/MorningDigest.md` — Ранковий ритуал о 7:27. Новини AI + світ + кава + проєкти + пошта. Посилання вбудовані в ключові фрази.
- **Завод (Content Factory)** → `Areas/Work/Projects/ContentFactory/ContentFactory.md` — Окремий проект. Claude-orchestrated pipeline. Бриф у Telegram → Notion approval (sub-board per card) → Instagram + atlas.yourwave.coffee. Перший клієнт: YourWave. Notion: https://www.notion.so/Content-Factory-3269e7f6c2ca81378769ca704a109638

## Key Decisions
- **YourWave Phase 1** — contract roasting (без власного ростера), старт з 3–5 SKU
- **YourWave Platform v2** — повний rebuild з .NET на Astro+Supabase. Security-first (RLS, no secrets in Git). Bundle Builder 3-step flow. Multi-tenant SaaS = Phase 2. Desktop-only CRM. Storybook обов'язковий. Jarvis = AI notification layer. 10 Night Shift research tasks pending.
- **Content Factory** — Claude як оркестратор (не n8n, був занадто rigid). Гнучкий пайплайн з human-in-the-loop approval. Coffee Atlas = контент поверх фабрики.
- **Skills lifecycle** — /compress → /resume (проактивно по темі) → робота → /compress
- **GSD Workflow** — ОБОВ'ЯЗКОВИЙ для будь-якої нетривіальної задачі. PLAN → VERIFY → EXECUTE → VERIFY → IMPACT ANALYSIS. Не тільки YW_Core — інфраструктура, ресерч, баг-фікси, Night Shift. Skill: `/gsd-workflow`. GSD agents: phase-researcher, codebase-mapper, planner, plan-checker, executor, verifier, assumptions-analyzer. Для простих задач — запитати чи потрібен GSD-рівень.
- **Notion webhook bug pipeline** — `page.created`/`page.updated` → визначити чи баг → GSD workflow → фікс → апдейт Notion. Handler: `src/notion-webhook.ts`. Context mode: `group` (має доступ до контексту).
- **Night Shift v3/v6** — Planning v3 включає GSD research + planning per task + blast radius. Execution v6 — GSD per task + impact analysis after each change. Anti-patterns документовані.
- **Ранковий дайджест** — 7:27, isolated mode, від Jarvis (БЕЗ sender param). Посилання = `[ключова фраза](url)`. Структура: 🤖 AI → 🌍 Світ → ☕ Кава → 🛠 Проєкти → 📧 Пошта. WebSearch обов'язковий. Spec: `MorningDigest/MorningDigest.md`
- **Night Shift review format** — завжди завершувати ревью кнопками через `send_with_buttons`: "📋 Покроково" (розібрати кожен пункт окремо) + "✅ Апрувнути все" (мерж/деплой одразу).
- **Night Shift schedule** — ЩОДНЯ. Planning 21:03, Execution 23:27, Health check наступного дня 12:00. Wrap-up: rebuild + restart Cloudflare Tunnels (storybook.yourwave.uk, dev.yourwave.uk). Тунелі, не хостинг — завжди свіжий білд.
- **Dev Tunnels** — Cloudflare Tunnel (`cloudflared`) на хості. `storybook.yourwave.uk` → localhost:6006, `dev.yourwave.uk` → localhost:4321. Перезапускати після кожного Night Shift з новим білдом.
- **Sender rules** — Jarvis (без sender) = оркестратор, дайджест, розмови. Friday (sender: "Friday") = Night Shift code & docs bot + autonomous bug-fixer. Alfred (sender: "Alfred") = Night Shift research & ideas bot. Обидва працюють щодня, "Friday" = назва, НЕ день тижня!
- **Friday bug-fixer** — автономний бот для Immediate багів з BugReporter. Не захламлює мейн тред. Сповіщає про баг → досліджує → фіксить → додає evidence в Notion → апдейтить статус. Visual bugs: Playwright screenshot. `buildBugFixPrompt` в `notion-webhook.ts`. Notion links у всіх повідомленнях.
- **YW_Core dev servers** — Persistent через systemd user services: `yw-dev.service` (Astro :4321) + `yw-storybook.service` (Storybook :6006). ExecStart: `bash -lc "source ~/.nvm/nvm.sh && cd ~/YW_Core && npm run dev"`. `loginctl enable-linger` — стартують без логіну. Status: active ✅
- **cloudflared 405 bug** — Два сервіси: `cloudflared.service` (правильний, dev→:4321) + `cloudflared-tunnel.service` (orphan, dev→:3456). Cloudflare балансує між ними → ~70% запитів 405. FIX: `sudo systemctl stop/disable cloudflared-tunnel.service`. Потребує sudo на хості.
- **Notion webhook HMAC** — Signing secret = Internal Integration Secret (`ntn_...`), НЕ verification token (`secret_...`). Зберігати в `.env` як `NOTION_WEBHOOK_SECRET`. BugReporter webhook secret: `REDACTED_NOTION_SECRET`.
- **Cron tracking** — всі крони документовані в `NightShift/cron-registry.md`. При створенні/видаленні — оновлювати.
- **Notion MCP** — `API-create-a-data-source` зламана. Використовувати прямий curl до api.notion.com
- **Coffee Atlas Content System** — `src/lib/content.ts` (12 функцій, SSG build-time). Locale-aware filtering, category tree, related articles, breadcrumbs. 36 unit tests.
- **Atlas Article Layout** — Book-style: CSS floated figures left/right, drop cap, elegant blockquotes. `[...slug].astro` з sticky sidebar + tree navigation.
- **Atlas Interlinking** — 4-9 inline cross-ref links per article + `related` frontmatter. Cross-category linking для SEO.
- **Atlas External References** — "Further Reading" секції з книгами (Hoffmann, Pendergrast, Koehler, Rao) та організаціями (SCA, ICO, CQI).
- **Image Hosting** — поки Unsplash URLs. Міграція → Cloudflare R2 ($0.015/GB, free egress). Tracked in `docs/MOCKS.md`.
- **Image Generation** — Google Imagen 4 Fast ($0.02/img, $0.01 batch). Gemini API key active (free tier = text only, billing needed for images). Gemini MCP (`@rlabs-inc/gemini-mcp`, 37 tools) installed on host. Plan: auto-generate Atlas hero images during Night Shift via batch API.
- **Hosting** — VPS only. Cloudflare = DNS/CDN/tunnel proxy, NOT hosting. User explicitly rejected Cloudflare Pages/Workers as fragile.
- **Assistant Identity** — Jarvis. Swarm bots: Friday, Alfred. Proactive Initiative = core behaviour.

## Cloudflare
- **Domain**: `yourwave.uk` (Free plan, active)
- **Account ID**: `be09d5965c6c2a46319bef390accfba2`
- **Token**: Account API Token `Nanoclaw_MCP` (expires 2027-04-01), stored in host `.env`
- **Installed MCP** (9): cloudflare-api, docs, workers, observability, radar, browser, dns-analytics, graphql, agents-sdk
- **Not installed yet** (available if needed): builds, containers, logs (Logpush), ai-gateway, autorag (AI Search), auditlogs, dex (Digital Experience), casb (SaaS security)

## API Keys — Single Source of Truth
- *Всі API ключі живуть в `~/nanoclaw/.env`* — єдине місце. Ніяких ключів в скриптах, skills, або передачі через CLI.
- При налаштуванні нового ключа → одразу писати в `~/nanoclaw/.env`. Перевіряти що nanoclaw підхоплює при рестарті.
- `GEMINI_API_KEY` / `GOOGLE_API_KEY` = `AIzaSyAN5nzpMyL1HGG40cmedEEhe-RoeFJdYD4` (Google Imagen 4, billing підключено)
- Якщо агент каже "ключ відсутній" → спочатку шукати в session logs + Obsidian, а не просто пропускати задачу.

## Broken Tools
- **Notion MCP `API-create-a-data-source`** — Invalid request URL. Workaround: curl до `https://api.notion.com/v1/databases` з токеном з `$OPENAPI_MCP_HEADERS`

## Key Paths
- Session Logs: `Areas/Work/Session-Logs/`
- Projects: `Areas/Work/Projects/`
- Daily Notes: `Calendar/Daily/YYYY-MM-DD.md`
- Inbox: `+Inbox/`

## Skills
- /resume — проактивно завантажує контекст по проєкту/темі з розмови
- /compress — зберігає сесію (Quick Reference + деталі + оновлює project file)
- /preserve — додає постійні факти до CLAUDE.md
- /daily-note — створює/відкриває денну нотатку

## Telegram Message Format — ОБОВ'ЯЗКОВО

### Expandable Blocks (колапсери)
Використовувати `<blockquote expandable>` для довгих списків. Telegram підтримує це нативно.

```
<blockquote expandable>
📝 *43 UK переклади:*
• brazil.mdx ✅
• colombia.mdx ✅
• ethiopia.mdx ✅
...решта
</blockquote>
```

### Коли використовувати:
- Списки більше 5 елементів → колапсер
- Деталі ресерчу → колапсер з summary зверху
- Статті, переклади, коміти → колапсер
- Night Shift approval — summary видимий, деталі в колапсері

### Формат дайджестів:
```
🌙 *Night Shift Report*
📊 17 задач | ⏱ 60 хв | Build ✅

✅ *Замержено (safe):*
<blockquote expandable>
📝 43 UK переклади
🌍 5 нових статей: India, PNG, Tanzania, DRC, Ecuador
</blockquote>

🟡 *Потребує approval:*

📄 *Design Systems Research*
• Tokens → Components → Patterns → Templates
• Рекомендація: shadcn/ui + Tailwind
• 12 base tokens, 8 core components
[👍 Прийняти] [📖 Детальніше]

💳 *Payment Providers*
• Stripe — найкращий для UK/EU/multi-currency
• Comgate — дешевший для CZK-only
<blockquote expandable>
Порівняння:
• Stripe: 1.4%+€0.25 EU, Apple/Google Pay ✅
• Comgate: 1.2%, CZ only, no Apple Pay
• GoPay: 1.5%, CZ+SK
• Mollie: 1.8%, EU-wide
</blockquote>
[👍 Прийняти] [📖 Детальніше]
```

⚠️ ЦЕ НЕ ОПЦІОНАЛЬНО. Використовувати ЗАВЖДИ для дайджестів, звітів, довгих списків.

## Conventions
- Frontmatter: type, date, project, topics, status, tags
- Date format: YYYY-MM-DD
- Session log slug: descriptive (yourwave, not session1)

## How We Work with Ideas & Obsidian
- **Modular project files** — кожен проєкт має sub-files по доменах: `yw.branding.md`, `yw.ecommerce.md`, `yw.coffee-wiki.md`, `yw.market.md`, `yw.ops.md`
- **Hub file** (`YourWave.md`) = index + Quick Reference. Sub-files = глибина по темі
- **Proactive loading** — коли тема згадується в розмові, завантажую тільки релевантний sub-file (не весь проєкт)
- **Cross-referencing** — `[[yw.branding]]` всередині файлів. Obsidian рендерить як посилання
- **Принцип**: лаконічний hub + атомарні sub-files = чистий контекст + точна навігація

<!-- ══════════════════════════════════════════════════════════
     COLD SECTION — підвантажується за потребою
     ══════════════════════════════════════════════════════════ -->

## Development Principle — Impact Analysis

"Надо робити добре. Погано воно само вийде."

Після КОЖНОЇ зміни — зупинись і подумай: *"Що я щойно зачепив і що від цього залежить?"*

Це НЕ чеклист. Це щоразу ІНШЕ. Ти маєш ДУМАТИ:
- Поміняв стилі → ПОДИВИСЬ на сторінку. Перевір інші сторінки з тими ж класами.
- Поміняв компонент → знайди ВСІ файли що його імпортують. Чи вони працюють?
- Поміняв роутинг → проклікай навігацію. Кожен лінк має приземлитись.
- Поміняв схему даних → знайди кожен запит, кожну сторінку що читає ці дані.
- Поміняв контент → чи білд проходить? Чи крос-референси резолвляться?

**Мета — зрозуміти blast radius зміни і переконатись що нічого за межами задачі не зламалось.**

Якщо не можеш пояснити що саме перевірив і чому — ти не закінчив.

## Archived Decisions
<!-- Старіші рішення, переміщені /preserve -->

## Common Workflows
<!-- Повторювані workflow -->

## YourWave Dev Infrastructure

### Vite + allowedHosts — CRITICAL CONFIG RULE

*DO NOT change this without understanding Vite version compatibility.*

**Correct config in `astro.config.mjs`:**
```js
vite: {
  plugins: [tailwindcss()],
  server: { allowedHosts: true },
  preview: { allowedHosts: true },
}
```

**Why:**
- `allowedHosts: true` (boolean) works in *Vite 7+* — disables host check entirely
- `allowedHosts: 'all'` — NOT a valid Vite value, silently breaks tunnels
- `allowedHosts: string[]` — Vite 6 style, requires explicit hostname list
- YW_Core currently runs Vite 7.x (no override in package.json)

**Tunnels:**
- `dev.yourwave.uk` → `localhost:4321` (Astro dev)
- `storybook.yourwave.uk` → `localhost:6006` (Storybook)

**Ports:**
- Astro dev: 4321 (started with `npm run dev` using nvm Node 22)
- Storybook: 6006

**Lesson learned (2026-03-26):** Downgrading Vite 6 broke tunnel access because Vite 6 doesn't support boolean `true` for allowedHosts. A transient EnvironmentPluginContainer hot-reload crash is NOT a reason to downgrade Vite — those self-heal.
