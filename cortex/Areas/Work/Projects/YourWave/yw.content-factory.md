---
type: project-note
project: YourWave
domain: content-factory
tags: [content, pipeline, automation, claude, dashboard, atlas]
last_updated: 2026-03-17
---

# YourWave — Content Factory

> See also: [[YourWave]] (hub), [[yw.market]] (channels, Coffee Atlas strategy)

## Концепція

Claude-orchestrated content pipeline. Не n8n (rigid, не responsive) — а гнучкий,
розмовний workflow де Claude є мозком, а людина аппрувує якість на кожному етапі.

**Контент-стратегія поверх:** [[yw.market#Content Strategy — Coffee Atlas]]

---

## Pipeline Architecture

```
[Бриф / ідея] ← Telegram або Web
      ↓
[Claude Research]
  — факти про origin/ферму/обробку
  — кут подачі, tone, формат
  — cost/quality optimization пропозиція
      ↓
✅ PRE-PROD APPROVAL (Telegram + Web)
  — текст draft, caption, visual concept
  — ти правиш, коментуєш, аппрувиш
      ↓
[Production]
  — генерація image / video / formatted post
  — Claude вибирає оптимальний інструмент
    (напр: "Flux €0.003 vs Midjourney €0.05 — рекомендую Flux для цього стилю")
      ↓
✅ PROD APPROVAL (Telegram + Web)
  — фінальні ассети перед публікацією
  — повний preview як виглядатиме пост
      ↓
[Publish]
  — Instagram, TikTok, Blog/Atlas
  — авто-scheduling або immediate
      ↓
✅ POST-PROD REVIEW (через 48-72h)
  — Claude звітує: views, clicks, конверсія на сайт
  — "origin stories 2x кращі ніж processing posts"
  — пропозиція для наступного контенту
```

---

## Dashboard — Interconnected

| Шар | Роль | Коли |
|-----|------|------|
| **Web** (primary) | Повний дашборд — контент, аналітика, approval UI | Головний інтерфейс |
| **Notion** | Content calendar DB, decisions log, performance DB | Структурована база |
| **Telegram** | Notifications, quick approvals, alerts, дайджест | Мобільний контроль |

**Що бачити в дашборді:**
- Content pipeline: що в роботі, що на аппруві, що опубліковано
- Analytics: views / clicks / конверсія на сайт / email signups
- Decisions log: які рішення Claude приймав (cost/quality trade-offs)
- Performance insights: що спрацювало, що ні

---

## Approval System (3-stage)

### Pre-prod
- Claude надсилає: draft тексту + caption + visual brief + cost plan
- Ти: аппрув / правки / reject
- Telegram: кнопки "✅ Аппрув / ✏️ Правки / ❌ Reject"
- Web: повний редактор з preview

### Prod
- Claude надсилає: фінальні ассети (image/video + formatted caption)
- Ти: фінальний аппрув перед публікацією
- Web: side-by-side preview (mobile + desktop)

### Post-prod
- Claude звітує автоматично через 48-72h
- Метрики + інсайти + рекомендація для наступного
- Ти: можеш дати feedback або просто прийняти до відома

---

## Claude Optimization Logic

Claude сам вирішує cost/quality trade-offs і *пояснює*:

```
"Для цього посту про Colombia рекомендую:
 Image: Flux ($0.003, ~85% якості для landscape) — збережемо 70% cost
 Video: text overlay Reel (без відеогенерації) — organic performs краще
 Але якщо хочеш преміум-версію: Midjourney + Runway = $0.08 / пост"
```

Ти аппрувуєш або вибираєш рівень.

---

## Tech Stack (план)

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
| Web dashboard | Next.js або Retool (швидко) |
| Blog/Atlas | Shopify Blog або окремий CMS |
| Email trigger | Klaviyo (з конверсії на сайті) |

---

## Content Strategy — Coffee Atlas

Окремий контент-напрям: luxury editorial coffee wiki.

**Workflow per piece:**
1. Вибір origin/теми (Colombia Huila, washed vs natural, etc.)
2. Claude research → стаття для Atlas (сайт)
3. З статті → Instagram Reel або карусель
4. На сайті: quiz "яку каву п'єш?" → персоналізовані статті
5. Email capture → Klaviyo → перші клієнти

**Стиль:** luxury editorial + bold design. Кожна стаття — свій характер.
Натхнення: Kinfolk magazine × Coffee Supreme lookbook.

---

## Design Workflow — A+B+AI

1. Claude research → дизайн-бриф (layout, кольори, типографіка, настрій)
2. AI image gen (Flux/Midjourney) → концепт-превью за брифом
3. User аппрувує напрям у Notion (скріни вбудовані + коментарі)
4. AI генерує фінальні ассети (page design + post + storyboard frames)
5. Prod approval → Publish

Figma — тільки для фінальної polish якщо AI дало 90% але не 100%.
Весь дизайн = AI-generated. Швидко, без ручного Figma-роботи.

---

## Pending / Next Steps

- [ ] Вирішити з яких платформ стартуємо (Instagram first?)
- [ ] Визначити MVP дашборд — Notion + Telegram (перед веб-версією)
- [ ] Підключити Instagram Graph API
- [ ] Перший тестовий пост через пайплайн (Colombia origin)
- [ ] Web dashboard — після першого місяця роботи пайплайну

---

## Decisions Log

| Date | Decision |
|------|----------|
| 2026-03-17 | Content Factory = Claude-orchestrated, не n8n |
| 2026-03-17 | 3-stage approval: pre-prod + prod + post-prod |
| 2026-03-17 | Dashboard: Web (primary) + Notion + Telegram (interconnected) |
| 2026-03-17 | Start from zero — no existing integrations |
| 2026-03-17 | Coffee Atlas = content strategy поверх фабрики |
