---
type: architecture-spec
cortex_level: L30
confidence: high
domain: yourwave
scope: >-
  YourWave platform v2 full architecture spec - stack, modules, security, domain
  model, phasing
project: YourWave
created: 2026-03-23T00:00:00.000Z
updated: 2026-03-31T00:00:00.000Z
status: draft
tags:
  - platform
  - architecture
  - spec
  - ywproject-v2
source_hash: 3e937e33b9109758dc34f0ec6c1cfa73fd040bf7510fdfd4e0cc285f070af53e
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
├── hooks/
│   ├── useRBAC.ts
│   ├── useDashboardLayout.ts
│   └── useCommandPalette.ts
└── types.ts
```

---

### 5.5 Inventory

**Purpose:** Track material availability. Simple in/out with ledger-based accounting. Batch tracking deferred to Phase 2.

**Phase 1 (MVP): Simple Inventory**
- Material has a current quantity (derived from ledger sum)
- Ledger entries: Add, Reserve (on order), Consume (on fulfillment), Release (on cancellation), Adjust (manual correction)
- Low-stock alerts based on configurable thresholds
- Availability derived from recipes: if all materials for a SellUnit's recipe are in stock, the SellUnit is available

**Phase 2: Batch Tracking**
- RoastBatch: raw material kg -> roasted material kg (with conversion ratio)
- Batch-level traceability (which batch went into which order)
- Roast scheduling and tracking UI (roaster role)

**Data Model:**
```sql
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '{default_tenant}',
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',    -- g, kg, pieces, ml
    low_stock_threshold INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id),
    transaction_type TEXT NOT NULL,    -- 'add', 'reserve', 'consume', 'release', 'adjust'
    quantity INTEGER NOT NULL,         -- positive for add/release, negative for reserve/consume
    reference_type TEXT,               -- 'order', 'roast_batch', 'manual'
    reference_id UUID,                 -- FK to orders/roast_batches
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Current stock = SUM(quantity) from inventory_ledger grouped by material_id
CREATE VIEW material_stock AS
SELECT
    material_id,
    SUM(quantity) AS current_quantity,
    SUM(CASE WHEN transaction_type = 'reserve' THEN ABS(quantity) ELSE 0 END) AS reserved_quantity
FROM inventory_ledger
GROUP BY material_id;
```

**Directory:**
```
src/modules/inventory/
├── components/
│   ├── StockTable.tsx
│   ├── LedgerView.tsx
│   └── LowStockAlert.tsx
├── lib/
│   ├── inventory.ts             # Stock queries, ledger operations
│   └── availability.ts          # Recipe-based availability calculation
└── types.ts
```

---

### 5.6 Integration Hub

**Purpose:** Unified abstraction layer for external service integrations (payments, shipping, exchange rates). Managed from a dedicated CRM section with tiles/cards per integration.

**Architecture: Adapter Pattern**
```
[Integration Hub]
├── PaymentAdapter (interface)
│   └── StripeAdapter           → Stripe API
│       (Phase 2: ComgateAdapter for CZ bank transfers)
│
├── ShippingAdapter (interface)
│   ├── PacketaAdapter          → Packeta REST API (CZ + EU pickup)
│   ├── BalikobotAdapter        → Balikobot API v2 (PPL, DPD, Balikovna, GLS)
│   └── FedExAdapter            → FedEx REST API (premium international)
│
├── ExchangeRateAdapter (interface)
│   └── ECBAdapter              → Frankfurter API (ECB rates, free)
│
└── NotificationAdapter (interface)
    └── TelegramAdapter         → Jarvis bot for ops notifications
```

**Adapter Interface (Shipping example):**
```typescript
interface ShippingAdapter {
  getKey(): string;
  getName(): string;
  getRates(params: RateRequest): Promise<ShippingRate[]>;
  createShipment(params: ShipmentRequest): Promise<Shipment>;
  getLabel(shipmentId: string): Promise<Buffer>; // PDF
  getTracking(shipmentId: string): Promise<TrackingEvent[]>;
  cancelShipment(shipmentId: string): Promise<boolean>;
}

