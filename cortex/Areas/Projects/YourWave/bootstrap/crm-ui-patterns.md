---
cortex_level: L10
confidence: high
domain: yourwave
scope: yourwave — crm-ui-patterns
type: bootstrap-extract
tags:
  - yourwave
  - bootstrap
  - core
created: '2026-03-31'
project: yourwave
source_hash: b11dde4dfbcf08bd02e75d2f48bd378239354d2f6aa248fdcac94d2c19889795
embedding_model: text-embedding-3-small
---
# CRM/Admin UI Patterns Research — YourWave v2

> Compiled: 2026-03-23
> Context: Desktop-first coffee e-commerce + CRM platform
> Pain points from v1: no flow, infinite lists, no clear purpose per section, poor info hierarchy

---

## 1. Desktop-First Layout: Sidebar + Main + Detail Panel

### The Linear Model
Linear's UI is the gold standard for dense desktop apps. Key principles:
- **Dimmed sidebar** — navigation recedes so the main content area takes visual precedence
- **Compact tabs** — rounded corners, smaller icon/text sizing, don't span full width
- **Side panel for metadata** — clicking an item opens a detail panel without leaving the list
- **Multiple display modes** — list, board, timeline, split, and fullscreen views
- **Filter headers** — dedicated row for filters and display options above content

### Three-Column Pattern
```
[Sidebar 220px] [Main Content flex] [Detail Panel 360px]
```
- Sidebar: workspace nav, recent items, favorites, collapsible sections
- Main: the working area — list/table/board/calendar
- Detail panel: slides in on item click, shows full metadata, editable inline
- Panel can be dismissed to return to full-width main content

