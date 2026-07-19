---
cortex_level: L20
confidence: high
domain: yourwave
scope: yw_core
tags:
  - yw-core
  - gsd
  - milestone-4
  - crm
  - atlas
  - status
created: 2026-04-01T00:00:00.000Z
updated: 2026-07-19T09:30:00.000Z
status: milestone-4-verifying
source_hash: 05418c074764adcc63b86637f460a5533739415f567a63aef5cf91b3ca8a43d7
embedding_model: text-embedding-3-small
---

# YW Core — Current State (2026-07-19)

> Full refresh after a ~3.5-month documentation gap (previous update 2026-04-07).
> Verified against the live repo `~/YW_Core` (main @ d1ad708) and running infrastructure.

## Stack (verified)

- **Astro 6** (`^6.0.7`, NOT 5) + React 19 islands + Tailwind 4 + shadcn/ui
- CRM: TanStack Router (NOT React Router) inside a single `client:only` island at `/crm/*`
- Adapter: `@astrojs/vercel` v10, per-route SSR (`prerender = false` on crm/profile/api)
- Supabase (`@supabase/ssr`), Stripe v22, PostHog, Faro, zustand (7 stores)
- Dev infra on host: systemd user services `yw-dev` (:4321) + `yw-storybook` (:6006), Cloudflare tunnel (`dev.yourwave.uk`, `storybook.yourwave.uk`). The orphan `cloudflared-tunnel.service` (405 bug) is disabled — fixed.

## GSD Progress

| Milestone | Scope | Status |
|-----------|-------|--------|
| 1 | CRM shell (9 phases) | ✅ complete 2026-04-01 |
| 2 | Backend foundation (phases 10–15: Vercel, Supabase, Auth, RBAC, PostHog, Observability) | ✅ complete 2026-04-05 |
| 3 | Stripe payments (phases 16–19) | ⚠️ **abandoned mid-flight** — planning docs deleted (uncommitted), but payments CODE shipped and remains: `20260406000000_payments.sql`, `api/create-checkout.ts`, `api/webhooks/stripe.ts`, `usePayments.ts`. Orphaned/half-built. |
| 4 | CRM Inventory module (phases 20–23) | ROADMAP says 4/4 phases complete, `status: verifying`, stopped at Phase 23 verification |
| — | Phase 24 CRM Products module | Merged to main (chunks 1–3) via `.worktrees/phase-24-products` |

## What's Broken (as of 2026-07-19)

1. **Supabase cloud project `hixcggaidadmzekrkkrx` is PAUSED** — subdomain no longer resolves, SQL times out via MCP. Every `/crm` request does an unguarded server-side `getUser()` in `src/middleware.ts:44-50`, so CRM cannot render against a dead project. Unpause requires the Supabase dashboard.
2. **`.env.local` points to local Supabase (`127.0.0.1:54321`)** that was never started. Also defines `SUPABASE_URL` while code only reads `PUBLIC_SUPABASE_URL` — env-name mismatch risk on Vercel too.
3. **Inventory page infinite-render bug** — `InventoryPage.tsx:38-49` ships committed debug instrumentation (render counter, bail at 50 renders). Untracked diagnostic specs `e2e/inventory-hang.spec.ts` + `e2e/inventory-debug.spec.ts` target it. Root cause suspected: unstable zustand selectors. NOT fixed.
4. **34 unpushed commits on main** — origin/main is far behind (everything incl. Phase 24 is local only). Prod on Vercel (`yw-core.vercel.app`) is stale.
5. Host Node version friction — `~/fix-astro.sh` forces Node 22 via nvm (`engines >=22.12.0`).

## Product Area Reality Check

| Area | State |
|------|-------|
| Coffee Atlas | ✅ Mature. 140 MDX articles × EN/CS/UK. But: article route is TRIPLE-duplicated (~891 lines × 3 locales) |
| Shop | ❌ Does not exist. Only commerce = $4.99 podcast-unlock Stripe checkout |
| Bundle Builder | ❌ Does not exist (zero feature code) despite being "core UX" in spec |
| CRM | 🟡 Scaffolded. Inventory (52 files) + Products biggest; payments/users hit real Supabase; **products/inventory/locations are 100% mock-data**; orders/analytics thin; router-level RBAC stubbed to always-allow (`CrmApp.tsx:19-21`) |

## Frontend Architecture Debt (refactor targets, priority order)