interface RateRequest {
  origin: Address;
  destination: Address;
  weight: number;      // grams
  dimensions?: Dimensions;
  currency: string;
}
```

**CRM Integration Hub UI:**
- Grid of integration tiles (Stripe, Packeta, Balikobot, FedEx, ECB)
- Status indicator per integration (connected/error/disabled)
- Quick actions: test connection, view logs, configure
- Webhook event log with retry capability

**Directory:**
```
src/modules/integrations/
├── adapters/
│   ├── payments/
│   │   └── stripe.ts
│   ├── shipping/
│   │   ├── packeta.ts
│   │   ├── balikobot.ts
│   │   └── fedex.ts
│   ├── exchange-rates/
│   │   └── ecb.ts
│   └── notifications/
│       └── telegram.ts
├── components/
│   ├── IntegrationTile.tsx
│   ├── IntegrationGrid.tsx
│   └── WebhookLog.tsx
├── lib/
│   ├── rate-calculator.ts       # Queries all shipping adapters, applies business rules
│   └── shipment-manager.ts      # Creates shipments via selected adapter
└── types.ts                     # Shared adapter interfaces
```

---

### 5.7 User & Auth

**Purpose:** Authentication, authorization, user profiles, and role management.

**Provider:** Supabase Auth

**Auth Methods:**
- Email + password (primary)
- Google OAuth (secondary)
- Magic link (for CRM invitations)

**Session Management:**
- Supabase handles session tokens with automatic refresh
- No manual JWT management (unlike v1's 15-min tokens without refresh)

**RBAC Implementation:**
```
auth.users (Supabase managed)
    |
    └── app_metadata: { role: 'owner' | 'manager' | 'roaster' | 'support' | 'customer' }
        |
        └── Checked in:
            ├── RLS policies (server-side, authoritative)
            ├── Route guards (client-side, UX only)
            └── API middleware (Edge Functions)
```

**User Profile:**
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL DEFAULT '{default_tenant}',
    display_name TEXT,
    avatar_url TEXT,
    preferred_locale CHAR(2) DEFAULT 'en',
    preferred_currency CHAR(3) DEFAULT 'CZK',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'shipping',  -- 'shipping', 'billing'
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT NOT NULL,
    country_code CHAR(2) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users see only their own profile and addresses
```

**Directory:**
```
src/modules/auth/
├── components/
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── ForgotPasswordForm.tsx
│   └── UserMenu.tsx
├── lib/
│   ├── auth.ts                  # Supabase auth helpers
│   ├── rbac.ts                  # Role checking utilities
│   └── session.ts               # Session management
├── hooks/
│   ├── useAuth.ts
│   └── useRBAC.ts
└── types.ts
```

---

## 6. Phasing

### Phase 1 — MVP

**Goal:** Functional e-commerce site with content, shopping, and basic operations.
**Timeline:** Target first functional version.

| Module | Scope |
|--------|-------|
| Coffee Atlas | All articles (EN + CZ + UK) — AI-generated, no cap. Physics, origins, brewing, varieties, processing. SEO setup, related product CTAs |
| Shop | Product catalog, cart, checkout with Stripe (CZK + EUR), Packeta shipping (CZ) |
| Bundle Builder | 3-step wizard, smart filters, progress bar, 3 discount tiers, free shipping threshold |
| CRM (basic) | Order management (pipeline view), product CRUD, customer list, basic dashboard (4-5 KPI widgets) |
| Inventory (simple) | Material stock tracking via ledger. Auto-availability from recipes. Low-stock alerts. |
| Auth | Email/password, Google OAuth, owner + customer roles |
| Integration Hub (basic) | Stripe adapter, Packeta adapter, ECB exchange rate adapter |
| Design System | Tailwind config, shadcn/ui base components, Storybook with all commerce components |

**Not in Phase 1:** Subscription, batch tracking, FedEx, multi-tenant, AI dashboard, Nordic currencies, command palette, advanced gamification.

### Phase 2 — Subscription & Multi-Tenant Foundation

**Goal:** Recurring revenue via subscriptions. Architecture proven for multi-tenant.

