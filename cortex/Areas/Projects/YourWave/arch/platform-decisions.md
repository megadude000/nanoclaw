---
cortex_level: L20
confidence: high
domain: yourwave
scope: >-
  YourWave platform v2 key technical decisions - stack choices, architecture
  patterns, rejected alternatives
project: YourWave
tags:
  - platform
  - architecture
  - decisions
  - stack
  - supabase
  - astro
  - multi-tenant
created: 2026-03-31T00:00:00.000Z
source_hash: d97446c245f0207ea2175aa5951375d8a63e815dc0208e428bb91298bb125c6c
embedding_model: text-embedding-3-small
---

# YourWave Platform v2 — Architecture Decisions

## Why a Full Rebuild from v1

The v1 codebase (.NET 8 + Next.js 15 + PostgreSQL + Docker + .NET Aspire) accumulated structural debt that made extension painful. The root cause was not the framework choice per se but that the architecture was built for a human developer, whereas the primary builder going forward is the AI agent swarm (Jarvis + Night Shift bots). Every v2 decision is evaluated through this lens: does this choice favor clear file boundaries, explicit contracts, and immediate feedback loops for agents?

Specific v1 failures that drove the rebuild:
- SignalR real-time configured but never wired to the frontend
- JWT auth without refresh tokens (session management broken)
- RabbitMQ and Redis configured but unused — infrastructure cost with no benefit
- Only 2 tests total — agents had no signal when something broke
- Bundle Builder UX designed but not implemented
- Monolithic structure made adding new modules slow

## Stack Decision: Astro + Supabase over .NET + Next.js

**Astro** was chosen over Next.js for the frontend. The Atlas (content) pages are primarily static HTML — Astro's island architecture means zero JavaScript ships for content pages, which is SEO-optimal and fast. Interactive features (Bundle Builder, Cart, CRM Dashboard) hydrate as React islands. Next.js App Router would ship React overhead to every static content page.

**Supabase** replaces the entire .NET backend. It provides PostgreSQL, Auth (with session management and automatic refresh tokens), Row-Level Security, Realtime via WebSocket, Storage, and Edge Functions. This eliminates the need for a custom server entirely, removing Docker complexity and making the architecture deployable to Cloudflare Pages without any server infrastructure to maintain.

**Rejected: Next.js** — better for SPAs; for content+commerce hybrid, Astro's static output wins on SEO and performance.
**Rejected: Custom .NET backend** — requires containerization and server maintenance; Supabase Cloud eliminates both.
**Rejected: RabbitMQ/Redis** — the only use cases that justified these in v1 are covered by Supabase Realtime and Edge Functions.
**Rejected: GraphQL** — REST via Supabase auto-generated API (PostgREST) is simpler and covers all current patterns. Reconsider only if CRM dashboard query complexity demands it.

## Security-First Architecture

Every table has Row-Level Security enabled with no exceptions. The policy model:
- Public data (products, Atlas content) → anon role, SELECT-only
- User data (orders, profiles) → authenticated role, user_id = auth.uid()
- Admin data (CRM, inventory) → service_role or custom admin claim
- Bot access (Jarvis, analytics) → read-only views, never raw tables
- Secrets → Supabase Vault or environment variables, never in Git

This was a hard constraint from the discovery session: "КРИТИЧНО: максимум security — RLS, ніяких витоків персональних даних, ніяких секретів у Git."

## Multi-Tenant Architecture (Phase 2 Ready, Not Phase 2 Required)

The platform is architected for multi-tenancy from day one — all tables have a `tenant_id` column, product types are configurable (coffee grams, flower stems, drink liters), and workflows are data not code branches. Phase 1 is a single-tenant YourWave Coffee instance. But the architecture must not block the SaaS vision: multiple business types (coffee shops, flower shops) sharing platform infrastructure with different product/unit/workflow configurations.

The decision to make multi-tenancy a structural constraint rather than a Phase 2 add-on was made because retrofitting tenant isolation into an existing data model is extremely disruptive; adding it from the start costs almost nothing.

## AI-Agent Optimized DX

Since Andrii no longer writes code and the AI agent swarm is the primary developer, every DX decision favors agents over humans:
- One file, one responsibility — agents produce better output with focused, single-responsibility files
- TypeScript strict mode everywhere — explicit types give agents immediate error signals
- Storybook mandatory — every visual component gets a story before it gets used in a page; agents get deep-link URLs for review
- CI gates: lint + typecheck + test on every PR — agents know immediately when something breaks
- Modular boundaries: each module (Atlas, Shop, Bundle Builder, CRM) is self-contained with its own types, queries, components, and stories

## One Site, Not Two

Atlas and Shop live at `yourwave.coffee` under one domain. Rejected: separate subdomain for Atlas (atlas.yourwave.coffee). The reader-to-buyer conversion is the core of the business model — a reader discovering an origin article should be able to add to cart without navigating to a separate domain. Single domain also maximizes SEO authority concentration.

## Bundle Builder as Core UX

Two modes: preset bundles (by region, process, roast, variety) and a custom 3-step constructor (search/filter → format + quantity → cart). Progress bar by grams, volume discounts growing with order size, free shipping as incentive. Minimum portion: 30g. No hard quantity cap — gamification drives larger orders. This is the core differentiator, not an add-on.

## Reversible Decisions Principle

Prefer choices that are easy to change over theoretically optimal choices:
- Supabase auto REST API now, custom endpoints if patterns demand it later
- Single Astro site now, micro-frontends only if performance requires it
- Zustand for client state now, migrate as patterns stabilize
- Start CZK + EUR, add currencies incrementally
