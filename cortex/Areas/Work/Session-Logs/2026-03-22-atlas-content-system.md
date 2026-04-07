---
type: session
date: 2026-03-22T00:00:00.000Z
project: YourWave
topics:
  - content-system
  - interlinking
  - articles
  - external-references
  - photos
  - identity
status: completed
source_hash: 439c3fe240093a081b4c47b41d62bf1ab70560f6306e2d759f62ead82b1c5013
embedding_model: text-embedding-3-small
---

# Session: 2026-03-22 16:00 — atlas-content-system

## Quick Reference
Topics: content utilities, interlinking, article rewriting, external references, photos, Jarvis identity
Projects: YourWave Coffee Atlas
Outcome: Built complete content system (12 functions, 36 tests), interlinked all 21 articles, rewrote with book-quality photos and external references, renamed assistant to Jarvis
Pending: image hosting migration (R2), header mega-menu dynamic counts, Ukrainian translations

---

## Зроблено

### Content System (`src/lib/content.ts`)
- Built 12 locale-aware utility functions: getLocalizedArticles, buildCategoryTree, getRelatedArticles, getArticleCounts, buildBreadcrumbs, getChildArticles, getFeaturedArticles, getArticleBySlug, getArticleLocale, getArticleSlug, getTotalArticleCount, categoryMeta
- All compute at build time (SSG), zero runtime cost
- 36 unit tests in `content.test.ts` — all passing (44 total with utils tests)

### Atlas Article Page (`[...slug].astro`)
- Sticky sidebar with collapsible tree navigation (desktop w-64, mobile accordion)
- Breadcrumbs: Home → Atlas → Category → [Parent →] Current
- Related articles grid from `related` frontmatter
- Child articles section for parent topics
- Book-style CSS: floated figures alternating left/right, drop cap, elegant blockquotes, atlas link styling

### Atlas Index Page (`atlas/index.astro`)
- Dynamic category counts via `getArticleCounts()` (replaces hardcoded 42, 18, 35, 24, 15)
- Category filter pills with URL-based filtering (`?category=origin`)
- Difficulty badges (green/amber/red)
- Sorted by `sortOrder` within categories

### Article Interlinking (all 21 articles)
- 4-9 inline cross-reference links per article (90+ total)
- Cross-category linking: origins → processing → varieties → brewing
- Used 3 parallel agents to interlink all articles simultaneously
- Rules: first mention only, natural text, no self-links

### Article Rewriting (all 20 articles, excluding reference Yirgacheffe)
- 3-5 topic-relevant Unsplash photos per article (76 images total)
- "Further Reading" section with books and organizations
- Inline citations: Hoffmann, Pendergrast, Koehler, Easto, Rao, SCA, ICO, CQI, World Coffee Research
- Enhanced writing: sensory language, specific data, narrative style
- Used 3 parallel agents for rewriting

### Documentation
- `docs/CONTENT-GUIDE.md` — comprehensive guide: philosophy, frontmatter schema, writing style, image guidelines (relevance table, search strategy), external references system (14 key sources), interlinking strategy, SEO checklist, difficulty/sortOrder conventions, translation workflow, content utilities API
- `docs/MOCKS.md` — mock registry with image hosting tracking

### Identity & Behaviour
- Renamed from Andy to Jarvis (CLAUDE.md updated)
- Swarm bots: Friday and Alfred
- Added "Proactive Initiative" as core behaviour: warn about risks, suggest next steps, challenge bad ideas, auto-preserve decisions, add to TODO proactively
- Preserved key decisions to Obsidian cortex CLAUDE.md

## Технічні зміни

### Bug Fixes
- YAML parsing in brazil.mdx and colombia.mdx — apostrophe in single quotes broke parser, switched to double quotes
- `getArticleLocale()` — bare IDs (no `/`) returned full ID as locale, added length check (≤3 chars)
- Dev server port 4321 — intermittent 404s resolved

### New Components
- `ArticlePreview.astro` — hover preview popover (CSS-only, no JS)
- `RelatedArticles.astro` — configurable grid wrapper

### New i18n Keys (en.json + uk.json)
- atlas.title, atlas.subtitle, atlas.all, atlas.noArticles, atlas.viewAll, atlas.browseAtlas, atlas.subTopics, atlas.relatedTopics, atlas.glossary

## Pending / Наступні кроки
- [ ] Image hosting migration — Cloudflare R2 ($0.015/GB, free CDN egress)
- [ ] Header mega-menu — wire dynamic counts from `getArticleCounts()` (utility exists, not connected)
- [ ] Ukrainian translations — 20 more articles needed (only ethiopia-yirgacheffe exists)
- [ ] Yirgacheffe — add Further Reading section (reference article, currently missing)

## Технічний борг
- Hero image in header still shows branded Battlecreek Coffee bag (Unsplash photo) — need coffee-specific hero
- Mega-menu counts still hardcoded (42, 18, 35, 24, 15) — `getArticleCounts()` ready but not wired
- Unsplash photo IDs may not all be valid — need to verify all 76 images load correctly
- ArticlePreview hover delay — CSS instant, should be 300ms via JS for better UX
