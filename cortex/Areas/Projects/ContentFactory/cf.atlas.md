---
type: project-note
project: ContentFactory
domain: atlas
tags:
  - atlas
  - coffee
  - content-strategy
  - editorial
last_updated: 2026-04-07T00:00:00.000Z
embedding_model: text-embedding-3-small
source_hash: a5c5967528be010d5de7efbc508e923f1d4a4aeb9deebc34ed89b535acce0a56
---

# Content Factory — Coffee Atlas

> See also: [[ContentFactory]] (hub), [[cf.pipeline]] (workflow)

## Current Status (2026-04-07)

- **140 articles per locale** — EN / CS / UK all at 140 ✅
- Categories: Getting Started, Origins, Processing Methods, Equipment, Brewing Guides, Science, History, Specialty Culture, Glossary
- Hero images generated for all articles via Imagen 4 Fast
- Build passing: `nightshift/2026-04-07` branch, 409 tests green
- Content generation: `node /workspace/group/nightshift/gen_remaining.mjs`
- PR #18 (nightshift/2026-04-05) merged to main 2026-04-06

## Концепція

**Coffee Atlas** — редакційний атлас кави у стилі luxury editorial magazine + bold design.
Не просто блог — окремий стиль кожної сторінки, посту, блогу. Сміливо, красиво, по-різному.

Натхнення: Kinfolk magazine × Coffee Supreme lookbook.

---

## Типи контенту

- **Origins:** де ростуть, ферми, регіони, висоти, varietals
- **Processing:** washed / natural / honey — що і чому
- **Лайфхаки:** як покращити каву яку вже п'єш
- **Кожен новий origin** = нова стаття в Atlas

---

## Workflow: Контент → Трафік → Email

```
1. Вибір origin/теми (Colombia Huila, washed vs natural, etc.)
2. Claude research → стаття для Atlas (сайт)
3. З статті → Instagram Reel або карусель
4. На сайті: quiz "яку каву п'єш?" → персоналізовані статті
5. "А ви знали? Лайфхаки для вашої кави" → залученість
6. CTA: "Залиш email — отримай новий experience. Будеш у захваті"
7. Email list → Klaviyo → перші клієнти → підписка
```

---

## Чому це працює

- **SEO актив** довгостроковий (coffee origins = великий пошуковий попит)
- **Соц контент** генерується автоматично з кожної статті
- **Показує характер** бренду: сміливий, освічений, не як всі
- **Email capture** з цінністю — не просто "підпишись"

---

## Перший контент-сет — Colombia Huila

**Чому Huila:**
- Founder preference (перший origin YourWave)
- Профіль: фруктовий, солодкий, доступний для нових дегустаторів
- Сильна розпізнаваність серед specialty любителів

**Що робимо:**
- [x] Стаття Atlas: Colombia Huila — included in 140-article library
- [ ] Instagram Reel: origin story (текстовий overlay або AI відео)
- [ ] Instagram карусель: processing methods для Huila
- [ ] Design brief: стиль цієї серії (кольори, типографіка, настрій)

**Статус:** Atlas pipeline fully operational — 140 articles shipped. Social content generation next.

---

## Design Principles

- Кожна стаття / серія = **свій характер** (не один шаблон)
- Bold, luxury editorial — дорого виглядає, але accessible
- AI-generated design (Flux/Midjourney) — не шаблони
- Preview перед публікацією — обов'язково
