---
cortex_level: L10
confidence: high
domain: yourwave
scope: yourwave — design-systems
type: bootstrap-extract
tags:
  - yourwave
  - bootstrap
  - core
created: '2026-03-31'
project: yourwave
source_hash: 3e2e67ad3193146edb2d07425b4e0ab47b8c4e7483db07989fd7301064c27faa
embedding_model: text-embedding-3-small
---
# Design Systems — Comprehensive Research for YourWave v2

> **Context**: YourWave is a coffee e-commerce + CRM platform. This document covers design system fundamentals, real-world examples, and specific recommendations for building YourWave's DS on Tailwind + shadcn/ui with Storybook integration.
>
> **Research Date**: 2026-03-23

---

## 1. What Is a Design System?

A design system is a **single source of truth** — a collection of reusable components, guided by clear standards, that can be assembled to build any number of applications. It is not just a component library or a style guide; it encompasses everything from abstract design decisions (colors, spacing, type scales) down to production-ready coded components and usage documentation.

### The Three Layers

| Layer | What It Contains | Example |
|-------|-----------------|---------|
| **Design Tokens** | Primitive values — colors, spacing, font sizes, radii, shadows | `--color-brand-500: #6F4E37` |
| **Components** | Reusable UI building blocks built from tokens | `<Button variant="primary">` |
| **Patterns** | Compositions of components solving specific UX problems | Product card with image, price, add-to-cart |

### Design System vs. Component Library vs. Style Guide

- **Style Guide**: A static document describing visual rules (colors, logos, typography). No code.
- **Component Library**: A coded collection of UI components. Code, but often no guiding principles.
- **Design System**: The union of both, plus governance — principles, contribution guidelines, versioning, documentation, and tooling. It is a living product, not a deliverable.

A design system answers not just *what* to build but *how* and *why*.

---

## 2. Why It Matters

### Consistency at Scale
Without a DS, every developer and designer makes independent micro-decisions: button padding, card shadow depth, heading sizes. Over time these diverge. A DS eliminates this drift by codifying decisions once.

