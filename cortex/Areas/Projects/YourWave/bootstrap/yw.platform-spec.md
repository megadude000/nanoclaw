---
cortex_level: L20
confidence: high
domain: yourwave
scope: yourwave — yw.platform-spec
type: bootstrap-extract
tags:
  - yourwave
  - bootstrap
  - platform
created: '2026-03-31'
project: yourwave
source_hash: 7f2b267c70089bd7524c6aa34ead1f041b73dd82baa5e0b85d195373f156913f
embedding_model: text-embedding-3-small
---
# YourWave Platform v2 — Architecture Specification

> Canonical reference for the YourWave platform rebuild.
> Source of truth for stack decisions, domain model, module boundaries, phasing, and non-functional requirements.

---

## 1. Overview

### What We Are Building

YourWave is a specialty coffee e-commerce platform with an integrated CRM — a single site at `yourwave.coffee` where content (Coffee Atlas), commerce (Shop + Bundle Builder), and operations (CRM Dashboard) live under one roof. Readers become buyers seamlessly. Operators manage everything from a desktop-first admin panel.

### Why Rebuild from v1

The v1 codebase (.NET 8 + Next.js 15 + PostgreSQL + Docker + .NET Aspire) shipped a functional prototype but accumulated structural debt that made extension painful:

| v1 Problem | v2 Response |
|------------|-------------|
| Monolithic .NET backend — "vse i odrazu" | Modular architecture with clear bounded contexts |
| JWT auth without refresh tokens | Supabase Auth with session management and RLS |
| SignalR real-time configured but never wired to frontend | Supabase Realtime with subscription-based updates |
| RabbitMQ + Redis configured but unused | Remove unused infrastructure; use Supabase Realtime + Edge Functions |
| 2 tests total | Testing strategy from day one (Vitest + Playwright + Storybook) |
| No payment or shipping integration | Integration Hub with Stripe + Packeta + Balikobot |
| Bundle Builder UX not built | 3-step wizard with gamification (research-backed) |
| Subscription logic not implemented | Architected for Phase 2 — no hardcoded assumptions |
| Frontend DX optimized for human dev | DX optimized for AI-agent development (the primary builder) |

### Guiding Constraint

Andrii no longer writes code. The AI agent swarm (Jarvis + Night Shift bots) is the primary development workforce. Every architectural choice must favor:
- Clear file boundaries (agents work best with focused, single-responsibility files)
- Explicit contracts (types, schemas, interfaces over implicit conventions)
- Automated quality gates (linting, type-checking, tests — agents must know immediately when something breaks)

---

## 2. Stack

### Core Technologies

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Astro 5 | Content-first SSG/SSR with island architecture. Atlas pages are static HTML (fast, SEO-optimal). Interactive features hydrate as React islands. |
| **UI Islands** | React 19 | Interactive components (Bundle Builder, Cart, CRM Dashboard) hydrate client-side. Astro's island architecture means zero JS ships for static content pages. |
| **Styling** | Tailwind CSS v4 | Utility-first, design token system via CSS custom properties. Dark mode built-in. Pairs natively with shadcn/ui. |
| **Components** | shadcn/ui + Radix UI | Copy-paste ownership model. Accessible primitives (Radix) with Tailwind styling. No version lock-in. |
| **Backend / BaaS** | Supabase (Cloud) | PostgreSQL + Auth + RLS + Realtime + Storage + Edge Functions. Eliminates the need for a custom backend server. |
| **Database** | PostgreSQL (via Supabase) | Same engine as v1. JSONB for template metadata. RLS for row-level security on all tables. |
| **Auth** | Supabase Auth | Email/password + OAuth (Google). Session-based with automatic token refresh. RBAC via custom claims in JWT. |
| **Hosting** | Cloudflare Pages | Edge-deployed SSR/SSG. Globally distributed. Integrates with Cloudflare Workers for edge logic (geo detection, redirects). |
| **Payments** | Stripe | Primary payment provider. All 6 currencies (CZK, EUR, PLN, NOK, SEK, DKK). Apple Pay + Google Pay. Native Supabase sync. See [payment-providers.md]. |
| **Shipping** | Packeta + Balikobot + FedEx | 3 API integrations cover all requirements. Packeta for CZ + EU pickup, Balikobot for CZ domestic carriers, FedEx for premium international. See [shipping-providers.md]. |
| **State (client)** | Zustand | Lightweight global state for cart, bundle builder, user preferences. Persists to localStorage. |
| **Data Fetching** | TanStack Query | Async server state management. Caching, deduplication, background refresh. |
| **Forms** | React Hook Form + Zod | Form state + schema-based validation. Per-step validation for wizards. |
| **Animations** | Framer Motion | Step transitions, micro-animations for gamification (progress bars, celebrations). |
| **Component Dev** | Storybook 8 | Mandatory. Every visual component gets a story before it gets used in a page. Deep-link to specific stories for review. |
| **Testing** | Vitest + Playwright | Unit/integration (Vitest) + E2E (Playwright). Storybook interaction tests for visual components. |
| **i18n** | Paraglide.js (or astro-i18n) | Compile-time i18n. EN/UK/CZ with content-driven translations for Atlas. |