### Best Examples
- **Linear** — issue tracker with sidebar + list + detail panel ([linear.app](https://linear.app))
- **Notion** — sidebar nav + page content + linked databases ([notion.so](https://notion.so))
- **Stripe Dashboard** — sidebar + transaction list + detail drawer ([dashboard.stripe.com](https://dashboard.stripe.com))
- **Shopify Admin** — sidebar + resource list + detail page ([shopify.com/admin](https://shopify.com/admin))

### YourWave Application
- Sidebar: Orders, Products, Customers, Analytics, Settings (collapsible groups)
- Main: order list / product grid / customer table
- Detail: click an order → slide-in panel with full order details, timeline, actions
- Never navigate away from the list — detail panel overlays or pushes

---

## 2. Data Tables: Filtering, Sorting, Bulk Actions, Inline Editing

### Shopify Polaris Patterns
Shopify differentiates between two table types:
- **Data Table** — for read-only data comparison (financials, analytics)
- **Index Table** — for actionable lists with bulk operations (orders, products)

Key patterns:
- Column sorting with clear directional indicators
- Persistent filter bar with saved filter sets
- Bulk action bar appears when items are selected
- Summary row for column totals
- Wrap text instead of truncating (avoids similar-looking truncated items)

### Best Practices for YourWave
1. **Sticky header** — column headers stay visible on scroll
2. **Inline status editing** — click a status badge to change it directly
3. **Quick filters** — status pills above the table (All | New | Processing | Shipped | Completed)
4. **Saved views** — let users save filter + sort combinations ("My urgent orders")
5. **Bulk actions** — select multiple → action bar: "Mark as shipped", "Print labels", "Export"
6. **Row hover actions** — subtle action icons appear on hover (view, edit, quick actions)
7. **Expandable rows** — click to expand inline details without opening detail panel
8. **Keyboard navigation** — arrow keys to move between rows, Enter to open

### References
- [Shopify Polaris Data Table](https://polaris-react.shopify.com/components/tables/data-table)
- [Shopify Polaris Index Table](https://polaris-react.shopify.com/components)
- [Carbon Design System — Data Table](https://carbondesignsystem.com)

---

## 3. Card-Based vs Table-Based Product Views

### When to Use Each

| Aspect | Card View | Table View |
|--------|-----------|------------|
| Best for | Visual browsing, product catalog | Inventory management, bulk editing |
| Image emphasis | High — product photos front and center | Low — small thumbnails or none |
| Data density | Lower, more whitespace | Higher, compact rows |
| Sorting/filtering | Basic | Full column sort + advanced filters |
| Bulk actions | Limited | Checkbox select + bulk bar |
| Responsiveness | Excellent (grid reflows) | Requires horizontal scroll or column hiding |

### Recommendation for YourWave
Offer **both views with a toggle** (grid/list icon buttons in the toolbar):
- **Card view** — default for Products section. Show product image, name, price, stock status badge, quick actions on hover
- **Table view** — for inventory management, bulk price updates, stock management
- **Quantity guidelines**: show 12-20 cards initially with lazy loading; or full paginated table

### References
- [Card View vs Table View — Medium](https://medium.com/design-bootcamp/when-to-use-which-component-a-case-study-of-card-view-vs-table-view-7f5a6cff557b)
- [Table vs List vs Cards — UX Patterns](https://uxpatterns.dev/pattern-guide/table-vs-list-vs-cards)

---

## 4. Status Indicators: Color Coding, Badges, Progress Bars

### Color System (Carbon Design System)
| Color | Meaning | Use Case |
|-------|---------|----------|
| Green | Success / Active | Order delivered, product in stock |
| Blue | Info / In Progress | Order processing, sync in progress |
| Yellow | Warning | Low stock, payment pending |
| Orange | Serious Warning | Very low stock, delivery delayed |
| Red | Error / Danger | Payment failed, out of stock |
| Gray | Draft / Inactive | Draft order, disabled product |
| Purple | Special / Outlier | VIP customer, promotional item |

### Badge Design Rules
1. **Never rely on color alone** — always pair with icon + text label
2. **Dot indicators** — small colored dots for inline status (e.g., in table rows)
3. **Pill badges** — rounded labels with background color for prominent status
4. **Progress bars** — for multi-step processes (order fulfillment pipeline)
5. **Severity levels**: High attention (red/orange, needs action) → Low attention (blue/green, informational)

### YourWave Order Pipeline
```
[New] → [Confirmed] → [Roasting] → [Packed] → [Shipped] → [Delivered]
 gray      blue         yellow       blue       purple       green
```
Show as horizontal progress indicator with completed steps filled.

### References
- [Carbon Design System — Status Indicators](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
- [Untitled UI — Progress Indicators](https://www.untitledui.com/components/progress-indicators)

---

## 5. Contextual Actions & AI-Guided Navigation

### The "What Would You Like to Do?" Pattern
Instead of passive menus, present contextual action suggestions based on:
- Current page context (on an order page → "Ship this order", "Contact customer", "Print invoice")
- User's recent behavior ("You usually check stock levels around this time")
- Data state ("3 orders are pending — review now?")

### AI Companion Panel (Sidebar Assistant)
- Persistent but collapsible AI chat panel on the right side
- Proactive suggestions: "Sales are 20% up this week — want to see the breakdown?"
- Natural language queries: "Show me all orders from Kyiv this month"
- Smart filters via NLP: type "unpaid orders over 500 UAH" → auto-applies filters
- Predictive next actions as clickable shortcuts

### Contextual Help Patterns
- **Tooltips** — hover over any metric/label for explanation
- **Inline hints** — subtle "?" icons that expand to explain a feature
- **Empty state guidance** — when a section is empty, show "Here's how to get started"
- **Onboarding checklists** — progressive disclosure of features for new admins

### References
- [Chameleon — Contextual Help UX](https://www.chameleon.io/blog/contextual-help-ux)
- [The Shape of AI — UX Patterns](https://www.shapeof.ai)
- [UX Collective — 20+ GenAI UX Patterns](https://uxdesign.cc/20-genai-ux-patterns-examples-and-implementation-tactics-5b1868b7d4a1)
- [Appinventiv — AI Agent-Driven UIs](https://appinventiv.com/blog/ai-ui-replacing-apps-and-buttons/)

---

## 6. Dashboard Modules: Widget-Based, Drag-Drop, AI-Curated

### Widget System Architecture
- **Default layout** per role (admin gets full dashboard, manager gets team view)
- **Drag-and-drop rearrangement** using Gridstack.js or React DnD
- **Add/remove widgets** from a widget library panel
- **Persist layouts** per user in database/localStorage

### Essential Dashboard Widgets for Coffee E-Commerce
1. **Revenue KPI card** — today / this week / this month with trend arrow
2. **Orders pipeline** — horizontal funnel (New → Confirmed → Roasting → Shipped → Delivered)
3. **Top products** — bar chart or ranked list with thumbnails
4. **Low stock alerts** — red-flagged products needing reorder
5. **Recent orders** — compact table, last 10 orders with status badges
6. **Customer acquisition** — new vs returning customers chart
7. **AI insights** — auto-generated summary: "Your best seller this week is Ethiopia Yirgacheffe, up 34%"

### AI-Curated Dashboard
- System learns which widgets the user actually looks at
- Suggests removing unused widgets: "You haven't checked the traffic widget in 2 weeks — hide it?"
- Surfaces anomalies: "Unusual spike in returns for product X"
- Morning briefing widget with daily summary

### References
- [Gridstack.js](https://gridstackjs.com/)
- [React-Dazzle](https://malfroid.com/en/react-dazzle-build-a-custom-drag-and-drop-dashboard-guide/)
- [Appsmith Widgets](https://www.appsmith.com/widgets)

---

## 7. Navigation: Command Palette, Breadcrumbs, Recent Items

### Command Palette (Cmd+K)
The single most impactful navigation upgrade for power users. Benefits:
- **Speed** — find any page, order, customer, product in 2 keystrokes
- **Discoverability** — users discover features they didn't know existed
- **Cleaner UI** — less need for deep menu hierarchies
- **Actions** — not just navigation: "Create order", "Export products", "Toggle dark mode"

#### Implementation for YourWave
Categories in the palette:
- **Navigation**: Go to Orders, Go to Products, Go to Customers...
- **Actions**: Create new order, Add product, Export report...
- **Search**: Find order #1234, Find customer "John"...
- **Recent**: Last 5 visited pages
- **Settings**: Toggle dark mode, Change language...

### Breadcrumbs
- Always show: `Dashboard > Orders > Order #1234`
- Clickable at every level
- Compact — use `>` separator, small font
- On mobile: collapse to `... > Order #1234` with dropdown for full path

### Recent Items
- Sidebar section: "Recently Viewed" with last 5-8 items
- Show item type icon + name + timestamp
- Keyboard shortcut to cycle through recent items

### References
- [Mobbin — Command Palette](https://mobbin.com/glossary/command-palette)
- [Medium — Command Palette UX Patterns](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1)
- [Maggie Appleton — Command K Bars](https://maggieappleton.com/command-bar)

---

## 8. Dark Mode Patterns for Admin Interfaces

### Color Strategy
- **Base background**: #0f1117 (near-black, not pure black)
- **Surface cards**: #1a1d27 (slightly elevated)
- **Borders**: #2a2d37 (subtle separation)
- **Primary text**: #e4e4e7 (not pure white — reduces glare)
- **Secondary text**: #9ca3af (muted for labels)
- **Accent**: brand color at higher saturation for dark backgrounds

### Rules
1. **Never use pure black (#000)** — it creates too much contrast and feels harsh
2. **Increase border visibility** — borders that were subtle in light mode need to be more visible
3. **Adjust semantic colors** — success green, error red etc. need to be lighter/more saturated on dark backgrounds
4. **Shadow replacement** — shadows don't work on dark backgrounds; use lighter borders or subtle glows instead
5. **Image handling** — product images need a subtle border/background to not float on dark surfaces
6. **Charts** — use lighter, more vivid colors for data visualization on dark backgrounds
7. **System preference detection** — `prefers-color-scheme: dark` media query for auto-switching
8. **Persist choice** — save user preference, override system default

### Implementation
```css
:root { /* Light mode defaults */ }
[data-theme="dark"] {
  --bg-primary: #0f1117;
  --bg-surface: #1a1d27;
  --bg-elevated: #242730;
  --border: #2a2d37;
  --text-primary: #e4e4e7;
  --text-secondary: #9ca3af;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Same dark tokens */
  }
}
```

### References
- [AdminLTE — Dashboard Color Schemes](https://adminlte.io/blog/best-admin-dashboard-color-schemes/)
- [Flatlogic — Dark-Themed Admin Templates](https://flatlogic.com/blog/top-7-dark-themed-admin-templates/)

---

## 9. Compact Design (High Information Density)

### The Snatch-Level Density Approach
For power users who live in the admin panel all day:

#### Typography
- Body: 14px (not 16px)
- Labels: 12px
- Headers: 16-18px
- Line height: 1.4 (20px for 14px body)
- Font: Inter or system-ui (optimized for small sizes)

#### Spacing
- Row height in tables: 36-40px (not 48-56px)
- Button height: 32px (compact) / 36px (default)
- Padding: 8-12px (not 16-24px)
- Card gap: 12px (not 24px)

#### Principles
1. **Compress whitespace with discipline** — reduce, don't eliminate
2. **Increase layout margins as component density increases** — larger gutters compensate for denser components
3. **Progressive disclosure** — hide secondary info behind "..." menus and expandable rows
4. **Density toggle** — let users switch between "Comfortable" and "Compact" modes (like Gmail)
5. **Maintain 44px touch targets** for accessibility even in compact mode
6. **Strong visual hierarchy** — denser layouts need MORE contrast between levels, not less

#### Material Design Density Scale
- Default (0): standard spacing
- Compact (-1): reduced padding, smaller touch targets
- Dense (-2): minimum spacing, for data-heavy views
- Ultra-dense (-3): spreadsheet-level density

### References
- [Paul Wallas — Designing for Data Density](https://paulwallas.medium.com/designing-for-data-density-what-most-ui-tutorials-wont-teach-you-091b3e9b51f4)
- [Matt Strom — UI Density](https://mattstromawn.com/writing/ui-density/)
- [Material UI — Density](https://mui.com/material-ui/customization/density/)
- [Cloudscape — Content Density](https://cloudscape.design/foundation/visual-foundation/content-density/)

---

## 10. Recommended Tech Stack & Design Systems

### Component Libraries
| Library | Why |
|---------|-----|
| **shadcn/ui** | Headless, customizable, Tailwind-native, copy-paste components |
| **Radix UI** | Accessible primitives underneath shadcn |
| **Tailwind CSS v4** | Utility-first, design token system, dark mode built-in |
| **React Table (TanStack)** | Headless table with sorting, filtering, pagination, virtual scroll |
| **Gridstack.js** | Drag-and-drop dashboard widget layout |
| **cmdk** | Command palette component (used by Vercel, Linear) |

### Design System References
| System | Best For |
|--------|----------|
| [Shopify Polaris](https://polaris.shopify.com/) | E-commerce admin patterns, index tables, filters |
| [Carbon Design System](https://carbondesignsystem.com/) | Status indicators, data visualization, accessibility |
| [Linear Design System](https://www.figma.com/community/file/1222872653732371433) | Dense desktop UI, sidebar patterns, keyboard nav |
| [Stripe Apps](https://docs.stripe.com/stripe-apps/design) | Clean data display, transaction detail panels |
| [Cloudscape](https://cloudscape.design/) | Density modes, enterprise admin patterns |

### Admin Templates Worth Studying
| Template | Highlights |
|----------|-----------|
| **Zenith** (Next.js 16) | Minimal achromatic design, 50+ routes, CRM variant, shadcn/ui |
| **Apex** (Next.js 16) | 125+ routes, 5 dashboard variants, eCommerce + CRM |
| **Metronic** | 1000+ UI components, dark mode, RTL support |

---

## Summary: Top Patterns for YourWave v2

### Must-Have (Priority 1)
1. **Three-column layout** — sidebar + main + detail panel
2. **Command palette** (Cmd+K) — universal search + actions
3. **Status pipeline visualization** — horizontal progress for orders
4. **Quick filters + saved views** — persistent filter bar on all lists
5. **Dark mode** — with system preference detection

### Should-Have (Priority 2)
6. **Card/table view toggle** for products
7. **Inline editing** in tables (status, quick fields)
8. **Density toggle** (Comfortable / Compact)
9. **Widget-based dashboard** with drag-and-drop
10. **Breadcrumbs + recent items** in sidebar

### Nice-to-Have (Priority 3)
11. **AI companion panel** — contextual suggestions and NLP queries
12. **AI-curated dashboard** — learns which widgets matter to each user
13. **Keyboard-first navigation** — full keyboard shortcuts system
14. **Contextual empty states** with guided onboarding
