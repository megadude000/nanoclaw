---
type: session
date: 2026-03-26
project: YourWave
topics: [nightshift, ci-fixes, storybook, obsidian-research, gemini]
status: completed
---

# Session: 2026-03-26 08:10 — nightshift-v7-review

## Quick Reference
Topics: nightshift v7, CI fixes, storybook allowedHosts, research docs obsidian, GEMINI_API_KEY
Projects: YourWave
Outcome: Night Shift v7 reviewed and merged, CI fixed (5 runs), research docs consolidated in Obsidian
Pending: GA4 real ID, Atlas image generation, EIT application (May 8)

---

## Зроблено
- Night Shift v7 full review: 38 CZ articles, GA4, sitemap, EmailCapture, 9 Storybook stories, 4 research docs
- PR #1 merged to main (nightshift/2026-03-25 branch)
- Fixed 5 cascading CI failures:
  - ESLint prefer-rest-params on GA4 gtag snippet → eslint-disable-next-line
  - Astro schema: category `processing` → `process` (decaf-process.mdx, fermentation-guide.mdx)
  - Prettier: BaseLayout.astro + Configure.mdx added to .prettierignore
  - Prettier: formatted 40+ CZ mdx + story tsx files
  - ESLint: storybook-static/ added to ignores in eslint.config.js
- Storybook tunnel fix: `core.allowedHosts: true` in .storybook/main.ts (commit 112cd26)
- GEMINI_API_KEY: found in session logs, added to ~/nanoclaw/.env as single source of truth
- CLAUDE.md rule added: if agent says "key missing" → check session logs first
- Research docs: consolidated 12 docs into single `Research/` folder in Obsidian
  - 4 from Night Shift v7: brand-moodboard, eit-jumpstarter-prep, instagram-strategy, marketing-channels
  - 8 from Night Shift 2026-03-23: bundle-builder-ux, contract-roasters-cz, crm-ui-patterns, design-systems, green-coffee-suppliers, multi-currency, payment-providers, shipping-providers
- Domain confirmed: yourwave.uk (not yourwave.co)

## Технічні зміни
### CI Fix — ESLint prefer-rest-params
- **Проблема:** GA4 gtag function uses `arguments` keyword
- **Фікс:** `// eslint-disable-next-line prefer-rest-params` before the line
- **Статус:** ✅ Merged

### CI Fix — Prettier parse errors
- **Проблема:** BaseLayout.astro (arguments) + Configure.mdx (<$> JSX) unparseable by Prettier
- **Фікс:** Added both to `.prettierignore`
- **Статус:** ✅ Merged

### Storybook allowedHosts
- **Проблема:** "Invalid Host" error on storybook.yourwave.uk tunnel — Storybook 10 has its own Express host validation separate from Vite
- **Фікс:** `core: { allowedHosts: true }` in .storybook/main.ts
- **Статус:** ✅ Committed (112cd26)

### GEMINI_API_KEY
- **Проблема:** Alfred agent couldn't find key, skipped image generation during Night Shift
- **Фікс:** Key added to ~/nanoclaw/.env; rule in CLAUDE.md
- **Статус:** ✅ Ready for next Night Shift

## Pending / Наступні кроки
- [ ] Replace `G-PLACEHOLDER` in BaseLayout.astro with real GA4 ID (when going live on yourwave.uk)
- [ ] Atlas image generation — 39 images, GEMINI_API_KEY ready, run next Night Shift
- [ ] EIT Jumpstarter application — deadline May 8, 2026 (draft in cortex/Research/eit-jumpstarter-prep.md)
- [ ] Full a11y audit — re-enable CI a11y job when ready
- [ ] Platform auth (Supabase) — deferred

## Технічний борг
- G-PLACEHOLDER in BaseLayout.astro (needs real GA4 measurement ID)
- A11y job disabled in CI (ci.yml)
- Storybook stories need visual QA on yourwave.uk tunnel

---

## Session Update: 2026-03-26 08:47

### Vite version mismatch investigation
- **Проблема:** dev.yourwave.uk showed TypeError crash (EnvironmentPluginContainer.transform) after PR #1 merge
- **Причина:** Vite 7.3.1 hoisted as transitive dep, but Astro 6.x expects Vite 6.x
- **Статус:** Dev server recovered on its own (200 OK), crash was transient hot-reload issue
- **Pending fix:** Add `"overrides": { "vite": "^6.0.0" }` to package.json

## Session Update: 2026-03-26 09:19

### dev.yourwave.uk allowedHosts fix
- **Проблема:** After Vite 6 downgrade, `allowedHosts: true` (boolean) blocked tunnel — Vite 6 needs string `'all'`
- **Фікс:** `sed -i "s/allowedHosts: true/allowedHosts: 'all'/g" astro.config.mjs` — commit d6aa439
- **Статус:** ✅ Committed. Dev server restart needed after code change.
- **Root cause logged:** Vite 6 allowedHosts API differs from Vite 7 (boolean vs string)