| Module | Scope |
|--------|-------|
| Subscription | Repeat bundle (user-selected), Surprise Wave (curated), flexible frequency, pause/skip |
| Unboxing extras | Mini-journal, stickers, chocolates — addon items in bundles |
| Multi-tenant | `tenant_id` activated in RLS, tenant config (units, product types, workflows), second tenant (flowers) as proof |
| CRM (advanced) | Command palette (Cmd+K), widget drag-and-drop, saved views, density toggle, dark mode |
| Inventory (batch) | Roast batch tracking: raw -> roasted conversion, batch-level traceability |
| Shipping (expanded) | Balikobot (PPL, DPD, Balikovna), home delivery options, carrier selection at checkout |
| Currencies (expanded) | Add PLN, NOK, SEK, DKK. Manual price overrides per market. |
| Gamification (advanced) | Flavor diversity badges, freshness indicators, social proof, A/B test framework |

### Phase 3 — Guest Wave & Platform Scale

**Goal:** External curators and platform growth features.

| Module | Scope |
|--------|-------|
| Guest Wave | External curators create themed bundles. Curator profiles, commission tracking. |
| FedEx integration | Premium/express international shipping tier |
| AI companion | NLP queries in CRM ("show unpaid orders over 500"), predictive next actions |
| AI dashboard curation | Learns which widgets matter per user, auto-surfaces anomalies |
| Advanced analytics | Cohort analysis, subscription churn prediction, revenue forecasting |
| Tax automation | OSS filing integration (Taxdoo/SimplyVAT), per-country VAT at checkout |
| Referral program | Customer referral codes, rewards tracking |

---

## 7. Non-Functional Requirements

### Performance

| Metric | Target | How |
|--------|--------|-----|
| Atlas page load (LCP) | < 1.5s | Static SSG via Astro, Cloudflare CDN edge caching |
| Product page load (LCP) | < 2.0s | SSR with edge caching, optimized images (WebP, responsive srcset) |
| Bundle Builder interaction | < 100ms response | Client-side state (Zustand), optimistic updates |
| CRM Dashboard initial load | < 3.0s | Code splitting, lazy-loaded widgets, skeleton screens |
| API response (Supabase) | < 200ms p95 | Proper indexes, materialized views for dashboards, connection pooling |
| Time to Interactive (TTI) | < 3.0s mobile | Astro island architecture — only interactive components ship JS |

### Accessibility

- WCAG 2.1 AA compliance minimum
- All interactive components via Radix UI (accessible by default: ARIA, keyboard, focus management)
- Color contrast ratios enforced via design tokens (never rely on color alone — always pair with icon/text)
- Storybook `@storybook/addon-a11y` runs automated audits on every component
- Tab navigation works throughout CRM (keyboard-first for power users)

### Internationalization (i18n)

| Aspect | Approach |
|--------|----------|
| Languages | EN (default), UK (Ukrainian), CZ (Czech) |
| URL structure | `/{locale}/...` — `/en/atlas/ethiopia`, `/uk/atlas/ethiopia`, `/cs/atlas/ethiopia` |
| Currency | Auto-detect from geo (Cloudflare `CF-IPCountry`), manual override, persisted in cookie |
| Content translation | Atlas articles: per-locale rows in `atlas_translations`. UI strings: compile-time i18n (Paraglide.js or equivalent). |
| Date/time | `Intl.DateTimeFormat` with user's locale |
| Number formatting | `Intl.NumberFormat` with cached formatters per currency |
| SEO | `hreflang` tags on all localized pages, locale-specific sitemaps |
| RTL | Not required (none of the target languages are RTL) |

### Responsive Strategy

| Surface | Approach |
|---------|----------|
| Shop (Atlas, catalog, checkout) | Mobile-first. 1-col mobile, 2-col tablet, 3-4 col desktop. Sticky cart CTA. |
| Bundle Builder | Mobile-first. Bottom sheet progress bar on mobile, sidebar on desktop. |
| CRM Dashboard | Desktop-only. Mobile shows "Please switch to desktop" message. iPad (web) is acceptable. |

### Observability

- **Error tracking:** Sentry (Astro + React integration)
- **Analytics:** Cloudflare Web Analytics (privacy-first, no cookies) + Plausible or PostHog for product analytics
- **Supabase monitoring:** Built-in dashboard for database performance, auth events, realtime connections
- **Uptime:** Cloudflare health checks on critical endpoints
- **Logging:** Structured JSON logs from Edge Functions, Cloudflare Logpush or Supabase logs

