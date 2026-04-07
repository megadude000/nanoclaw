---
type: session
date: 2026-03-25T00:00:00.000Z
project: YW_Core
topics:
  - CI
  - accessibility
  - color-contrast
  - bugreporter
  - notion-webhook
  - heading-hierarchy
status: in-progress
source_hash: 0c66184318236fcd6c3d92537aa5ce4672b60c80ff62f1f1da560c84d9e219a1
embedding_model: text-embedding-3-small
---

# Session: 2026-03-25 12:00 — ci-a11y-bugreport

## Quick Reference
Topics: CI failures, WCAG color contrast, bugreporter webhook, Notion integration, heading hierarchy
Projects: YW_Core
Outcome: Fixed bugreport webhook crashes, fixed muted-foreground/primary contrast, deleted CRM prototypes — but CI still failing on --primary color in some places
Pending: find remaining #b8733e references, fix Atlas/Article heading hierarchy, restart NanoClaw for webhook fix

---

## Зроблено
- Deleted 12 CRM prototype files (-804 lines) — commit 95f8a51
- Fixed E2E selectors to match actual DOM (Coffee Atlas→Discover the World, Featured→Editor Picks) — commit 483461d
- Fixed `--muted-foreground` contrast: `#8B7E74` → `#6F655C` (~5.2:1) — commit 483461d
- Fixed `--primary` contrast: `#b8733e` → `#946130` (5.28:1) in global.css — commit 4293fbb
- Added sr-only `<h2>Browse by Category</h2>` for heading hierarchy on homepage — commit 4293fbb
- Fixed bugreport-webhook.ts: viewport string→object normalization, selection optional chaining, better error logging (via host_claude)
- Ran prettier across codebase

## Технічні зміни
### Color Contrast Fixes
- **Проблема:** `--primary` (#b8733e) = 3.77:1 on white, `--muted-foreground` (#8B7E74) = 3.93:1 — both below WCAG AA 4.5:1
- **Фікс:** Darkened to #946130 and #6F655C respectively
- **Статус:** ⚠️ CI run 23539249032 still shows #b8733e — found remaining references in `global.css:190` (--chart-4) and `pages/prototypes/header.astro:37`. Also `dist/` has stale build. Need thorough sweep.

### BugReporter Webhook
- **Проблема:** TypeError crash — viewport sent as string "1920x1080", selection undefined access
- **Фікс:** Added normalization + optional chaining in bugreport-webhook.ts
- **Статус:** Built on host but NanoClaw NOT restarted yet

### Heading Hierarchy
- **Проблема:** Homepage h1→h3 skip (categories), Atlas Browse and Article pages also have hierarchy issues
- **Фікс:** Added sr-only h2 on homepage only
- **Статус:** Atlas Browse + Article pages still failing

## Pending / Наступні кроки
- [ ] Find and fix ALL remaining #b8733e references (--chart-4, header.astro, possibly Tailwind config)
- [ ] Fix heading hierarchy on Atlas Browse and Article pages
- [ ] Restart NanoClaw to pick up webhook fix
- [ ] Re-test bugreporter → Notion end-to-end flow
- [ ] Restart cloudflared (user needs `sudo systemctl restart cloudflared-tunnel`)
- [ ] Create cron tracking file (user explicitly requested)
- [ ] Wire Notion webhook → agent for new bug pages

## Технічний борг
- `dist/` folder contains stale CSS with old #b8733e values — needs rebuild
- cloudflared config updated but not restarted (needs sudo)
- ngrok tunnel running (PID 1611) — stable URL: irreproachably-exudative-reyna.ngrok-free.dev