### What We Explicitly Do Not Use

| Technology | Reason |
|------------|--------|
| .NET / C# | Replaced by Supabase (BaaS) + Edge Functions |
| Next.js | Astro provides better content/commerce hybrid. React used only as islands. |
| Docker / .NET Aspire | No custom server to containerize. Supabase Cloud + Cloudflare Pages. |
| RabbitMQ / Redis | Supabase Realtime + Edge Functions cover the use cases that justified these in v1. |
| SignalR | Replaced by Supabase Realtime (WebSocket-based, already wired to the database). |
| GraphQL | REST via Supabase auto-generated API (PostgREST). Simpler, less overhead. Reconsider only if CRM dashboard query patterns demand it. |

---

## 3. Architecture Principles

### 3.1 Security-First

Every table has Row-Level Security (RLS) enabled. No exceptions. No table is accessible without a policy.

```
Public data (products, Atlas content)  → anon role with SELECT-only policies
User data (orders, profiles)           → authenticated role, user_id = auth.uid()
Admin data (CRM, inventory)            → service_role or custom admin claim
Bot access (Jarvis, analytics)         → Read-only views, never raw tables
Secrets                                → Supabase Vault or environment variables, never in Git
```

**RLS Policy Template:**
```sql
-- Every new table starts with this
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Then add specific policies:
-- Public read:
CREATE POLICY "Public read" ON {table_name} FOR SELECT TO anon USING (is_active = true);

-- Authenticated user access:
CREATE POLICY "User owns row" ON {table_name} FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin access:
CREATE POLICY "Admin full access" ON {table_name} FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'owner'));
```

### 3.2 Modular Boundaries

Each module (Atlas, Shop, Bundle Builder, CRM, Inventory, Integration Hub) is a self-contained directory with:
- Its own types/schemas
- Its own Supabase queries (no cross-module direct DB access)
- Its own components
- Its own Storybook stories
- Explicit public API (exported functions/types)

Cross-module communication happens through:
- Shared Supabase tables (with clear ownership — one module owns writes, others read)
- Domain events via Supabase Realtime (publish/subscribe)
- Shared types package for common entities

### 3.3 Multi-Tenant Ready (Phase 2)

Phase 1 is single-tenant (YourWave Coffee). But the architecture must not block multi-tenancy:

- **No hardcoded product types** — "coffee" is a category, not a structural assumption
- **Configurable units** — grams, pieces, stems (flowers), liters — stored in tenant config, not code
- **Tenant-scoped RLS** — add `tenant_id` column to all tables from day one, default to a single tenant
- **Configurable workflows** — order pipeline steps are data, not code branches