---

## 8. Design System

### Foundation

| Layer | Tool | Description |
|-------|------|-------------|
| Design Tokens | Tailwind CSS v4 config + CSS custom properties | Colors, spacing, typography, radii, shadows. Three-tier: global, semantic, component. |
| Base Components | shadcn/ui (copy-paste, owned) | Button, Input, Card, Table, Dialog, Badge, Tabs, Toast, etc. Radix UI primitives underneath. |
| Domain Components | Custom (commerce + CRM) | ProductCard, RoastBadge, PriceDisplay, CustomerCard, MetricCard, DataTable, OrderPipeline |
| Patterns | Documented in Storybook MDX | Empty states, loading, form validation, filtering, search |
| Documentation | Storybook 8 | Living documentation. Every component has a story. Deep links for review. |

### Color Palette

Coffee-inspired warm palette with functional colors for CRM states:

```
Brand (Espresso):     #fdf8f6 → #a0674a (primary) → #231a12
Status (CRM):         Blue (lead) → Amber (qualified) → Green (customer) → Red (churned)
Semantic:             Success (green), Warning (amber), Error (red), Info (blue)
Dark Mode:            CSS variable swap — same semantic names, adjusted values
```

See [design-systems.md] Section 5 for full token definitions and CSS variable implementation.

### Typography

```
Display:  DM Serif Display (serif) — hero sections, marketing headlines
Body/UI:  Inter (sans-serif) — everything else, optimized for small sizes
Data:     JetBrains Mono (monospace) — prices, order IDs, metrics
```

Modular scale: Major Third (1.25 ratio), 12px to 60px range.

### Storybook Configuration

Mandatory addons:
- `@storybook/addon-a11y` — automated accessibility audits
- `@storybook/addon-themes` — light/dark mode toggle
- `@storybook/addon-viewport` — responsive breakpoint testing
- `@storybook/addon-interactions` — visual interaction tests
- `@storybook/addon-designs` — embed Figma frames (when available)

Story organization:
```
Foundation/         → Colors, Typography, Spacing, Icons
UI/                 → shadcn/ui base components
Commerce/           → ProductCard, CartDrawer, BundleBuilder components
CRM/                → DataTable, MetricCard, OrderPipeline, Sidebar
Layout/             → StorefrontLayout, DashboardLayout
Patterns/           → EmptyState, LoadingState, FormValidation
```

### Component API Principles

1. Composable over monolithic: `<Card><CardHeader /><CardContent /></Card>`
2. Variants via CVA: `variant="compact"` not `isCompact={true}`
3. Forward refs on all interactive components
4. Accessible defaults (ARIA, keyboard, focus visible)
5. Every component has types, a story, and a test before use in a page

---

## 9. Infrastructure

### Hosting & Deployment

```
[Cloudflare Pages]
├── Static assets (Atlas, images) → Edge-cached globally
├── SSR routes (product pages, checkout) → Cloudflare Workers
├── _redirects / _headers → Locale redirects, security headers
└── Preview deployments → Per-PR preview URLs

[Supabase Cloud]
├── PostgreSQL database → Managed, daily backups, point-in-time recovery
├── Auth service → Email/password, OAuth, session management
├── Realtime → WebSocket subscriptions for CRM live updates
├── Storage → Product images, Atlas covers, user uploads
├── Edge Functions → Price calculation, webhook handlers, cron jobs
└── Supabase Vault → API keys, secrets (Stripe, Packeta, etc.)

[Cloudflare Tunnel]
└── Dev environment → Secure tunnel for local Supabase Studio access
```

### Environment Management

| Environment | Purpose | Database |
|-------------|---------|----------|
| Local dev | Agent development, Storybook | Supabase local (Docker) or shared dev project |
| Preview | Per-PR deployments, QA | Supabase branching (preview databases) |
| Staging | Pre-production validation | Dedicated Supabase project |
| Production | Live site | Dedicated Supabase project with backups |

### CI/CD Pipeline

