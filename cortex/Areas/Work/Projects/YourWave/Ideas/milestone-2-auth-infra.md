---
cortex_level: L20
confidence: high
domain: yourwave
scope: yw_core
tags:
  - milestone-2
  - auth
  - database
  - feature-flags
  - ci-cd
  - observability
created: 2026-03-31T00:00:00.000Z
updated: 2026-04-05T09:00:00.000Z
status: complete — all 6 phases done (2026-04-05)
source_hash: 2c931eba166d357ba16c3367bb48af4b2ea6fbcc4b248440d801851e9bc70933
embedding_model: text-embedding-3-small
---

# YW Core — Milestone 2: Auth, Database & Feature Flags

## Vision
Users can register/login, we persist their data securely, and we control what they see via feature flags + A/B testing. Foundation for monetization.

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 10 | Vercel Adapter + Hybrid Output | ✅ done |
| 11 | Supabase Schema + RLS | ✅ done |
| 12 | Auth Pages + Session Wiring | ✅ done (2026-04-02 nightshift) |
| 13 | CRM RBAC Wiring | ✅ done (2026-04-02 nightshift) |
| 14 | Feature Flags (PostHog) | ✅ done (2026-04-05 nightshift) |
| 15 | Observability + CI/CD | ✅ done (2026-04-05 nightshift) |

## What Shipped in Phases 12+13 (2026-04-02)

**Phase 12 — Auth Pages + Session:**
- `@supabase/ssr` installed; browser + server client factories
- `src/lib/auth/session.ts` — `getSession()` + `requireAuth()` server helpers
- Middleware with real JWT validation + session refresh via Supabase
- `/api/auth/callback.ts` for Google OAuth PKCE exchange
- Four auth pages: `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`
- React form islands: LoginForm, SignupForm, ForgotPasswordForm, ResetPasswordForm
- shadcn/ui added: input, label, card, separator, alert

**Key decisions (Phase 12):**
- Auth forms are client-side React — `supabase.auth.signInWithPassword()` in browser, SSR cookie sync
- No email confirmation on sign-up (Supabase dashboard toggle disabled)
- Forgot-password shows success copy regardless of whether email is registered (anti-enumeration)
- Apple Sign-In deferred — requires Apple Developer account
- Sign-out from CRM → `/auth/login`; from Atlas → referring page or `/`

**Phase 13 — CRM RBAC:**
- `useCrmAuthStore` removed, replaced with `usePermissions` hook
- UserMenu connected to real session
- Sidebar RBAC tests updated

## ✅ All Work Complete (2026-04-05)

**Phase 14 shipped:** PostHog SDK, `getting-started-free` + `podcast-paywall` feature flags, A/B scaffolding — 4/4 verified
**Phase 15 shipped:** Grafana Cloud + Loki + Prometheus, Faro lib, GitHub Actions CI/CD — 6/6 verified

## Tech Stack (locked)
| Layer | Choice |
|---|---|
| Auth | Supabase Auth (Google OAuth + email/password) |
| DB | Supabase (Postgres + RLS) |
| Feature flags | PostHog |
| Observability | Grafana Cloud |
| CI/CD | GitHub Actions |