### 3.4 Reversible Decisions

Prefer choices that are easy to change over choices that are theoretically optimal:
- Supabase auto-generated REST API now, custom endpoints later if needed
- Single Astro site now, split into micro-frontends only if performance demands it
- Zustand for state now, migrate to server state (TanStack Query) as patterns stabilize
- Start with CZK + EUR, add currencies incrementally

### 3.5 AI-Agent Optimized DX

- **One file, one responsibility** — agents produce better output with focused files
- **Explicit types everywhere** — TypeScript strict mode, Zod schemas for runtime validation
- **Storybook-driven development** — agents build components in isolation, review via deep links
- **Automated gates** — CI runs lint + typecheck + test on every PR. Agents get immediate feedback.

---

## 4. Domain Model

### 4.1 Core Entities

```
┌─────────────────────────────────────────────────────────────┐
│                     CATALOG DOMAIN                          │
│                                                             │
│  Template ──< SellUnit ──< Recipe ──< RecipeMaterial        │
│     │            │                        │                 │
│     │            │                    Material              │
│     │            │                        │                 │
│     │        ProductPrice ──> Currency    InventoryItem     │
│     │                                                       │
│  TemplateField (JSONB dynamic fields)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     COMMERCE DOMAIN                         │
│                                                             │
│  Cart ──< CartItem ──> SellUnit                             │
│   │                                                         │
│  Order ──< OrderItem ──> SellUnit                           │
│   │          │                                              │
│   │       OrderItemPrice (locked currency + amount)         │
│   │                                                         │
│  Shipment ──> Carrier + TrackingNumber                      │
│   │                                                         │
│  Payment ──> Stripe PaymentIntent                           │
│                                                             │
│  Bundle ──< BundleItem ──> SellUnit (quantity, format)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     CUSTOMER DOMAIN                         │
│                                                             │
│  Customer (Supabase Auth user + profile)                    │
│   │                                                         │
│   ├── Address[] (billing, shipping)                         │
│   ├── Order[]                                               │
│   ├── Subscription[] (Phase 2)                              │
│   └── Preferences (currency, language, favorites)           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     INVENTORY DOMAIN                        │
│                                                             │
│  InventoryItem ──> Material                                 │
│   │                                                         │
│  InventoryLedger (typed transactions)                       │
│   │  Types: Add, Reserve, Consume, Release, Adjust          │
│   │                                                         │
│  (Phase 2: RoastBatch ──> raw kg → roasted kg conversion)   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     CONTENT DOMAIN                          │
│                                                             │
│  AtlasArticle (origin country/region content)               │
│   │                                                         │
│   ├── AtlasTranslation[] (EN, UK, CZ)                      │
│   ├── RelatedProducts[] ──> Template                        │
│   └── SEO metadata (per locale)                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Template-Driven Catalog (from v1)

The product catalog is template-driven. A **Template** defines a product type with dynamic fields (JSONB). A **Sell Unit** is the purchasable entity (e.g., "Ethiopia Yirgacheffe — 250g bag, medium grind").

```
Template: "Ethiopia Yirgacheffe"
  ├── metadata (JSONB): { origin, altitude, variety, process, flavor_notes, sca_score }
  ├── SellUnit: "Drip Bag 30g" → price: 89 CZK, weight: 30
  ├── SellUnit: "Ground 250g"  → price: 349 CZK, weight: 250
  ├── SellUnit: "Capsule 10-pack" → price: 199 CZK, weight: 60
  └── Recipe for each SellUnit:
        └── RecipeMaterial: { material: "Ethiopia Yirg Raw", quantity: 35g }
