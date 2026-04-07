---
type: session
date: 2026-03-25T00:00:00.000Z
project: 'YourWave, NanoClaw'
topics:
  - bugreporter
  - notion
  - storybook
  - prototypes
  - cloudflared
  - quality
status: in-progress
source_hash: 44cf595b5edcaec04457b79d46592d8fb8d674704c1f369ecf0b5cbcef9ea099
embedding_model: text-embedding-3-small
---

# Session: 2026-03-25 11:20 — bugreporter-notion

## Quick Reference
Topics: bugreporter, notion integration, storybook cleanup, cloudflared systemd, prototype deletion
Projects: YourWave, NanoClaw
Outcome: Deleted all prototype stories, fixed Storybook ESM, researched BugReporter flow, planned Notion integration
Pending: implement BugReporter→Notion flow, cron tracking file, fix Chrome in container

---

## Зроблено
- Fixed Storybook ESM error: `__dirname` → `fileURLToPath(import.meta.url)` in `.storybook/main.ts`
- Deleted all 23 prototype story files (CRM + Store) — user said "виглядає як кал", no design system
- Commit `113e471`: 24 files changed, -8464 lines, pushed to main
- Restarted Storybook dev server on host (died when container was stopped)
- Enabled `cloudflared-tunnel.service` via systemd for auto-restart on reboot
- Took screenshots of all CRM/Store stories via host Playwright — confirmed they render but look like unstyled wireframes
- Researched BugReporter feature end-to-end:
  - Frontend: `BugReporter.astro` — floating button with area selection + html2canvas screenshot
  - Backend: `bugreport-webhook.ts` — saves screenshot, creates SQLite one-time task
  - Missing: Notion integration, status tracking, bug history

## Технічні зміни
### Storybook Prototype Deletion
- **Проблема:** Prototype stories (CRM Dashboard, Orders, Products, Customers, Subscriptions + Store Homepage, Catalog, ProductDetail, BundleBuilder, CartCheckout) had no design system — inline styles, broken SVGs, no consistency
- **Фікс:** `rm -rf src/stories/prototypes/` — deleted all 23 files
- **Статус:** Done, pushed to main

### Cloudflared Auto-start
- **Проблема:** Tunnel died when container stopped, Storybook returned 502
- **Фікс:** `sudo systemctl enable --now cloudflared-tunnel.service`
- **Статус:** Done

## Pending / Наступні кроки
- [ ] Implement BugReporter → Notion flow (create Bugs DB, update webhook to create Notion pages, wire Notion webhook back)
- [ ] Create cron tracking file for all scheduled tasks
- [ ] Fix Chrome/Playwright in container (crashpad_handler error)
- [ ] 120+ queued SDK messages investigation — was long session blocking, not crons

## Технічний борг
- Chrome in container crashes: `chrome_crashpad_handler: --database is required`
- Component stories (CrmSidebar, MetricCard, etc.) still exist but also have no design system
- Storybook example stories (Button, Header, Page) are default Storybook boilerplate — should be removed
