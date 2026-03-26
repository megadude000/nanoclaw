---
type: session
date: 2026-03-17
project: ContentFactory
topics: [content-factory, завод, notion, pipeline, approval, instagram, atlas]
status: completed
---

# Session: 2026-03-17 11:00 — content-factory-setup

## Quick Reference
Topics: content-factory, завод, notion, pipeline, approval, instagram, atlas, coffee-atlas
Projects: ContentFactory, YourWave
Outcome: Побудовано архітектуру Content Factory (Завод) — Obsidian sub-project + Notion board з board view, sub-board per card для approval
Pending: Figma MCP рішення, Atlas tech stack (Astro vs Next.js), Colombia Huila перший сет

---

## Зроблено

- **Obsidian проект ContentFactory** — створено окремий folder з hub + sub-files:
  - `ContentFactory.md` — hub з Notion IDs, pipeline огляд, decisions log
  - `cf.pipeline.md` — детальна архітектура пайплайну (всі стейджи, approval логіка, image gen)
  - `cf.atlas.md` — Coffee Atlas контент-стратегія (SEO → social → email)
- **CLAUDE.md** — оновлено Active Projects з Завод entry + Notion URL
- **YourWave.md** — додано Related Projects секцію з посиланням на ContentFactory
- **Notion "Завод" page** — створено окремо від YourWave, поділено з Jarvis integration
- **Content Pipeline DB** — board view by Stage (pipeline columns), 7 стейджів:
  `Brief → Research → Pre-prod Approval → Production → Prod Approval → Published → Post-prod Review`
- **DB поля**: Name, Stage, Platform (multi_select), Type, Topic (rich_text), Cost, Notes
- **Demo card "Colombia Huila"** — створено в Pre-prod Approval з sub-database (4 підзадачі)
- **Pre-prod sub-DB**: 📝 Text Draft, 💬 Caption, 📸 Visual Concept, 💰 Cost Plan — board by Status
- **Notion очищено** — видалено всі текстові блоки з головної сторінки Завода (тільки трекер)
- **MVP рішення** (button Q&A): платформи Instagram + atlas.yourwave.coffee, бриф у Telegram, approval у Notion, publish через API
- **2-app site architecture**: yourwave.coffee (Shopify) + atlas.yourwave.coffee (окремий CMS app)

## Технічні зміни

### Notion Board View Fix
- **Проблема:** `API-create-a-data-source` MCP broken (Invalid request URL)
- **Фікс:** curl до `https://api.notion.com/v1/databases` з `views` параметром для board view
- **Статус:** ✅ Працює — board створений з правильним Stage board view

### Notion DB Field Update
- **Проблема:** Початково було поле "Origin" (select з coffee presets) — надто вузьке
- **Фікс:** `PATCH /v1/databases/{id}` — видалено Origin, додано Topic (rich_text) для універсальності
- **Статус:** ✅ Завод тепер universal content factory (не coffee-only)

### Notion Page Sharing
- **Проблема:** MCP не міг знайти Завод page (object_not_found) — не було доступу
- **Фікс:** Користувач вручну поділився Завод page з "Jarvis connection" у Notion
- **Статус:** ✅ MCP працює

## Ключові архітектурні рішення

| Рішення | Вибір | Причина |
|---------|-------|---------|
| Orchestrator | Claude (не n8n) | n8n rigid, Claude гнучкий і пояснює рішення |
| Approval UI | Notion comments (Variant B sub-board) | Кожна картка = своя sub-DB з підзадачами |
| Approval trigger | Claude моніторить MCP → всі ✅ → авто-рух | Human-in-the-loop без ручних дій |
| Image gen | DALL-E cheap (pre-prod) + Flux/MJ (prod) | Cost/quality trade-off |
| Бриф | Telegram | Природний спосіб, завжди під рукою |
| Publish | Instagram Graph API (авто) + Atlas CMS | Повна автоматизація після approval |
| Site | Shopify (yourwave.coffee) + окремий app (atlas.yourwave.coffee) | Різна архітектура для store vs editorial |

## Notion IDs (важливо!)