```

When an order is placed, Recipes calculate material consumption and create Inventory ledger entries (Reserve → Consume).

### 4.3 Key Schema Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monetary amounts | `BIGINT` in smallest currency unit (hellers, cents) | Avoids floating-point errors. 29990 = 299.90 CZK. |
| Currency codes | `CHAR(3)` ISO 4217 | Standard. CZK, EUR, PLN, NOK, SEK, DKK. |
| Dynamic product fields | `JSONB` column on templates | Same as v1. Flexible per-product metadata without schema migrations. |
| Tenant isolation | `tenant_id UUID` on all tables (default single tenant) | Phase 2 multi-tenancy without migration. |
| Soft deletes | `is_active BOOLEAN` + `deleted_at TIMESTAMPTZ` | Never lose data. Filter in queries + RLS policies. |
| Timestamps | `created_at` + `updated_at` (TIMESTAMPTZ, UTC) | Standard audit trail. Triggers for auto-update. |
| UUIDs | `gen_random_uuid()` as default PK | Supabase standard. No sequential ID leakage. |

---

## 5. Module Breakdown

### 5.1 Coffee Atlas

**Purpose:** Content hub for coffee origins, regions, processing methods, and brewing guides. Primary SEO surface. Reader-to-buyer conversion funnel.

**Rendering:** Static (SSG via Astro). Pre-rendered at build time. Zero client-side JS unless interactive elements are present.

**i18n:** EN / UK / CZ. Content stored as markdown or in Supabase with locale variants. URL structure: `/en/atlas/ethiopia`, `/uk/atlas/ethiopia`, `/cs/atlas/ethiopia`.

**Features:**
- Origin country pages with region deep-dives
- Processing method explainers (washed, natural, honey, anaerobic)
- Brewing guides per method
- Flavor profile visualizations (radar charts — React island)
- "Buy coffees from this origin" CTAs linking to Shop with pre-applied filters
- SEO: structured data (JSON-LD), hreflang tags, sitemap generation
- Breadcrumbs: Atlas > Ethiopia > Yirgacheffe

**Data Model:**
```sql
CREATE TABLE atlas_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL, -- 'origin', 'process', 'brew_guide'
    cover_image_url TEXT,
    metadata JSONB DEFAULT '{}',
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE atlas_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES atlas_articles(id) ON DELETE CASCADE,
    locale CHAR(2) NOT NULL, -- 'en', 'uk', 'cs'
    title TEXT NOT NULL,
    subtitle TEXT,
    body TEXT NOT NULL, -- Markdown
    seo_title TEXT,
    seo_description TEXT,
    UNIQUE(article_id, locale)
);
```

**Directory:**
```
src/modules/atlas/
├── pages/            # Astro pages ([locale]/atlas/[slug].astro)
├── components/       # AtlasCard, OriginMap, FlavorRadar (React island)
├── layouts/          # AtlasLayout.astro
├── lib/              # getArticle(), getArticlesByCategory()
└── types.ts          # AtlasArticle, AtlasTranslation
```

---

### 5.2 Bundle Builder

**Purpose:** Custom coffee bundle creator. 3-step wizard with gamification. Core conversion feature.

**Rendering:** React island hydrated on the bundle page. Full client-side interactivity.

**Research Reference:** [bundle-builder-ux.md] — benchmarks, wizard patterns, gamification mechanics, pricing psychology.

**3-Step Wizard:**

```
Step 1: DISCOVER
├── Smart filters: origin, process, roast, variety, flavor notes
├── Optional "Help me choose" flavor quiz (5 questions)
├── Product cards with quick-add (image, name, roast badge, flavor tags, price)
├── Sticky bottom progress bar: "0g / 250g minimum"
└── "Next: Configure" enabled when >= 1 item selected

Step 2: CONFIGURE
├── Per-item: format (drip bag / capsule / ground bag)
├── Per-item: grind size (if ground selected)
├── Per-item: quantity (30g increments, min 30g)
├── Running total with discount tier preview
└── "Review Bundle"

