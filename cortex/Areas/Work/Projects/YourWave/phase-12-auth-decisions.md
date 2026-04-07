---
cortex_level: L20
confidence: high
domain: yourwave
scope: auth
type: decision-log
tags:
  - auth
  - supabase
  - phase-12
  - ssr
  - decisions
created: 2026-04-02T23:55:00.000Z
updated: 2026-04-02T23:55:00.000Z
source_hash: faaf464c7a43ea044a67e185c1a70bb78984deb62640903ad1323e2d03b25087
embedding_model: text-embedding-3-small
---

# Phase 12 — Auth Architecture Decisions

> Committed: `0bef394` on `nightshift/2026-04-02`

## Decisions Locked

**Auth forms are client-side React islands**
`supabase.auth.signInWithPassword()` runs in browser; `@supabase/ssr` syncs the resulting session into HTTP-only cookies automatically. No server POST routes for auth.

**No email confirmation on signup**
Disabled via Supabase dashboard toggle. Users get immediate sessions.

**Forgot-password anti-enumeration**
Success copy shown regardless of whether email is registered — prevents probing which accounts exist.

**No CS/UK locale auth pages**
Auth lives at `/auth/*` only. The `cs/` and `uk/` prefixes cover Atlas content only. `prefixDefaultLocale: false` means `/auth/*` is the default locale route — no duplicates needed.

**Sign-out routing**
- From CRM → `/auth/login`
- From Atlas → referring public page or `/`

**Apple Sign-In deferred**
Requires Apple Developer account — not yet available.

**`@supabase/ssr` version**
`0.10.0` — uses `getAll`/`setAll` cookie pattern (not deprecated `get`/`set`/`remove`).

**Protected routes**
- `/crm/*` → requires authenticated session
- `/account/*` → requires authenticated session
- `/auth/*` and `/api/auth/*` → bypass guard freely
