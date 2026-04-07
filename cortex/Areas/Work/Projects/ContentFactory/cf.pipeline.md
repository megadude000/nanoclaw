---
type: project-note
project: ContentFactory
domain: pipeline
tags:
  - pipeline
  - approval
  - automation
  - claude
last_updated: 2026-03-17T00:00:00.000Z
source_hash: 067534cfd410d3f9e334c747c47f5fd53609b346be6f87ae4ddf725d93a8e831
embedding_model: text-embedding-3-small
---

# Content Factory — Pipeline Architecture

> See also: [[ContentFactory]] (hub), [[cf.dashboard]] (approval UI)

## Full Pipeline (MVP — конкретно)

```
[Бриф]
  ← Текст у Telegram (природній спосіб)
  — тема, origin, ідея, будь-який формат
      ↓
[Claude Research + Planning]
  — факти про origin / ферму / обробку
  — кут подачі, tone, формат
  — cost plan (яким інструментом генеруємо і чому)
      ↓
[Notion: Pre-prod картка]
  Claude створює картку з підзадачами:
  □ Текст draft
  □ Caption (Instagram)
  □ Visual concept image (DALL-E / Flux cheap mode — швидко, ~85% якості)
  □ Cost plan ("Flux $0.003 vs Midjourney $0.05 — рекомендую Flux")
      ↓
✅ PRE-PROD APPROVAL (Notion comments)
  — Ти коментуєш кожну підзадачу в Notion
  — Явний аппрув = "ok" / "approve" / "✅" в коменті
  — Claude моніторить через Notion MCP
  — Коли ВСІ підзадачі аппрувовані → автоматично рухає картку далі
      ↓
[Production]
  — Claude генерує фінальні ассети:
    • Image: якісна генерація (Flux standard або Midjourney якщо потрібно)
    • Caption: фінальний текст з хештегами
    • Blog post: повна стаття для Atlas (якщо є)
  — Оновлює Notion картку з фінальними ассетами
      ↓
✅ PROD APPROVAL (Notion comments)
  — Та сама механіка: коментар → аппрув → Claude бачить → рухає
      ↓
[Publish — авто]
  — Instagram: Graph API (автоматичний постинг)
  — Blog/Atlas: atlas.yourwave.coffee (CMS API)
  — Stage в Notion → "Published"
      ↓
✅ POST-PROD REVIEW (48–72h, авто)
  — Claude пулить Instagram Insights API
  — Коментує на тій самій Notion картці:
    views / likes / reach / конверсія на сайт
  — Додає рекомендацію для наступного контенту
  — Stage → "Post-prod Review"
```

## Платформи (MVP)

| Платформа | Статус | Механіка публікації |
|-----------|--------|---------------------|
| Instagram | ✅ MVP | Graph API (авто) |
| Blog / Atlas | ✅ MVP | atlas.yourwave.coffee — CMS API |
| TikTok | Phase 2 | — |
| Pinterest | Phase 2 | — |

## Approval Logic

**Тригер для переходу між стейджами:**
- Claude читає коменти до кожної підзадачі через Notion MCP
- Явний аппрув = будь-яке з: `ok`, `approve`, `✅`, `good`, `+`
- Якщо є правки → Claude їх читає і вносить зміни, потім чекає повторного аппруву
- Якщо reject → картка повертається в Research з коментарем чому

## Image Generation — 2 рівні

| Стейдж | Інструмент | Якість | Мета |
|--------|-----------|--------|------|
| Pre-prod concept | DALL-E 3 / Flux cheap | ~80% | Швидко показати напрям |
| Production final | Flux standard / Midjourney | ~95% | Публікація |

Claude вибирає і пояснює cost/quality trade-off перед кожним запуском.

---

## Claude Optimization Logic

Claude сам вирішує cost/quality trade-offs і пояснює:

```
"Для цього посту про Colombia рекомендую:
 Image: Flux ($0.003, ~85% якості для landscape) — збережемо 70% cost
 Video: text overlay Reel (без відеогенерації) — organic performs краще
 Але якщо хочеш преміум-версію: Midjourney + Runway = $0.08 / пост"
```

Людина аппрувує або вибирає рівень.

---

## Design Workflow (A+B+AI)

1. Claude research → дизайн-бриф (layout, кольори, типографіка, настрій)
2. AI image gen (Flux/Midjourney) → концепт-превью за брифом
3. User аппрувує напрям (скріни в Notion + коментарі)
4. AI генерує фінальні ассети (page design + post + storyboard frames)
5. Prod approval → Publish

**Figma** — тільки для фінальної polish якщо AI дало 90% але не 100%.
Весь дизайн = AI-generated. Швидко, без ручного Figma-роботи.

---

## Tech Stack

### Phase 1 — MVP
| Компонент | Інструмент |
|-----------|-----------|
| Orchestrator | Claude (цей бот) |
| Text generation | Claude API |
| Image generation | Flux / DALL-E (via API) |
| Publishing | Instagram Basic Display API + Graph API |
| Dashboard | Notion (content calendar DB) + Telegram |
| Analytics | Instagram Insights API |

### Phase 2 — Full
| Компонент | Інструмент |
|-----------|-----------|
| Video generation | Runway / Kling (via API) |
| Multi-platform | TikTok API, Pinterest API |
| Web dashboard | Next.js або Retool |
| Blog/Atlas | Shopify Blog або окремий CMS |
| Email trigger | Klaviyo (з конверсії на сайті) |