| | ID |
|---|---|
| Завод page | `3269e7f6-c2ca-8137-8769-ca704a109638` |
| Content Pipeline DB | `3269e7f6-c2ca-81f5-9281-e48ae7e94dbb` |
| Demo card: Colombia Huila | `3269e7f6-c2ca-8169-a024-ee477ea1bc90` |
| Pre-prod sub-DB | `3269e7f6-c2ca-81d4-b6cd-fce4fce95df1` |

## Pending / Наступні кроки

- [ ] **Figma MCP**: Вирішити чи підключати — офіційний MCP server є, але не налаштований
- [ ] **Atlas tech stack**: Astro (краще для SEO-heavy) vs Next.js (якщо складна персоналізація) — вибрати
- [ ] **Instagram Graph API**: Підключити, перевірити що @yourwave.coffee акаунт існує
- [ ] **Atlas content strategy**: Спланувати стратегію наповнення Атласу ПЕРЕД першим сетом — структура, рубрики, пріоритети
- [ ] **Colombia Huila**: On hold — після того як стратегія Атласу вирішена
- [ ] **atlas.yourwave.coffee**: Вирішити CMS (Astro + MDX, або Sanity/Contentful) — deploy
- [ ] **yourwave.coffee домен**: Зареєструвати якщо ще не зроблено

## Технічний борг

- `API-create-a-data-source` MCP tool broken — потрібен workaround через curl для створення DB
- `API-retrieve-a-database` — не тестований для Board view DB, може відрізнятись від `data-source`
- Sub-DB для нових карток потрібно створювати вручну (Claude через MCP при кожному новому бріфі)

---

## Session Update: 2026-03-17 12:00 — notion-webhook-debug

### Notion Webhook Status Investigation
- **Проблема:** Notion comment не тригерив Claude — я не реагував
- **Причина:** ngrok не запущений (`ngrok-notion.service` enabled але зупинений)
- **Архітектура вебхуку:**
  - Host nanoclaw слухає порт 3456 (webhook receiver є в dist/)
  - ngrok тунелює `irreproachably-exudative-reyna.ngrok-free.dev` → localhost:3456
  - Сервіс enabled в `default.target.wants` — автостарт при логіні ✅
- **Фікс:** Юзер запускає `systemctl --user start ngrok-notion` один раз
- **Pending:** Підтвердити що вебхук працює після запуску ngrok

---

## Session Update: 2026-03-17 12:15–12:35 — notion-webhook-deep-debug

### Webhook Pipeline — Результати тестування
- **ngrok**: запустився після перезавантаження комп'ютера ✅
- **Тунель**: `irreproachably-exudative-reyna.ngrok-free.dev` — живий, відповідає ✅
- **Підпис HMAC**: формат `sha256=<hex>` — перевірено, працює ✅
- **DB міграція**: `is_main = 1` для `tg:633706070` — ✅
- **Тестовий webhook**: надіслав симульований `comment.created` → задача створена → агент виконав → прочитав коменти "Де дешевше купити домен?" → дослідив ціни → відповів коментарем у Notion ✅
- **Реальний Notion webhook**: НЕ приходить — Notion не надсилає події при реальних коментарях

### Незакрита проблема: реальний Notion webhook
- **Факти**: Jarvis має доступ до ☕ Your Wave database ✅, webhook subscribed Comment 3/3 ✅
- **Гіпотеза**: Notion надсилає payload з іншим форматом ніж код очікує (entity.parent_id vs data.parent.page_id)
- **Спроба**: додано логування raw body до `/tmp/notion-webhook-log.json` в dist + restart
- **Статус**: незавершено — потрібно зловити реальний payload від Notion

### Prompt агента вебхуку — проблема
- Агент з вебхуку використовує старий prompt ("Prague Micro-Roastery Business Plan")
- Треба оновити `buildAgentPrompt` в `notion-webhook.ts` для Завод контексту

## Технічний борг (додано)
- `buildAgentPrompt` у `notion-webhook.ts` — старий контекст BP Tasks, треба переписати для Завод
- Агент з webhook результат обгортав в `<internal>` — не надіслав повідомлення у Telegram
- Реальний Notion webhook payload формат — невідомий, потрібно логувати і перевірити