1. **Atlas route triplication** — `pages/atlas/[...slug].astro`, `uk/…`, `cs/…` are ~891-line near-copies (~2.7k duplicated lines); same for atlas index + homepage per locale. Extract shared renderer, single locale-driven route.
2. **Two disconnected design-token systems** — shadcn tokens in `global.css` vs `--crm-*` in `crm-tokens.css`; CRM uses hand-written inline `style={{}}` (42 blocks in UsersPage alone) while site uses Tailwind. No shared primitives (`components/ui/` vs `modules/crm/components/ui/`).
3. **Data layer split-brain** — mock zustand stores (products/inventory/locations, ~1,200 lines of mock-data imported by live stores) vs ad-hoc Supabase hooks (payments/users). No query-cache layer (no TanStack Query). No repository layer.
4. **God components** — `Header.astro` 1,357 lines (+ 1,289-line scratch copy at `pages/prototypes/header.astro`), StockMovementDialog 816, RoastBatchDialog 776, DataTable 701, UsersPage 687.
5. **Dead code shipped as routes** — `prototype-a/b/c.astro`, `prototypes/header.astro`, `test-catch/`; dead `useCrmAuthStore` test + cleanup shims.
6. **`cs` locale missing from `astro.config.mjs` i18n/sitemap** despite 140 CS articles.

## Cortex Vault Hygiene

- **Duplicate YourWave doc tree**: `Areas/Work/Projects/YourWave/` (canonical, per CLAUDE.md) vs `Areas/Projects/YourWave/` (divergent fork). Fork's `yw.platform-spec.md` is NEWER (2026-03-31) than canonical (2026-03-23); everything else is same or older. Fork also holds `arch/`, `atlas/`, `bootstrap/` subdirs not present in canonical.
- **Known-stale docs**: `yw.ecommerce.md` (still describes Shopify platform — superseded by custom build; unit economics still valid), `yw.platform-spec.md` (Astro 5, Cloudflare Pages hosting — actual is Vercel adapter + VPS/tunnel dev; "5–10 articles" vs 140 shipped), `yw.ops.md` ("Shopify store setup" timeline row), `yw.branding.md` ("visual direction TBD" — Atlas visual style exists).
- **Hosting decision (resolved)**: VPS + Cloudflare Tunnel for dev, Vercel adapter in code. CLAUDE.md records user explicitly rejected Cloudflare Pages/Workers. Spec's "Cloudflare Pages + Workers" section is obsolete.
- No session logs or daily notes touch YourWave between 2026-04-07 and 2026-07-19 — that period is undocumented.

## Local Dev DB (working since 2026-07-19)

- `supabase start` in `~/YW_Core` — all 5 migrations auto-applied (profiles, addresses, payments, article_reads, article_progress). Custom access token hook registered in `config.toml` and firing.
- `.env.local` rewritten with the fresh local keys (backup: `.env.local.bak-2026-07-19`); `yw-dev.service` restarted.
- Test user: `claude.test@gmail.com` (local-only), role `owner` set in BOTH `profiles.role` and `auth.users.raw_app_meta_data`.
- ⚠️ **RBAC bug found**: `src/middleware.ts:60` reads `getUser().app_metadata.role`, which comes from `raw_app_meta_data` in the DB — NOT from the JWT claim the `custom_access_token_hook` injects. The hook is effectively dead code for the middleware path; role gating only works if role is ALSO manually mirrored into `raw_app_meta_data`. Fix: read the claim from the validated JWT (or sync role → `raw_app_meta_data` via trigger).
- E2E verified via Playwright: login → `/crm` renders → Inventory renders (mock data). Inventory infinite-render did NOT reproduce on direct navigation; suspected to need in-app sidebar navigation path.
- Visible UI bugs from screenshot: literal `·` strings in Inventory "Origin · Variety" column (double-escaped unicode in mock data); breadcrumb shows "Dashboard > Dashboard > Inventory".

## M5 Stabilize — ✅ DONE (2026-07-19, commits c265aae..899d69e)

- RBAC middleware now reads role/blocked from JWT claims via `getClaims()` (hook no longer dead code); fails closed on auth outage. 15/15 tests.
- Inventory freeze root-caused: TanStack Table `_autoResetPageIndex` **microtask livelock** from unstable `[]`/`{}` prop defaults in DataTable — fixed with module-level stable defaults + `autoResetPageIndex: false`; debug instrumentation removed; regression unit test + formalized local e2e spec.
- `·` JSX-text escape bug + Dashboard breadcrumb dup fixed. Dead prototype routes/test-catch/auth-store residue deleted. Phase 16–19 planning deletions committed; phase-23 plans tracked.
- Verify: build clean, **975/0 vitest**, 10/10 browser e2e checks. Milestones M6 (frontend refactor public+CRM, TDD-first), M7 (real data layer), M8 (shop+bundle builder) queued this session.

## Next Goals (stated 2026-07-19 by Andrii)

Refactor frontend structure/architecture problem areas, then deliver: working **Atlas** (+ engagement/sales features), **Shop**, **Bundle Builder**, and a **working CRM** to manage it all. DB strategy: local Supabase stack for dev (started 2026-07-19), cloud project needs unpause or re-creation.