Step 3: REVIEW & CHECKOUT
├── Full bundle summary with editable quantities
├── Gamification dashboard:
│   ├── Progress bar (grams filled, color-coded milestones)
│   ├── Current discount tier + "add X to unlock next tier"
│   ├── Free shipping progress
│   └── Real-time savings display
├── "You might also like" suggestions
├── One-off vs. subscription toggle (Phase 2)
└── Proceed to checkout
```

**Gamification Tiers (MVP):**
- Base (any amount): standard pricing
- Tier 1 (500g+): 5% off — "Unlock 5% off! Add Xg more"
- Tier 2 (750g+): 10% off — "Coffee enthusiast! 10% off"
- Tier 3 (1kg+): 15% off — "Connoisseur discount unlocked!"
- Free shipping threshold: configurable, dynamic messaging

**State Management:**
```typescript
// Zustand store — persisted to localStorage
interface BundleState {
  currentStep: number;
  items: BundleItem[];        // { sellUnitId, format, grind, quantity }
  totalGrams: number;
  currentTier: DiscountTier;
  savingsAmount: number;
  shippingUnlocked: boolean;
}
```

**Critical Rule:** Server-side price validation. Client calculates for display; server re-validates at checkout. Never trust client-side pricing.

**Directory:**
```
src/modules/bundle-builder/
├── BundleBuilder.tsx           # Main orchestrator (React island)
├── BundleWizard.tsx            # Step controller
├── stores/
│   └── useBundleStore.ts       # Zustand
├── steps/
│   ├── DiscoverStep.tsx
│   ├── ConfigureStep.tsx
│   └── ReviewStep.tsx
├── components/
│   ├── CoffeeCard.tsx
│   ├── FlavorQuiz.tsx
│   ├── FilterPanel.tsx
│   ├── ProgressBar.tsx
│   ├── DiscountTier.tsx
│   ├── ShippingThreshold.tsx
│   └── BundleSummary.tsx
├── hooks/
│   ├── useBundlePricing.ts
│   ├── useGamification.ts
│   └── useRecommendations.ts
├── schemas/
│   └── bundleSchema.ts         # Zod per-step validation
└── types.ts
```

---

### 5.3 Shop

**Purpose:** Product catalog, cart, checkout, and payment processing.

**Rendering:** Catalog pages are SSR (Astro) for SEO. Cart and checkout are React islands.

**Features:**
- Product listing with filters (same filter engine as Bundle Builder)
- Product detail pages (SSR) with sell unit selection
- Cart drawer (slide-out, persistent across pages)
- Multi-step checkout: shipping address -> shipping method -> payment -> confirmation
- Multi-currency: detect from geo (Cloudflare `CF-IPCountry`), manual override via dropdown
- Price display: always in customer's currency, VAT-inclusive (EU B2C requirement)
- Stripe Elements for payment (Apple Pay, Google Pay, saved cards)

**Multi-Currency Architecture (Hybrid Model):**
```
products.base_price_amount (BIGINT, CZK smallest unit)
    |
    v
Daily cron (ECB/Frankfurter API) → exchange_rates table
    |
    v
Auto-generate product_prices for all 6 currencies
    |
    v
Manual override: is_manual = true skips auto-conversion
    |
    v
At checkout: price locked from product_prices, exchange rate locked into order
```

See [multi-currency.md] for full schema and implementation details.

**Checkout Flow:**
```
Cart → Address → Shipping Method → Payment → Confirmation
                    |                  |
                    v                  v
            Shipping Hub           Stripe Payment
            (rate calc)            Intent API
