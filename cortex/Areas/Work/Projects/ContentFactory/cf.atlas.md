---
cortex_level: L20
confidence: high
scope: content-strategy
type: project-note
project: ContentFactory
domain: atlas
tags:
  - atlas
  - coffee
  - content-strategy
  - editorial
last_updated: 2026-04-07T03:00:00.000Z
source_hash: ceeacc992f09d13a5bdee51b646c42e283f45d6b786b09261fe4af703befa509
embedding_model: text-embedding-3-small
---

# Content Factory — Coffee Atlas

> See also: [[ContentFactory]] (hub), [[cf.pipeline]] (workflow)

## Концепція

**Coffee Atlas** — редакційний атлас кави у стилі luxury editorial magazine + bold design.
Натхнення: Kinfolk magazine × Coffee Supreme lookbook.

---

## Current Status (2026-04-07) — LIVE ✅

| Locale | Articles | Status |
|--------|----------|--------|
| EN | 140 | ✅ Live |
| CS | 140 | ✅ Live |
| UK | 140 | ✅ Live |

### Content Categories
- **Getting Started** (25+) — tasting wheel, whole bean vs ground, cleaning equipment, certifications, freshness, grind, etc.
- Origins (Ethiopia, Colombia, Kenya, Brazil, Yemen, Vietnam, etc.)
- Processing Methods (washed, natural, honey, wet-hulled, anaerobic, etc.)
- Equipment (grinder types, espresso machines)
- **Brewing** (aeropress guide, siphon, moka pot, cold brew, chemex, etc.)
- Science (water temperature, bloom/degassing, milk steaming, altitude/terroir, Physics of Espresso series)
- History (Ottoman coffeehouses, espresso invention, third wave, evolution-of-coffee-brewing)
- Specialty Culture (direct trade, fair trade, cupping scores, storage)

### Completed nightshift (2026-04-07)
- ✅ coffee-tasting-wheel.mdx — SCA flavour wheel, how to use it
- ✅ buying-whole-bean-vs-pre-ground.mdx — freshness, grinder types, when pre-ground is OK
- ✅ cleaning-your-coffee-equipment.mdx — grinder/pour-over/French press/espresso cleaning
- ✅ understanding-coffee-certifications.mdx — organic/Fair Trade/Rainforest Alliance/direct trade
- ✅ aeropress-guide.mdx — standard + inverted method, recipes, variables
- ✅ siphon-coffee-brewing.mdx — physics, equipment types, recipe, cloth vs paper filter
- ✅ moka-pot-guide.mdx — fill level, grind, heat management, common mistakes
- ✅ cold-brew-complete-guide.mdx — concentrate ratio, steep time, filtering, storage
- ✅ Hero images for all 8 via Imagen 4 Fast
- ✅ Full CS + UK translations for all 8
- ✅ gen_remaining.py rewritten as Node.js wrapper (no pip required)
- ✅ CRM a11y audit: Level A/AA fixes (aria-labels, aria-hidden icons, outline:none removed, dialog aria-labelledby)
- Branch: nightshift/2026-04-07

### Completed nightshift (2026-04-06)
- ✅ coffee-extraction-kinetics.mdx (EN+CS+UK)
- ✅ espresso-pressure-profiling.mdx (EN+CS+UK)
- ✅ coffee-belt-countries.mdx, specialty-coffee-grading.mdx, coffee-competitions-world.mdx (EN+CS+UK)
- ✅ coffee-freshness-guide.mdx, grind-size-guide.mdx, how-to-read-coffee-menu.mdx, third-wave-coffee-movement.mdx, water-temperature-brewing.mdx (EN+CS+UK)
- ✅ Hero images for all 10 via Imagen 4 Fast
- All 3 locales now at 132 — merged to main

### Completed tonight (2026-04-02)
- ✅ Added `getting-started` category to content schema
- ✅ 10 new Getting Started articles (EN): specialty coffee, read a bag, first cup, arabica vs robusta, roast levels, coffee cherry, processing methods, terroir, brewing ratios, storage
- ✅ evolution-of-coffee-brewing.mdx (EN+CS+UK) — Ottoman 1555 → AeroPress 2005 timeline
- ✅ shot-timing-physics.mdx (EN+CS+UK) — Darcy's Law + 25-30s window physics
- ✅ 30 missing inline figures generated (arabica, bourbon, brazil, burundi, catuai, caturra, chemex, coffee-belt)
- ✅ CS+UK translations for all 10 new Getting Started articles — all 3 locales at 114

### Completed nightshift (2026-04-06) — merged to main
- ✅ coffee-extraction-kinetics.mdx (EN+CS+UK) — kinetic extraction order, TDS/yield, channelling, temperature trade-offs
- ✅ espresso-pressure-profiling.mdx (EN+CS+UK) — flat 9-bar vs pre-infusion vs declining profiles; Slayer/Decent history
- ✅ coffee-belt-countries, specialty-coffee-grading, coffee-competitions-world (EN+CS+UK)
- ✅ coffee-freshness-guide, grind-size-guide, how-to-read-coffee-menu, third-wave-coffee-movement, water-temperature-brewing (EN+CS+UK)
- ✅ Hero images for all — gen_remaining.mjs used successfully
- All 3 locales now at 132 articles — merged to main (2026-04-07)

### Completed nightshift (2026-04-05)
- ✅ coffee-water-hardness.mdx (EN+CS+UK)
- ✅ light-vs-dark-roast-myths.mdx (EN+CS+UK)
- ✅ coffee-subscriptions-explained.mdx (EN+CS+UK)
- ✅ how-to-taste-coffee.mdx (EN+CS+UK)
- ✅ coffee-and-sleep.mdx (EN+CS+UK)
- ✅ cafe-hopping-guide-prague.mdx (EN+CS+UK)
- ✅ Hero images generated for all 6 via Imagen 4 Fast
- All 3 locales now at 123 articles — branch nightshift/2026-04-05

### Completed early morning (2026-04-03, ~04:30)
- ✅ coffee-acidity-chemistry.mdx (EN+CS+UK)
- ✅ green-coffee-storage.mdx (EN+CS+UK)
- ✅ coffee-tasting-glossary.mdx (EN+CS+UK)
- All 3 locales now at 117 articles; pushed to `nightshift/2026-04-01`, merged to main

### Pending
- Audio generation not started (see [[audio-atlas-implementation]])
- More inline figure images may still be missing in other articles

---

## Типи контенту

- **Origins:** де ростуть, ферми, регіони, висоти, varietals
- **Processing:** washed / natural / honey — що і чому
- **Science & Equipment:** brewing guides, grinder types, water chemistry
- **History:** від Османської імперії до третьої хвилі
- **Кожен новий origin** = нова стаття в Atlas

---

## Workflow: Контент → Трафік → Email

```
1. Вибір origin/теми
2. Claude research → стаття для Atlas (сайт)
3. З статті → Instagram Reel або карусель
4. Quiz "яку каву п'єш?" → персоналізовані статті
5. CTA: "Залиш email — отримай новий experience"
6. Email list → Klaviyo → перші клієнти → підписка
```

---

## Design Principles

- Кожна стаття / серія = **свій характер** (не один шаблон)
- Bold, luxury editorial — дорого виглядає, але accessible
- AI-generated images (Imagen 4) — not stock
- Preview перед публікацією — обов'язково
