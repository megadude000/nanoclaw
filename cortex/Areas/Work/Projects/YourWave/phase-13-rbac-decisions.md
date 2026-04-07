---
cortex_level: L20
confidence: high
domain: yourwave
scope: crm-rbac
type: decision-log
tags:
  - crm
  - rbac
  - phase-13
  - auth
  - decisions
created: 2026-04-02T23:58:00.000Z
updated: 2026-04-02T23:58:00.000Z
source_hash: d1066a9ab8fb2a37cd81bb2807f0f65d580a5d20ff77e443fb142a5854d99e7c
embedding_model: text-embedding-3-small
---

# Phase 13 — CRM RBAC Architecture Decisions

> Commits: `4a132ed`, `1fb85b4`, `805e3d7` on `nightshift/2026-04-02`

## Decisions Locked

**Role source: JWT app_metadata**
`useAuth()` reads role from `session.user.app_metadata.role` — the claim injected by the Phase 11 Custom Access Token Hook. Not from a database query, not from localStorage.

**Non-CRM users redirect to Atlas home (`/`)**
Authenticated users without a CRM-eligible role hitting `/crm/*` are redirected to `/` (Atlas), NOT to `/auth/login`. Unauthenticated users still go to `/auth/login`.

**`useCrmAuthStore` fully deleted**
Replaced by `useAuth()` hook. A tombstone test file documents the removal. The stale `crm-auth` localStorage key is cleared on `CrmApp` mount.

**`MockAuthProvider` for Storybook isolation**
Stories use `MockAuthProvider` context wrapper instead of Zustand store setState. Keeps stories isolated from real Supabase client.

**Dev role switcher removed from UserMenu**
Replaced by real user email + role display from `useAuth()`.

**Requirements closed**
- RBAC-05 ✅
- RBAC-06 ✅

**TS error baseline**
42 pre-existing Storybook story type errors — unchanged by Phase 13. Not a regression.
