---
cortex_level: L10
confidence: medium
domain: yourwave
scope: yourwave
type: session
date: 2026-03-25T00:00:00.000Z
project: YW_Core
topics:
  - ci-failure
  - e2e-tests
  - a11y
  - color-contrast
  - prettier
status: in-progress
source_hash: 60455219bf4ba399d13975e32acefa84ea339ebcb99b5407f9de9d75ee1b870c
embedding_model: text-embedding-3-small
---

# Session: 2026-03-25 12:15 — ci-failure-analysis

## Quick Reference
Topics: CI failure, E2E tests, a11y color contrast, prettier formatting
Projects: YW_Core
Outcome: Analyzed CI failure on commit `fix(a11y): improve color contrast for count badges in header` — 3 job failures identified
Pending: fix E2E tests (hero/featured selectors), fix a11y color contrast, run prettier

---

## Аналіз CI failure

### Commit
`fix(a11y): improve color contrast for count badges in header` on `main`
Run: https://github.com/megadude000/YW_Core/actions/runs/23538036412

### 3 Jobs Failed

1. **Lint & Format** — `prettier --check .` found many unformatted files (docs, scripts, components, content MDX files)

2. **E2E Tests** — 2 test failures:
   - `displays hero section` — `getByRole('heading', { name: /Coffee Atlas/i })` not found. Hero heading text likely changed.
   - `displays featured articles` — `getByRole('heading', { name: 'Featured' })` not found. Section heading likely renamed or removed.
   - `header span.bg-accent` with hasText 'origin' — badge locator not matching. The a11y commit likely changed badge CSS classes.

3. **Accessibility Tests** — color contrast still failing:
   - Element has insufficient contrast ratio 3.93 (foreground: #8b7e74, background: #ffffff, font-size 8pt)
   - Needs WCAG AA minimum 4.5:1 for normal text
   - The commit was supposed to fix this but didn't fully resolve it

## Pending / Наступні кроки
- [ ] Fix color contrast — change #8b7e74 to darker shade for 4.5:1 ratio
- [ ] Update E2E test selectors to match current page structure
- [ ] Run `npx prettier --write .` to fix formatting
- [ ] Push fixes, verify CI passes
