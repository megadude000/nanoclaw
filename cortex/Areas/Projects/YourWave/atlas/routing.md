---
cortex_level: L30
confidence: high
domain: yourwave
scope: yourwave
project: yourwave
tags: [routing, astro, atlas, i18n, fallback, getStaticPaths]
---

# Atlas Article Routing — EN Fallback Strategy

## Problem
CS/UK slug pages (`getStaticPaths`) filtered only `cs/` or `uk/` prefixed articles.
EN-only articles (new history/science batches) return **404** on `/uk/atlas/slug` and `/cs/atlas/slug`.

Also `buildCategoryTree` + atlas index pages used `getLocalizedArticles` — excludes EN-only articles,
so new categories (history, new science) don't appear in sidebar or index on CS/UK locales.

Spurious route: `/uk/atlas/cs/decaf-myths` — locale prefix leaked into slug params.

## Fix Required
Replace `getLocalizedArticles` with `getArticlesWithFallback` everywhere:
- `src/lib/content.ts` → `buildCategoryTree`
- `src/pages/atlas/index.astro`, `cs/atlas/index.astro`, `uk/atlas/index.astro`
- `getStaticPaths` in `cs/atlas/[...slug].astro` + `uk/atlas/[...slug].astro`

## Status
⚠️ Identified 2026-03-31 — fix pending
