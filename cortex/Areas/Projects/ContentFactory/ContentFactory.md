---
type: project-hub
cortex_level: L20
confidence: high
domain: yourwave
scope: ContentFactory (Zavod) Claude-orchestrated content pipeline hub - approval flow, platforms, tech stack
project: ContentFactory
status: planning
tags: [content, pipeline, automation, claude, dashboard, approval]
created: 2026-03-17
last_updated: 2026-03-31
---

# Завод (Content Factory)

> Окремий проект. Пов'язаний з [[YourWave]] але живе своїм життям.
> Sub-files: [[cf.pipeline]] · [[cf.dashboard]] · [[cf.integrations]] · [[cf.atlas]]

## Quick Reference

| | |
|---|---|
| **Назва** | Завод |
| **Статус** | Planning |
| **Стек** | Claude API · Instagram Graph API · Notion MCP · Telegram |
| **Перший клієнт** | YourWave Coffee |
| **MVP платформи** | Instagram + atlas.yourwave.coffee |
| **MVP approval** | Notion comments (Variant B — sub-board per card) |
| **Phase 2** | Web dashboard, TikTok, Pinterest, Email |

## Суть

Claude-orchestrated content pipeline. Гнучкий, розмовний workflow де Claude є мозком, а людина аппрувує якість на кожному етапі.

**Не n8n** — n8n був rigid, не responsive. Claude сам приймає рішення і пояснює їх.

---

## Pipeline (огляд)

```
Бриф (Telegram)
  → Claude research + plan
  → Notion картка з підзадачами (текст, caption, concept image, cost)
  → Ти аппрувиш у Notion comments
  → Claude бачить → Production (фінальні ассети)
  → Ти аппрувиш → Publish (Instagram API + atlas.yourwave.coffee)
  → 48–72h → Post-prod analytics у тій самій картці
```

Детальніше: [[cf.pipeline]]

## Ключові деталі MVP

| | |
|---|---|
| **Бриф** | Текст у Telegram |
| **Approval UI** | Notion comments (коментар = аппрув) |
| **Notion stages** | Авто-рух через Notion MCP (Claude моніторить) |
| **Image gen** | Claude генерує: DALL-E cheap для concept, Flux/MJ для production |
| **Платформи** | Instagram (Graph API авто) + atlas.yourwave.coffee |
| **Post-prod** | Instagram Insights API → коментар у Notion картці |

---

## Dashboard (огляд)

| Шар | Роль |
|-----|------|
| **Web** (primary) | Повний дашборд — pipeline, аналітика, approval UI |
| **Notion** | Content calendar DB, decisions log, performance |
| **Telegram** | Quick approvals, alerts, дайджест |

Детальніше: [[cf.dashboard]]

---

## Content Strategy — Coffee Atlas

Перший контент-напрям: luxury editorial coffee wiki.
Кожна стаття = новий origin. Кожна стаття → соц контент → трафік на сайт → email capture.

Детальніше: [[cf.atlas]]

---

## Notion Structure

| | ID | URL |
|---|---|---|
| **Завод page** | `3269e7f6-c2ca-8137-8769-ca704a109638` | [Завод](https://www.notion.so/3269e7f6c2ca81378769ca704a109638) |
| **Content Pipeline DB** | `3269e7f6-c2ca-81f5-9281-e48ae7e94dbb` | board by Stage (pipeline columns) |
| **Demo card: Colombia Huila** | `3269e7f6-c2ca-8169-a024-ee477ea1bc90` | Pre-prod Approval |
| **Pre-prod sub-DB** | `3269e7f6-c2ca-81d4-b6cd-fce4fce95df1` | board by Status, 4 subtasks |

### Content Pipeline DB — поля (універсальні)
| Поле | Тип | Опис |
|------|-----|------|
| Name | title | Назва контент-сету |
| Stage | select | Pipeline stage = board columns |
| Platform | multi_select | Instagram / TikTok / Blog/Atlas / Pinterest |
| Type | select | Reel / Carousel / Static Post / Blog Article / Story |
| Topic | rich_text | Вільний текст — будь-яка тема |
| Cost | number (€) | Вартість генерації |
| Notes | rich_text | Нотатки |

### Sub-board structure (per card)
Кожна картка в Content Pipeline має свою inline sub-database `Pre-prod Approval`:
- 📝 Text Draft
- 💬 Caption
- 📸 Visual Concept
- 💰 Cost Plan

Board view by Status: `⏳ Waiting` → `👀 In Review` → `✅ Approved` / `✏️ Changes Requested`

**Тригер для Production:** всі 4 підзадачі = `✅ Approved` → Claude через Notion MCP рухає картку в `Production`

---

## Current Status

### Phase 1 — MVP (в роботі)
- [x] Вирішити платформи для старту — Instagram + atlas.yourwave.coffee
- [x] Notion board створено — board view by Stage, demo card Colombia Huila з sub-board
- [ ] Підключити Instagram Graph API
- [ ] Atlas tech stack вибрати (Astro vs Next.js) + deploy atlas.yourwave.coffee
- [ ] Figma MCP — вирішити чи підключати
- [ ] Atlas content strategy — спланувати стратегію наповнення (структура, рубрики, пріоритети)
- [ ] Перший контент-сет через пайплайн (після стратегії Атласу)

### Phase 2 — Full
- [ ] Web dashboard (Next.js або Retool)
- [ ] TikTok, Pinterest API
- [ ] Video generation (Runway / Kling)
- [ ] Email (Klaviyo trigger)

---

## Decisions Log

| Date | Decision |
|------|----------|
| 2026-03-17 | Назва — "Завод" |
| 2026-03-17 | Окремий проект, не під YourWave |
| 2026-03-17 | Claude як оркестратор (не n8n — був занадто rigid) |
| 2026-03-17 | 3-stage approval: pre-prod + prod + post-prod |
| 2026-03-17 | Approval UI = Notion (Variant B): кожна картка = суб-дошка підзадач |
| 2026-03-17 | Claude моніторить коментарі → авто-рухає стейджи через Notion MCP |
| 2026-03-17 | Бриф = текст у Telegram |
| 2026-03-17 | Платформи MVP: Instagram + atlas.yourwave.coffee |
| 2026-03-17 | Publish = авто через Instagram Graph API + Blog CMS |
| 2026-03-17 | Image gen: DALL-E cheap для concept, Flux/MJ для production |
| 2026-03-17 | Coffee Atlas = перший контент-напрям для YourWave |
| 2026-03-17 | Design: AI-generated, Figma тільки для фінальної polish |