```
Push to branch
    → Lint (ESLint + Prettier)
    → Type check (tsc --noEmit)
    → Unit tests (Vitest)
    → Build (Astro build)
    → Storybook build (chromatic or static deploy)
    → Deploy to Cloudflare Pages preview
    → E2E tests (Playwright against preview)

Merge to main
    → All above + deploy to production
    → Database migrations (Supabase CLI)
    → Notify Telegram (Jarvis)
```

### Security Headers (Cloudflare)

```
Content-Security-Policy: default-src 'self'; script-src 'self' js.stripe.com; frame-src js.stripe.com widget.packeta.com
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Git Strategy

- `main` — production, protected, deploy-on-merge
- `dev` — integration branch for Night Shift work
- `feature/*` — per-feature branches from `dev`
- `research/*` — research/spike branches
- Merge strategy: squash merge to `dev`, regular merge `dev` → `main`

---

## 10. Research Dependencies

This specification is built on Night Shift research outputs. Each research document is the authoritative reference for its domain:

| Research Document | Referenced By | Key Decisions |
|-------------------|---------------|---------------|
| [bundle-builder-ux.md](bundle-builder-ux.md) | Section 5.2 | 3-step wizard, gamification tiers, pricing psychology, React component architecture |
| [crm-ui-patterns.md](crm-ui-patterns.md) | Section 5.4 | Three-column layout, command palette, data tables, dark mode, density modes |
| [design-systems.md](design-systems.md) | Section 8 | Token architecture, shadcn/ui strategy, Storybook setup, component inventory, color palette |
| [multi-currency.md](multi-currency.md) | Sections 4.3, 5.3, 7 | Hybrid pricing model, ECB/Frankfurter API, schema design, VAT/OSS, Intl.NumberFormat |
| [payment-providers.md](payment-providers.md) | Section 5.6 | Stripe as primary (all currencies, best DX, Supabase integration). Comgate as potential secondary. |
| [shipping-providers.md](shipping-providers.md) | Section 5.6 | Packeta (CZ + EU pickup) + Balikobot (CZ domestic) + FedEx (premium). 3 integrations cover all. |

### Research Gaps (To Be Addressed)

| Topic | Status | Notes |
|-------|--------|-------|
| Wiki/documentation structure for platform | Pending | Discovered in Q16b. How to organize living platform docs. |
| NotebookLM pipeline | Pending | Q17. Research to presentation to deep link for learning. |
| Design system deep-dive | Partially done | Q18. Fundamentals covered. Figma workflow, contribution process TBD. |
| Subscription model details | Deferred to Phase 2 | Surprise Wave mechanics, billing cycles, pause/skip UX. |
| Guest Wave architecture | Deferred to Phase 3 | Curator model, commission tracking, content workflow. |

---

## Appendix A: Project Directory Structure

```
yourwave-platform/
├── astro.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .env.example                    # Template — never commit .env
├── supabase/
│   ├── config.toml
│   ├── migrations/                 # Sequential SQL migrations
│   │   ├── 001_currencies.sql
│   │   ├── 002_products.sql
│   │   ├── 003_inventory.sql
│   │   ├── 004_orders.sql
│   │   ├── 005_atlas.sql
│   │   └── 006_rls_policies.sql
│   ├── seed.sql                    # Dev seed data
│   └── functions/                  # Supabase Edge Functions
│       ├── update-exchange-rates/
│       ├── calculate-shipping/
│       └── stripe-webhook/
├── src/
│   ├── components/
│   │   └── ui/                     # shadcn/ui atoms
│   ├── modules/
│   │   ├── atlas/
│   │   ├── bundle-builder/
│   │   ├── shop/
│   │   ├── crm/
│   │   ├── inventory/
│   │   ├── integrations/
│   │   └── auth/
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── StorefrontLayout.astro
│   │   └── DashboardLayout.astro
│   ├── pages/
│   │   ├── [locale]/
│   │   │   ├── index.astro
│   │   │   ├── atlas/[slug].astro
│   │   │   ├── products/[slug].astro
│   │   │   ├── bundle.astro
│   │   │   ├── cart.astro
│   │   │   └── checkout/
│   │   └── admin/                  # CRM routes (auth-protected)
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client
│   │   ├── currency.ts             # Formatting, detection
│   │   ├── i18n.ts                 # i18n utilities
│   │   └── utils.ts                # cn(), shared helpers
│   ├── styles/
│   │   └── globals.css             # Tailwind base + CSS variables
│   └── types/
│       └── index.ts                # Shared type exports
├── .storybook/
│   ├── main.ts
│   ├── preview.ts
│   └── manager.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── public/
    ├── images/
    └── fonts/
```

---

## Appendix B: ADR Log

### ADR-001: Astro + React Islands over Next.js

**Status:** Accepted (2026-03-23)
**Context:** v1 used Next.js 15 (App Router). The site is primarily content (Atlas) + commerce, with CRM as a separate admin surface. Next.js ships JS for every page by default.
**Decision:** Use Astro 5 with React islands. Atlas pages ship zero JS. Interactive features (Bundle Builder, Cart, CRM) hydrate as islands.
**Consequences:** Better performance for content pages. CRM is a fully client-side React app within Astro. Requires understanding of island architecture boundaries. Lose some Next.js ecosystem tooling.

### ADR-002: Supabase over Custom .NET Backend

**Status:** Accepted (2026-03-23)
**Context:** v1 had a full .NET 8 backend with Clean Architecture (Domain, Infrastructure, Application, API layers). Maintained by a human developer. v2 is built by AI agents — agents work better with declarative configurations (RLS policies, SQL schemas) than imperative backend code.
**Decision:** Replace .NET backend with Supabase (PostgreSQL + Auth + RLS + Realtime + Edge Functions).
**Consequences:** No custom server to maintain/deploy. Auth, real-time, and storage are managed services. Business logic lives in RLS policies + Edge Functions + client-side. Less flexibility for complex server-side workflows — mitigated by Edge Functions for specific needs.

### ADR-003: Stripe as Primary Payment Provider

**Status:** Accepted (2026-03-23)
**Context:** Researched 5 providers (Stripe, Comgate, GoPay, Adyen, Mollie). Requirements: Apple Pay, Google Pay, multi-currency (6 currencies), CZ S.R.O. support, Supabase integration.
**Decision:** Stripe as primary and sole payment provider at launch.
**Consequences:** Best DX, full currency coverage, native Supabase sync. 1.5% + 6.50 CZK per EEA transaction. No CZ bank transfer support (Comgate is better for this — potential Phase 2 addition). Vendor dependency on Stripe.

### ADR-004: Hybrid Multi-Currency Pricing

**Status:** Accepted (2026-03-23)
**Context:** Options: base-only with real-time conversion, explicit per-currency prices, or hybrid.
**Decision:** Hybrid — base price in CZK, auto-generated per-currency prices via daily ECB rates, manual overrides allowed.
**Consequences:** Fast reads (pre-computed prices), full control per market, audit trail via exchange_rates table. More complex price management UX. Daily cron dependency.

### ADR-005: Shipping via Packeta + Balikobot + FedEx

**Status:** Accepted (2026-03-23)
**Context:** Researched 5 carriers + 3 aggregators. Need CZ pickup, CZ home delivery, EU pickup, and premium international.
**Decision:** 3 API integrations: Packeta (CZ + EU pickup), Balikobot (CZ domestic carriers — PPL, DPD, Balikovna, GLS), FedEx (premium, Phase 3).
**Consequences:** Full coverage with minimal integration count. Balikobot is the linchpin for CZ domestic. Packeta doubles as EU aggregator. FedEx deferred — not needed for coffee weights at launch.

### ADR-006: RLS on All Tables from Day One

**Status:** Accepted (2026-03-23)
**Context:** Security-first mandate from discovery. Personal data protection is critical. Bots may access DB but must not expose sensitive data.
**Decision:** Every table has RLS enabled. No exceptions. Public data via anon policies. User data via auth.uid(). Admin data via role claims.
**Consequences:** Stronger security posture. Slightly more complex query debugging. Must test RLS policies explicitly. Performance: RLS adds overhead — mitigate with proper indexes and policy design.

---

*This specification is a living document. Update as implementation decisions are made and the architecture evolves. All changes should be logged with date and rationale.*