```

**Directory:**
```
src/modules/shop/
├── pages/
│   ├── products/[slug].astro    # PDP
│   └── checkout/                # Checkout steps
├── components/
│   ├── ProductCard.tsx
│   ├── ProductGrid.tsx
│   ├── CartDrawer.tsx
│   ├── CartItem.tsx
│   ├── CheckoutForm.tsx
│   ├── ShippingMethodSelector.tsx
│   ├── CurrencySelector.tsx
│   └── PriceDisplay.tsx
├── hooks/
│   ├── useCart.ts
│   └── useCheckout.ts
├── lib/
│   ├── currency.ts              # formatPrice(), detectMarket()
│   ├── cart.ts                  # Cart operations
│   └── checkout.ts              # Checkout orchestration
├── stores/
│   └── useCartStore.ts          # Zustand
└── types.ts
```

---

### 5.4 CRM Dashboard

**Purpose:** Operational hub for managing orders, customers, products, inventory, and integrations. AI-driven, modular widget system.

**Rendering:** Full React island. Client-side SPA behind auth. Desktop-only (mobile shows "switch to desktop" message, iPad web OK).

**Research Reference:** [crm-ui-patterns.md] — Linear-style layout, data tables, command palette, density modes, dark mode.

**Layout: Three-Column Pattern**
```
[Sidebar 220px] [Main Content flex] [Detail Panel 360px]
```
- Sidebar: collapsible navigation, recent items, favorites
- Main: list/table/board/calendar views per module
- Detail panel: slides in on item click, editable inline, dismissible

**Core CRM Features:**

| Feature | Description |
|---------|-------------|
| Command Palette (Cmd+K) | Universal search + actions. Find any order, customer, product in 2 keystrokes. |
| Order Pipeline | Horizontal status visualization: New -> Confirmed -> Roasting -> Packed -> Shipped -> Delivered |
| Data Tables | TanStack Table — sortable, filterable, bulk actions, inline editing, saved views |
| Quick Filters | Status pills above tables. Saved filter combinations. |
| Widget Dashboard | Drag-and-drop KPI widgets. Revenue, orders pipeline, top products, low stock alerts, AI insights. |
| Dark Mode | System preference detection + manual toggle. CSS custom properties swap. |
| Density Toggle | Comfortable (default) / Compact mode for power users. |
| Breadcrumbs | Dashboard > Orders > Order #1234. Always clickable. |
| Card + Table Toggle | Products section offers both views. |

**RBAC per Module:**

```typescript
type Role = 'owner' | 'manager' | 'roaster' | 'support';

const MODULE_ACCESS: Record<Role, string[]> = {
  owner:   ['*'],                                    // Everything
  manager: ['orders', 'customers', 'products', 'analytics', 'inventory'],
  roaster: ['inventory', 'roast_batches'],           // Only batch roasting + inventory
  support: ['orders', 'customers'],                  // Read-only + order actions
};
```

Implemented via Supabase Auth custom claims (`app_metadata.role`) checked both in RLS policies (server) and route guards (client).

**AI-Driven Dashboard (Vision):**
- Jarvis (Telegram) as notification layer: "Ethiopia running low", "3 pending orders"
- Dashboard modules are contextual: Jarvis decides which widgets to surface based on current state/alerts
- Morning briefing widget with daily summary
- "You haven't checked X in 2 weeks — hide it?" suggestions

**Directory:**
```
src/modules/crm/
├── layouts/
│   └── DashboardLayout.tsx      # Three-column with sidebar
├── pages/
│   ├── DashboardPage.tsx
│   ├── OrdersPage.tsx
│   ├── CustomersPage.tsx
│   ├── ProductsPage.tsx
│   ├── AnalyticsPage.tsx
│   └── SettingsPage.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── CommandPalette.tsx       # cmdk library
│   ├── DetailPanel.tsx
│   ├── DataTable.tsx            # TanStack Table wrapper
│   ├── FilterBar.tsx
│   ├── OrderPipeline.tsx
│   ├── MetricCard.tsx
│   ├── WidgetGrid.tsx           # Gridstack.js
│   └── DensityToggle.tsx
├── widgets/
│   ├── RevenueWidget.tsx
│   ├── OrdersPipelineWidget.tsx
│   ├── TopProductsWidget.tsx
│   ├── LowStockWidget.tsx
│   ├── RecentOrdersWidget.tsx
│   └── AIInsightsWidget.tsx
├─

[truncated — source document exceeds embedding token limit]