### Development Speed
Teams using mature design systems report **30-50% faster UI development** (as cited by Shopify's Polaris team and Salesforce Lightning). Developers stop rebuilding common patterns and focus on business logic.

### Scalability
As YourWave grows from a single storefront to a multi-tenant CRM with admin dashboards, partner portals, and mobile apps, a DS ensures all surfaces share the same visual language without duplicating work.

### Team Alignment
A DS creates a shared vocabulary. When a designer says "primary action button" and a developer types `<Button variant="primary">`, they produce identical results. Onboarding new team members becomes dramatically faster.

### Quality & Accessibility
Accessibility rules (contrast ratios, focus states, ARIA attributes) are encoded once in the DS and inherited by every product surface automatically.

---

## 3. Anatomy: Tokens → Components → Patterns → Templates

### 3.1 Design Tokens

Design tokens are the atomic values of a design system. They are platform-agnostic (can compile to CSS custom properties, Tailwind config, iOS/Android constants, etc.).

**Tiers of tokens:**

```
Global Tokens (primitives)
├── color.brown.600: #6F4E37
├── space.4: 16px
├── font.size.lg: 1.125rem
└── radius.md: 8px

Alias Tokens (semantic)
├── color.bg.primary → color.neutral.50
├── color.bg.primary.dark → color.neutral.900
├── color.action.primary → color.brown.600
├── space.card.padding → space.4
└── font.heading.size → font.size.2xl

Component Tokens (scoped)
├── button.primary.bg → color.action.primary
├── button.primary.text → color.neutral.white
├── button.border-radius → radius.md
└── card.shadow → shadow.md
```

This three-tier model (pioneered by Salesforce and adopted by most mature systems) means you can rebrand an entire product by changing global tokens without touching component code.

### 3.2 Components

Components are the coded building blocks. They consume tokens and expose a controlled API (props/variants).

**Atomic Design classification (Brad Frost):**

| Level | Description | Examples |
|-------|------------|---------|
| **Atoms** | Smallest indivisible elements | Button, Input, Badge, Icon, Avatar |
| **Molecules** | Simple groups of atoms | Search bar (input + button), Form field (label + input + error) |
| **Organisms** | Complex compositions | Navigation bar, Product card, Cart drawer |
| **Templates** | Page-level layouts without real content | Dashboard layout, PDP layout |
| **Pages** | Templates filled with real data | The actual checkout page |

### 3.3 Patterns

Patterns are documented solutions to recurring UX problems. Unlike components (which are *what*), patterns describe *when* and *how*.

Examples:
- **Empty State Pattern**: What to show when a data table has no rows
- **Loading Pattern**: Skeleton vs. spinner vs. progress bar — when to use which
- **Form Validation Pattern**: Inline vs. summary errors, when to validate
- **Filtering & Sorting Pattern**: Faceted search for product catalogs

### 3.4 Templates

Templates are page-level compositions that establish layout hierarchy, content zones, and responsive behavior. They are content-agnostic shells.

```
┌─────────────────────────────────────────┐
│  Header / Navigation                    │
├──────────────────┬──────────────────────┤
│  Sidebar / Filters│  Main Content Area  │
│                  │  ┌────┐ ┌────┐      │
│                  │  │Card│ │Card│      │
│                  │  └────┘ └────┘      │
│                  │  ┌────┐ ┌────┐      │
│                  │  │Card│ │Card│      │
│                  │  └────┘ └────┘      │
├──────────────────┴──────────────────────┤
│  Footer                                 │
└─────────────────────────────────────────┘
```

---

## 4. Real-World Design Systems

### Shopify Polaris
- **Focus**: Commerce admin interfaces
- **Stack**: React, TypeScript, custom CSS-in-JS
- **Key Strength**: Extremely well-documented patterns for data tables, resource lists, and action-heavy UIs — directly relevant to CRM features
- **Token System**: Uses a sophisticated token architecture with light/dark modes built in
- **Lesson for YourWave**: Polaris patterns for data tables, filters, and resource management are directly applicable to CRM admin panels
- **URL**: polaris.shopify.com

### Atlassian Design System
- **Focus**: Productivity tools (Jira, Confluence)
- **Stack**: React, compiled CSS with tokens
- **Key Strength**: Deep pattern library — covers complex interactions like drag-and-drop boards, inline editing, multi-select
- **Token System**: Uses `@atlaskit/tokens` with 700+ tokens across 3 tiers
- **Lesson for YourWave**: Their approach to dense information displays and CRM-like task management is highly relevant

### Material Design (Google)
- **Focus**: Cross-platform consistency
- **Stack**: Web Components, Flutter, Jetpack Compose
- **Key Strength**: Massive scale, strong accessibility foundations, elevation/shadow system
- **Token System**: Material 3 introduced "dynamic color" — generative color palettes from a seed color
- **Lesson for YourWave**: Material's dynamic theming approach (generate a palette from brand color) is excellent for coffee brand customization

### Carbon Design System (IBM)
- **Focus**: Enterprise applications
- **Stack**: React, Vue, Angular, Web Components, Svelte
- **Key Strength**: Multi-framework support, rigorous accessibility (IBM builds for government contracts)
- **Token System**: Layer-based tokens — UI layers stack and tokens adjust automatically
- **Lesson for YourWave**: Carbon's data visualization components and dense dashboard patterns apply to CRM analytics

### Radix UI / Radix Themes
- **Focus**: Unstyled, accessible primitives
- **Stack**: React, works with any styling solution
- **Key Strength**: Headless — provides behavior, accessibility, and keyboard interactions without visual opinions
- **Lesson for YourWave**: shadcn/ui is built on Radix primitives. Understanding Radix means understanding the foundation beneath our component library

---

## 5. YourWave-Specific Design System Plan

### 5.1 Tokens for Coffee E-Commerce + CRM

**Color Palette — Brand**
```css
/* Coffee-inspired brand palette */
--color-espresso-50: #fdf8f6;
--color-espresso-100: #f9ece5;
--color-espresso-200: #f0d5c4;
--color-espresso-300: #e3b89a;
--color-espresso-400: #c98a5e;
--color-espresso-500: #a0674a;    /* Primary brand */
--color-espresso-600: #6f4e37;    /* Deep espresso */
--color-espresso-700: #5a3e2b;
--color-espresso-800: #3d2b1e;
--color-espresso-900: #231a12;

/* Semantic mapping */
--color-action-primary: var(--color-espresso-500);
--color-action-primary-hover: var(--color-espresso-600);
--color-surface-warm: var(--color-espresso-50);

/* CRM-specific semantics */
--color-status-lead: #3b82f6;      /* blue — new lead */
--color-status-qualified: #f59e0b; /* amber — qualified */
--color-status-customer: #10b981;  /* green — converted */
--color-status-churned: #ef4444;   /* red — lost */
```

**Spacing Scale (4px base)**
```css
--space-0: 0;
--space-0.5: 2px;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

**Border Radius**
```css
--radius-none: 0;
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;

/* Semantic */
--radius-button: var(--radius-md);
--radius-card: var(--radius-lg);
--radius-input: var(--radius-md);
--radius-badge: var(--radius-full);
```

### 5.2 Component Inventory for YourWave

**E-Commerce Components**

| Component | Description | Variants |
|-----------|-------------|----------|
| ProductCard | Displays a coffee product with image, name, roast level, price | `default`, `compact`, `featured` |
| RoastBadge | Shows roast level (light/medium/dark) | `light`, `medium`, `dark`, `espresso` |
| PriceDisplay | Formats price with currency, optional strikethrough for sales | `default`, `sale`, `subscription` |
| QuantitySelector | Increment/decrement with input | `default`, `compact` |
| CartDrawer | Slide-out cart summary | — |
| GrindSelector | Choose grind type (whole bean, drip, espresso, etc.) | — |
| SubscriptionToggle | One-time vs. recurring purchase switch | — |
| FlavorProfileChart | Visual radar chart for tasting notes | — |

**CRM Components**

| Component | Description | Variants |
|-----------|-------------|----------|
| CustomerCard | Summary card for a customer record | `compact`, `expanded` |
| LeadStatusBadge | Pipeline stage indicator | `lead`, `qualified`, `customer`, `churned` |
| ActivityTimeline | Chronological list of interactions | — |
| MetricCard | KPI display (revenue, orders, retention) | `default`, `trend`, `comparison` |
| DataTable | Sortable, filterable table for orders/customers | — |
| FilterBar | Multi-faceted filter interface | — |
| NotesPanel | Rich-text notes attached to a customer | — |
| OrderHistoryList | Paginated list of past orders | — |

**Shared/Foundation Components**

| Component | Description |
|-----------|-------------|
| Button | Primary, secondary, outline, ghost, destructive |
| Input | Text, email, password, search, number |
| Select | Single select, multi-select, combobox |
| Dialog / Modal | Confirmation, form, alert |
| Toast / Notification | Success, error, warning, info |
| Avatar | User avatar with fallback initials |
| Badge | Status, count, label |
| Tabs | Content tabs, navigation tabs |
| Breadcrumb | Page hierarchy navigation |
| EmptyState | Illustration + message + action for zero-data |

### 5.3 Patterns for YourWave

1. **Product Discovery Pattern**: Filter by roast, origin, flavor notes → grid of ProductCards → quick-add to cart
2. **Subscription Management Pattern**: View/pause/cancel/modify subscription — clear states and confirmation flows
3. **Customer 360 Pattern**: Single page showing customer profile, order history, subscription status, activity timeline, notes
4. **Order Fulfillment Pattern**: Status pipeline view, bulk actions, status transitions with confirmation
5. **Dashboard Pattern**: KPI row at top, charts in middle, recent activity at bottom
6. **Search Pattern**: Unified search across products and customers with categorized results

---

## 6. Storybook Integration

Storybook is the standard tool for developing, documenting, and testing UI components in isolation. It serves as the living documentation of the design system.

### How the DS Lives in Storybook

```
src/
├── components/
│   ├── ui/                    # shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── button.stories.tsx  # ← Storybook story
│   │   └── button.test.tsx
│   ├── commerce/              # E-commerce specific
│   │   ├── ProductCard.tsx
│   │   ├── ProductCard.stories.tsx
│   │   └── ProductCard.test.tsx
│   └── crm/                   # CRM specific
│       ├── CustomerCard.tsx
│       ├── CustomerCard.stories.tsx
│       └── CustomerCard.test.tsx
├── tokens/
│   ├── colors.ts
│   ├── spacing.ts
│   └── typography.ts
└── .storybook/
    ├── main.ts
    ├── preview.ts              # Global decorators, theme toggle
    └── manager.ts
```

### Story Structure Best Practices

```tsx
// ProductCard.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { ProductCard } from "./ProductCard";

const meta: Meta<typeof ProductCard> = {
  title: "Commerce/ProductCard",
  component: ProductCard,
  tags: ["autodocs"],           // Auto-generate docs
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "compact", "featured"],
    },
    roastLevel: {
      control: "select",
      options: ["light", "medium", "dark", "espresso"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProductCard>;

export const Default: Story = {
  args: {
    name: "Ethiopian Yirgacheffe",
    price: 18.99,
    roastLevel: "light",
    imageUrl: "/images/ethiopian.jpg",
    flavorNotes: ["citrus", "floral", "bright"],
  },
};

export const OnSale: Story = {
  args: {
    ...Default.args,
    originalPrice: 22.99,
    price: 18.99,
    variant: "featured",
  },
};

export const Compact: Story = {
  args: {
    ...Default.args,
    variant: "compact",
  },
};
```

### Key Storybook Addons for a DS

| Addon | Purpose |
|-------|---------|
| `@storybook/addon-a11y` | Automated accessibility audits per component |
| `@storybook/addon-themes` | Toggle between light/dark modes |
| `@storybook/addon-viewport` | Test responsive breakpoints |
| `@storybook/addon-interactions` | Write and visualize interaction tests |
| `@storybook/addon-designs` | Embed Figma frames alongside components |
| `storybook-addon-performance` | Component render performance metrics |

### Documentation Pages

Storybook supports MDX pages for prose documentation alongside component stories:

```mdx
{/* docs/tokens/Colors.mdx */}
import { Meta, ColorPalette, ColorItem } from "@storybook/blocks";

<Meta title="Tokens/Colors" />

# Color System

Our color palette is rooted in coffee tones — warm browns, creams,
and earth tones — accented with functional colors for CRM status states.

<ColorPalette>
  <ColorItem title="Espresso 500" subtitle="Primary brand" colors={["#a0674a"]} />
  <ColorItem title="Espresso 600" subtitle="Deep espresso" colors={["#6f4e37"]} />
</ColorPalette>
```

---

## 7. Tailwind + shadcn/ui as Foundation

### Why This Stack

**Tailwind CSS** provides utility-first styling with an excellent token system (`tailwind.config.ts`). It handles responsive design, dark mode, and custom themes natively.

**shadcn/ui** is not a dependency — it is a collection of copy-paste components built on Radix UI primitives. You own the code. This means:
- Full customization without fighting a library's API
- No version lock-in
- Components are accessible by default (Radix handles ARIA, keyboard, focus)
- Styled with Tailwind, so they integrate naturally

### Building on Top

```
Layer 1: Tailwind Config (tokens)
    ↓
Layer 2: shadcn/ui Base Components (atoms)
    ↓
Layer 3: YourWave Components (molecules/organisms)
    ↓
Layer 4: Page Templates & Patterns
```

**tailwind.config.ts — Extending with YourWave Tokens**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        espresso: {
          50: "#fdf8f6",
          100: "#f9ece5",
          200: "#f0d5c4",
          300: "#e3b89a",
          400: "#c98a5e",
          500: "#a0674a",
          600: "#6f4e37",
          700: "#5a3e2b",
          800: "#3d2b1e",
          900: "#231a12",
        },
        // Semantic aliases using CSS variables (shadcn pattern)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // CRM status colors
        status: {
          lead: "#3b82f6",
          qualified: "#f59e0b",
          customer: "#10b981",
          churned: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["DM Serif Display", "Georgia", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

### shadcn/ui Component Customization Flow

1. Install base component: `npx shadcn@latest add button`
2. Component appears in `src/components/ui/button.tsx`
3. Customize variants for YourWave needs:

```tsx
// src/components/ui/button.tsx — Extended for YourWave
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
  {
    variants: {
      variant: {
        default: "bg-espresso-500 text-white hover:bg-espresso-600",
        secondary: "bg-espresso-100 text-espresso-800 hover:bg-espresso-200",
        outline: "border border-espresso-300 text-espresso-700 hover:bg-espresso-50",
        ghost: "hover:bg-espresso-50 text-espresso-600",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        // YourWave-specific
        "add-to-cart": "bg-espresso-500 text-white hover:bg-espresso-600 gap-2",
        "crm-action": "bg-blue-600 text-white hover:bg-blue-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

---

## 8. Color Systems

### Semantic Token Architecture

The key insight of mature color systems: **never reference raw colors directly in components**. Always go through a semantic layer.

```
Raw:       espresso-500     (#a0674a)
              ↓
Semantic:  --primary        (maps to espresso-500 in light, espresso-300 in dark)
              ↓
Component: button-bg        (maps to --primary)
```

### Dark Mode Strategy

shadcn/ui uses CSS custom properties with HSL values, making dark mode a matter of swapping variable values:

```css
/* globals.css */
@layer base {
  :root {
    /* Light theme */
    --background: 30 25% 98%;        /* warm off-white */
    --foreground: 24 20% 12%;        /* deep brown */
    --primary: 20 38% 46%;           /* espresso-500 */
    --primary-foreground: 0 0% 100%; /* white */
    --card: 30 20% 96%;              /* slightly warm */
    --card-foreground: 24 20% 12%;
    --muted: 24 10% 92%;
    --muted-foreground: 24 10% 40%;
    --accent: 24 50% 85%;
    --border: 24 15% 88%;
    --ring: 20 38% 46%;
  }

  .dark {
    /* Dark theme */
    --background: 24 15% 8%;          /* very dark brown */
    --foreground: 30 15% 90%;         /* warm light */
    --primary: 24 45% 65%;            /* lighter espresso */
    --primary-foreground: 24 15% 8%;
    --card: 24 12% 12%;
    --card-foreground: 30 15% 90%;
    --muted: 24 10% 18%;
    --muted-foreground: 24 10% 60%;
    --accent: 24 20% 20%;
    --border: 24 10% 20%;
    --ring: 24 45% 65%;
  }
}
```

### Brand Colors for Coffee

Coffee brands benefit from warm, earthy palettes. Key considerations:

- **Primary**: Rich brown (espresso tones) — conveys craft, warmth, authenticity
- **Secondary**: Cream/tan — natural complement, used for backgrounds and cards
- **Accent**: Burnt orange or deep gold — for highlights, CTAs, sale tags
- **Neutrals**: Warm grays (not pure gray — add a brown undertone)
- **Functional**: Standard blue/green/amber/red for info/success/warning/error — keep these desaturated slightly to match the warm palette

---

## 9. Typography Scale

### Recommended Type Stack

```css
/* Display headings — for hero sections, landing pages */
font-family: "DM Serif Display", Georgia, "Times New Roman", serif;

/* Body text and UI — for everything else */
font-family: "Inter", system-ui, -apple-system, sans-serif;

/* Code and data — for prices, order IDs, metrics */
font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
```

### Modular Scale (Major Third — 1.25 ratio)

| Token | Size (rem) | Size (px) | Usage |
|-------|-----------|-----------|-------|
| `text-xs` | 0.75 | 12 | Captions, helper text, fine print |
| `text-sm` | 0.875 | 14 | Secondary text, metadata, table cells |
| `text-base` | 1.0 | 16 | Body text, form labels, buttons |
| `text-lg` | 1.125 | 18 | Lead paragraphs, emphasized body |
| `text-xl` | 1.25 | 20 | Card headings, section titles |
| `text-2xl` | 1.5 | 24 | Page sub-headings (H3) |
| `text-3xl` | 1.875 | 30 | Section headings (H2) |
| `text-4xl` | 2.25 | 36 | Page titles (H1) |
| `text-5xl` | 3.0 | 48 | Hero headings |
| `text-6xl` | 3.75 | 60 | Display / marketing headlines |

### Line Heights

| Usage | Line Height |
|-------|-------------|
| Headings (display) | 1.1 - 1.2 |
| Headings (section) | 1.2 - 1.3 |
| Body text | 1.5 - 1.6 |
| UI elements (buttons, labels) | 1.25 |
| Dense data (tables) | 1.4 |

### Font Weight Usage

| Weight | Token | Usage |
|--------|-------|-------|
| 400 (Regular) | `font-normal` | Body text, descriptions |
| 500 (Medium) | `font-medium` | Labels, buttons, nav items |
| 600 (Semibold) | `font-semibold` | Card titles, section headings |
| 700 (Bold) | `font-bold` | Page titles, emphasis, prices |

---

## 10. Spacing & Layout

### 4px / 8px Grid System

All spacing in the DS is based on a 4px unit. The primary increment is 8px (2 units), with 4px used for fine adjustments (icon gaps, badge padding).

```
4px  — micro gaps (icon-to-text, badge padding)
8px  — tight spacing (within components)
12px — compact spacing (form field gaps)
16px — standard spacing (between related elements)
24px — section spacing (between groups of content)
32px — major spacing (between sections)
48px — page-level spacing (section padding)
64px — hero spacing (large section breaks)
```

### Responsive Breakpoints

```ts
// Tailwind defaults, well-suited for e-commerce + CRM
const screens = {
  sm: "640px",   // Large phone / small tablet
  md: "768px",   // Tablet
  lg: "1024px",  // Small desktop / laptop
  xl: "1280px",  // Desktop
  "2xl": "1536px", // Large desktop
};
```

### Layout Patterns

**E-Commerce Storefront**
```
Mobile:  1 column, full-width cards, sticky cart button
Tablet:  2-column product grid, collapsible filters sidebar
Desktop: 3-4 column product grid, persistent sidebar filters
Large:   4-column grid, maximum content width 1400px
```

**CRM Dashboard**
```
Mobile:  Single column, collapsible sidebar navigation
Tablet:  Persistent slim sidebar (icons only) + main content
Desktop: Full sidebar (240px) + main content with multi-column cards
Large:   Full sidebar + main content maxed at 1600px, centered
```

**Container Widths**
```css
--container

[truncated — source document exceeds embedding token limit]
