---
cortex_level: L20
confidence: high
domain: yourwave
scope: yw_core
tags:
  - yw-core
  - gsd
  - milestone-2
  - crm
  - atlas
  - auth
  - status
created: 2026-04-01T00:00:00.000Z
updated: 2026-04-07T03:00:00.000Z
status: milestone-2-complete
source_hash: ca1846592f62f84908a11d3aff8fdab8d6337b426bb99047c2343cbd7ff33f71
embedding_model: text-embedding-3-small
---

# YW Core — Current State (2026-04-07)

## GSD Milestone 1: ✅ COMPLETE

All 9 CRM phases shipped as of 2026-04-01.

## GSD Milestone 2: Backend Foundation — ✅ COMPLETE (2026-04-05)

| Phase | Name | Status |
|-------|------|--------|
| 10 | Vercel Adapter + Hybrid Output | ✅ |
| 11 | Supabase Schema + RLS | ✅ |
| 12 | Authentication Pages + Session Wiring | ✅ nightshift/2026-04-02 |
| 13 | CRM RBAC Wiring (useCrmAuthStore removal) | ✅ nightshift/2026-04-02 |
| 14 | Feature Flags (PostHog) | ✅ nightshift/2026-04-05 — 4/4 verified |
| 15 | Observability + CI/CD | ✅ nightshift/2026-04-05 — 6/6 verified |

### Phase 12 — what shipped (2026-04-02)

- `@supabase/ssr` installed; `createSupabaseBrowserClient` + `createSupabaseServerClient` factories
- `src/lib/auth/session.ts` — `getSession()` + `requireAuth()` server helpers
- Middleware with real `getUser()` JWT validation + session refresh; CRM role gate
- `/api/auth/callback.ts` — `exchangeCodeForSession()` for Google OAuth
- Four auth pages: login, signup, forgot-password, reset-password (split-layout dark brand)
- React form islands: LoginForm, SignupForm, ForgotPasswordForm, ResetPasswordForm
- shadcn/ui added: input, label, card, separator, alert
- `src/lib/auth.ts` — `useAuth()` hook; MockAuthProvider test helper
- Middleware tests updated (9 cases)
- Branch: `nightshift/2026-04-02`, commit `0bef394`

### Key decisions (Phase 12)
- Auth forms are client-side React — cookie sync via `@supabase/ssr`
- No email confirmation on sign-up (Supabase dashboard toggle disabled)
- Forgot-password: success copy shown regardless of email existence (anti-enumeration)
- Apple Sign-In deferred (needs Apple Developer account)
- Sign-out CRM → `/auth/login`; Atlas → referring page or `/`

### Phase 13 — what shipped (2026-04-02)
- `useCrmAuthStore` removed, `usePermissions` hook in place
- UserMenu connected to real Supabase session
- Sidebar RBAC tests updated

## Coffee Atlas

| Locale | Articles | Last updated |
|--------|----------|-------------|
| EN | 140 | 2026-04-07 |
| CS | 140 | 2026-04-07 |
| UK | 140 | 2026-04-07 |

### Categories in Atlas
- Getting Started (25+: tasting wheel, whole bean vs ground, equipment cleaning, certifications)
- Origins (incl. Prague cafe guide), Processing Methods, Equipment, Brewing Guides, Science, History, Specialty Culture, Glossary

### Nightshift additions (nightshift/2026-04-07)
- ✅ coffee-tasting-wheel.mdx (EN+CS+UK) — SCA flavour wheel guide
- ✅ buying-whole-bean-vs-pre-ground.mdx (EN+CS+UK)
- ✅ cleaning-your-coffee-equipment.mdx (EN+CS+UK)
- ✅ understanding-coffee-certifications.mdx (EN+CS+UK) — organic/Fair Trade/RA/direct trade
- ✅ aeropress-guide.mdx (EN+CS+UK) — complete brewing guide
- ✅ siphon-coffee-brewing.mdx (EN+CS+UK)
- ✅ moka-pot-guide.mdx (EN+CS+UK)
- ✅ cold-brew-complete-guide.mdx (EN+CS+UK)
- ✅ Hero images for all 8 via Imagen 4 Fast
- ✅ PR #18 (nightshift/2026-04-06) merged to main before this batch

### gen_remaining.mjs (preferred) / gen_remaining.py
- ✅ Node.js version at `/workspace/group/nightshift/gen_remaining.mjs` — no pip needed, uses fetch()
- ✅ Python version at `/workspace/group/nightshift/gen_remaining.py` — now a thin wrapper calling gen_remaining.mjs (no google-genai pip required)
- Preferred: `node /workspace/group/nightshift/gen_remaining.mjs` (always works in container)
- Dry run: `DRY_RUN=1 node /workspace/group/nightshift/gen_remaining.mjs`
- Both scan all EN articles for missing heroImages, generate via Imagen 4 Fast

## Test Coverage (as of 2026-04-07)

- **409 passing / 0 failing** — branch `nightshift/2026-04-07`
- No regressions; all suites green after CRM a11y fixes
- +36 new tests (nightshift/2026-04-06): Users module types (15), useUsers hook (14), computeMetrics (7)
- +25 new tests: CommandPalette (11) + FilterBar (14) — nightshift/2026-04-05
- +4 new tests: Faro lib (faro.ts) — Phase 15
- +18 new tests: PostHog identify/gate components — Phase 14

### New test files added 2026-04-03

| File | Tests |
|------|-------|
| `src/modules/crm/components/layout/nav/__tests__/NavPinButton.test.tsx` | 8 |
| `src/lib/auth/__tests__/session.test.ts` | 7 |
| `src/modules/crm/components/filter-bar/__tests__/FilterBar.test.tsx` | 16 |
| `src/modules/crm/components/__tests__/CrmErrorBoundary.test.tsx` | 8 |
| `src/modules/crm/components/ui/__tests__/ConfirmDialog.test.tsx` | 10 |
| `src/components/auth/__tests__/ResetPasswordForm.test.tsx` | 12 |

### Testing patterns (decisions)

- RTL tests without `@testing-library/jest-dom` global setup must use `afterEach(() => cleanup())` explicitly
- Mock path depth from a `__tests__/` subdirectory is always one level deeper than from the component file itself (e.g., `../../ComponentName` becomes `../../../ComponentName` inside `__tests__/`)

## Build Status
- ✅ `ASTRO_TELEMETRY_DISABLED=1 npm run build` passing as of 2026-04-07
- Branch: `nightshift/2026-04-07` — 140 EN + 140 CS + 140 UK articles
- Note: always use `ASTRO_TELEMETRY_DISABLED=1` prefix in container (no write access to `/home/node/.config/astro`)

## GSD Milestone 3: Stripe Payments — ⚠️ BLOCKED

| Phase | Name | Status |
|-------|------|--------|
| 17 | Stripe Integration | ⚠️ BLOCKED — waiting for STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET + STRIPE_PRICE_ID |

Phase 17 cannot proceed until Stripe API keys are provided by Andrii.

## Active Branches
- `nightshift/2026-04-07` — current active branch (8 new articles + CRM a11y + gen_remaining.py fix)
