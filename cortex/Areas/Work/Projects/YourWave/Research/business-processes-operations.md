---
source_hash: fdde5d826024e16093718c7803feeefe0ff6f534bb2230dcfea457fa94dd548c
embedding_model: text-embedding-3-small
---
# YourWave — Business Process Map & Operations Guide

*Document type: Living operational reference*
*Created: 2026-03-28*
*Team: Andriy (ops/tech/product) + wife (SMM/content/brand)*
*Phase: Phase 1 — contract roasting*

---

## Table of Contents

1. [Supply Chain Overview](#1-supply-chain-overview)
2. [Process: Green Coffee Procurement](#2-process-green-coffee-procurement)
3. [Process: Contract Roasting Coordination](#3-process-contract-roasting-coordination)
4. [Process: Packaging & Labeling](#4-process-packaging--labeling)
5. [Process: Order Management & Subscriptions](#5-process-order-management--subscriptions)
6. [Process: Inventory Management](#6-process-inventory-management)
7. [Process: Fulfillment — Pick, Pack, Ship](#7-process-fulfillment--pick-pack-ship)
8. [Process: Customer Service & Returns](#8-process-customer-service--returns)
9. [Process: Content & Marketing](#9-process-content--marketing)
10. [Process: Financial & Accounting](#10-process-financial--accounting)
11. [Systems & Tools Stack](#11-systems--tools-stack)
12. [Weekly Operations Rhythm](#12-weekly-operations-rhythm)
13. [Key Metrics & Thresholds](#13-key-metrics--thresholds)
14. [Phase 2 Transition Triggers](#14-phase-2-transition-triggers)

---

## 1. Supply Chain Overview

### End-to-End Flow

```
ORIGIN
  │
  │  Green coffee (washed, natural, honey — specialty 84+ SCA)
  │  Farmers/cooperatives in Ethiopia, Colombia, Kenya, etc.
  ▼
GREEN COFFEE SUPPLIER
  │  Jakafe (Prague) — domestic, low friction, quick turnaround
  │  Algrano (Bremen) — direct trade marketplace, content-rich
  │  Trabocca / Nordic Approach — premium lots, forward buying
  ▼
YOURWAVE STORAGE (green coffee)
  │  Rented space, Prague
  │  Conditions: 15–20°C, ~60% humidity, dark, odor-free
  │  Shelf life: 12–18 months
  ▼
CONTRACT ROASTER
  │  Top candidates: Mamacoffee (Prague), Doubleshot (Prague)
  │  Also: Industra Coffee (Brno), The Miners (Prague)
  │  You supply green coffee → they roast to your profile
  │  Roasting fee: ~3–5 EUR/kg
  │  Lead time: typically 1–2 weeks
  ▼
ROASTED COFFEE (returned to you)
  │  Stored in your space: cool, dark, sealed
  │  Optimal resting: 7–14 days post-roast before shipping
  │  Shelf life: 3–6 months (whole bean), 2–4 weeks (ground)
  ▼
PACKAGING & LABELING
  │  Your space: bag/sealing equipment, label printer
  │  Formats: 200g whole bean bags, drip bags (10-pack), mix boxes
  │  Labels: CZ + EN bilingual (legally required)
  ▼
STORAGE (finished goods)
  │  Shelved by SKU and roast date (FIFO rotation)
  │  Ready-to-ship inventory
  ▼
ORDER RECEIVED (website)
  │  One-time purchase or subscription order
  │  Triggered by: new order, subscription renewal, manual reorder
  ▼
FULFILLMENT
  │  Pick → Pack → Label → Hand off to carrier
  ▼
LAST-MILE DELIVERY
  │  Zásilkovna/Packeta — pickup points, CZ + EU
  │  DPD / Balikovna — home delivery, CZ domestic
  │  FedEx — premium international (Phase 2)
  ▼
CUSTOMER
  │  Delivers within 2–5 days (CZ), 5–10 days (EU)
  │  Tracking notification sent automatically
  ▼
POST-DELIVERY
     Review request, feedback email, subscription renewal prompt
```

### Unit Economics Summary (Phase 1)

| Component | Cost |
|-----------|------|
| Green coffee (specialty) | 6–12 EUR/kg |
| Contract roasting fee | 3–5 EUR/kg |
| Packaging (bag + label) | 0.50–1.50 EUR/unit |
| Shipping (CZ pickup point) | ~3–4 EUR |
| Payment processing (Stripe ~1.5%) | ~0.30–0.70 EUR |
| **Total COGS per 200g bag** | **~4–7 EUR** |
| **Selling price (200g)** | **€10–18** |
| **Gross margin** | **~55–70%** |

---

## 2. Process: Green Coffee Procurement

**Owner:** Andriy
**Frequency:** Monthly or per-roast-run (initially every 4–6 weeks)
**Lead time:** Jakafe: 3–5 days; Algrano shared shipment: up to 4 months from deadline

### 2.1 Supplier Selection Logic

```
Do we have green stock for next roast run?
  YES → No action needed
  NO  → How much lead time do we have?
          > 3 months → Place Algrano order (best story/price)
          1–3 months → Order from Trabocca or Nordic Approach
          < 2 weeks  → Order from Jakafe (Prague domestic, fastest)
```

### 2.2 Standard Procurement Flow

```
Step 1: Determine what needs to be roasted in next cycle
  → Check inventory (how many bags of each SKU remain?)
  → Calculate green coffee needed: bags × 200g ÷ (1 - roast loss ~15%)
  → Example: 100 bags of 200g = 20kg roasted = ~23.5kg green

Step 2: Check supplier availability
  → Log into Jakafe / Algrano / supplier portal
  → Confirm the lot you want is still available
  → Request sample if it's a new origin (allow 1–2 weeks for tasting)

Step 3: Place order
  → Specify: origin, lot name, weight (kg), delivery address
  → Confirm payment (EUR bank transfer or card)
  → Get estimated delivery date

Step 4: Receive and inspect
  → Check: weight, packaging integrity, no moisture damage
  → Record: lot name, origin, weight received, SCA score (if available)
  → Store: cool, dark, 15–20°C, away from odors

Step 5: Log in inventory system
  → Add lot to inventory tracker (Notion or Airtable)
  → Fields: supplier, origin, lot, date received, weight (kg), cost/kg, total cost
```

### 2.3 Supplier Contacts & Notes

| Supplier | Best For | Contact | Lead Time | MOQ |
|----------|----------|---------|-----------|-----|
| Jakafe (jakafe.cz) | Quick restocks, Prague-local | info@jakafe.cz | 3–5 days | ~5 kg |
| Algrano (algrano.com) | Direct-trade narrative, marketing | Platform messaging | 4+ months | ~3 bags (~60kg+) |
| Trabocca (trabocca.com) | Ethiopian lots, reliability | MyTrabocca portal | 2–4 weeks | 1 bag (60 kg) |
| Nordic Approach | Premium 86+ lots, competition | coffee@nordicapproach.no | 2–4 weeks | TBC |
| Falcon Micro (falcon-micro.com) | Testing new origins | Platform | 1–2 weeks | 1–10 kg |

### 2.4 Green Coffee Tasting Protocol (new lots)

Before committing to a full purchase:
1. Order 100g sample green (Jakafe) or roasted sample (Algrano/Trabocca)
2. Have contract roaster do a small test roast (ask for 500g–1kg test roast as part of your roasting relationship)
3. Taste: grind, brew as V60 or Aeropress, evaluate body/acidity/sweetness/clarity
4. If approved: place full order. If not: try another lot.

### 2.5 Automation Potential

- Inventory threshold alert: when green coffee stock < 2 roast runs, auto-notify Andriy (Notion formula or Airtable automation)
- Algrano: set up "Requests" to receive alerts when matching lots become available

---

## 3. Process: Contract Roasting Coordination

**Owner:** Andriy
**Frequency:** Every 4–6 weeks (Phase 1), scaling to bi-weekly as volume grows
**Key vendors:** Mamacoffee (top pick), Doubleshot, Industra Coffee

### 3.1 Setting Up the Roasting Relationship

One-time setup per roaster:
1. **Initial meeting/call:** Visit roastery. Discuss: MOQ, pricing (EUR/kg fee), roast profile development, lead times, white-label/no-label options.
2. **Roast profile development:** Provide green sample → roaster develops light/medium profile → cupping session → approve or iterate.
3. **Agreement:** Written email confirmation covering: price/kg, lead time, minimum batch size, how green coffee is delivered/picked up, labeling expectations, payment terms.
4. **Test roast:** First real batch (e.g., 5 kg) → evaluate consistency vs. agreed profile.

### 3.2 Per-Cycle Roasting Flow

```
Week -3: Confirm roast schedule
  → Email/call roaster to book slot
  → Confirm green coffee lot(s) to be roasted
  → Confirm quantity (kg) and profiles (light/medium)

Week -2: Deliver green coffee to roaster
  → Transport green coffee bags to roastery
    (or arrange pickup if roaster offers it)
  → Hand off with: lot name, weight, desired profile, any brew notes

Roasting day (set by roaster):
  → Roaster roasts to agreed profile
  → Roaster quality-checks (visual, agtron if available)
  → Batch cooled and rested 12–24 hours minimum

Pickup (day after roasting or as agreed):
  → Pick up roasted coffee in bulk bags or grainpro bags
  → Weigh and confirm batch weight (expect ~15% loss from green)
  → Inspect: color consistency, no scorching, aroma check

Rest period: 7–14 days before shipping
  → Store in cool, dark space with one-way valve bags
  → Label bags with: origin, roast date, lot, roast profile

Then: Move to finished goods → ready for packaging
```

### 3.3 Roasting Schedule Template

| Event | Timing | Who |
|-------|--------|-----|
| Book roasting slot | 3 weeks before needed | Andriy |
| Deliver green coffee | 1 week before roast | Andriy |
| Roasting day | Per roaster schedule (Industra: Tue/Wed) | Roaster |
| Pickup roasted coffee | Day after roasting | Andriy |
| Rest period | 7–14 days | — |
| Ready for packaging | After rest period | Andriy |

### 3.4 Roast Profile Documentation

For each SKU, maintain a profile card:

```
Origin: Colombia — Huila, Washed
Supplier: Jakafe / Lot: HU-2025-04
Target profile: Light roast (Agtron ~65–70)
Roaster: Mamacoffee
Notes: Emphasize stone fruit and caramel. Stop at first crack + 30s.
Approved: [date] after cupping session
```

---

## 4. Process: Packaging & Labeling

**Owner:** Andriy (physical) + wife (label design)
**Frequency:** Per batch, linked to roasting cycle
**Legal basis:** Czech food law (Act No. 110/1997 Coll.) + EU Regulation 1169/2011

### 4.1 Czech Legal Requirements for Coffee Labels

Every bag must display (in Czech — EN can be secondary):

| Required Field | Example |
|----------------|---------|
| Product name | Specialty coffee — single origin |
| Net weight | 200 g |
| Country of origin | Ethiopia (or "Roasted in Czech Republic") |
| Best before date | 6 months from roast date (whole bean) |
| Lot/batch number | CZ-2026-03-A |
| Allergen info | No common allergens in plain coffee — state "Contains no allergens" |
| Importer/seller name & address | YourWave s.r.o., Prague, Czech Republic |
| Storage instructions | Store in cool, dry place away from light |
| SZPI registration number | Required once registered |

**Note on language:** Czech law requires Czech language on labels for CZ market. You can include English alongside. For EU export, the destination country's language applies — for Phase 1 (CZ only), bilingual CZ+EN is ideal and sufficient.

### 4.2 Label Design Guidelines

- Two label types: front (brand design) + back (legal info)
- Front: YourWave logo, origin name, flavor notes (e.g., "Blueberry, Dark chocolate, Citrus"), roast level visual
- Back: all legal requirements (see above), QR code linking to Atlas article for that origin
- Material: kraft/matte recommended for specialty coffee aesthetic
- Print: digital print for small runs (Vistaprint, Helloprint, local CZ printers); laser printer + label stock for v1 prototypes

### 4.3 Packaging Equipment Needed

| Item | Phase 1 Option | Cost |
|------|---------------|------|
| Coffee bags (one-way valve, kraft) | Alibaba / packaging supplier; 500-bag MOQ | ~0.40–0.80 EUR/bag |
| Label printer | Brother QL-820NWB or Zebra ZD220 | €200–400 one-time |
| Label stock | 62mm or custom rolls | ~€20–50/roll |
| Heat sealer or impulse sealer | Basic impulse sealer | €30–80 |
| Digital scale | 0.1g precision | €30–80 |
| Tape + packing table | — | €50 |

For drip bags: pre-made drip bag kits (sourced from specialty suppliers like MoreCoffee, Goat Story) or commission in bulk from a drip bag manufacturer.

### 4.4 Packaging Flow (Per Batch)

```
After rest period (7–14 days post-roast):

1. Set up packing station
   → Scale, bags, labels, sealer, gloves

2. Weigh portions
   → 200g per bag (whole bean)
   → Drip bags: 10–12g per bag, sealed individually

3. Fill bags
   → Use funnel or portioning scoop
   → Leave ~2cm headspace for sealing

4. Seal bags
   → Impulse sealer: 2–3 second seal
   → Check seal integrity (press bag — no air leak)

5. Apply labels
   → Front label: press firmly, no bubbles
   → Back label: check all required fields are legible

6. QC check (sample every 10th bag)
   → Weight correct?
   → Seal intact?
   → Labels correct for this origin?
   → Lot number matches?

7. Move to finished goods shelf
   → Sort by SKU and date (FIFO)
   → Update inventory count
```

---

## 5. Process: Order Management & Subscriptions

**Owner:** Andriy (system setup + monitoring) + platform automation
**Frequency:** Daily check; real-time processing via platform

### 5.1 Platform Architecture

YourWave runs on a custom platform (Astro + Supabase + Cloudflare Pages) — not Shopify. Key components:

| Module | Function | Tool |
|--------|----------|------|
| E-shop | Product catalog, cart, checkout | Astro + React islands |
| Payments | Stripe (CZK/EUR, Apple/Google Pay) | Stripe |
| Subscriptions | Recurring billing logic | Stripe Billing + Supabase |
| Bundle Builder | 3-step wizard (core UX) | Custom React island |
| Order DB | All orders, statuses, customer data | Supabase PostgreSQL |
| CRM Dashboard | Desktop-only admin view | Custom (Astro + Supabase) |
| Email flows | Transactional + marketing | Klaviyo or Resend |

### 5.2 Order Lifecycle

```
CUSTOMER PLACES ORDER
  │
  ├─ One-time purchase
  │     → Stripe creates PaymentIntent → charge
  │     → Supabase: new order row (status: "paid")
  │     → Email: order confirmation (automatic)
  │     → Fulfillment queue: order appears in CRM dashboard
  │
  └─ Subscription
        → Stripe creates Subscription object
        → Recurring billing on chosen cadence (every 2/4 weeks)
        → Each billing cycle: Stripe webhook → Supabase order created
        → Same fulfillment flow as one-time

ORDER IN FULFILLMENT QUEUE
  → Andriy processes (pick/pack/ship)
  → Status updated: "fulfilled" → "shipped"
  → Tracking number entered → customer auto-notified

ORDER DELIVERED
  → Carrier webhook (Packeta/DPD) updates status to "delivered"
  → D+3: review/feedback email sent

SUBSCRIPTION RENEWAL
  → Stripe auto-charges on renewal date
  → New order auto-created in Supabase
  → Customer can: skip, pause, swap product, cancel (self-service portal)
```

### 5.3 Subscription Management Rules

| Action | How |
|--------|-----|
| Skip a delivery | Customer self-service portal (Stripe customer portal) |
| Pause subscription | Up to 2 months via portal |
| Swap product | Change next order's product selection in portal |
| Cancel | Portal (no friction — just offer pause first) |
| Billing failure | Stripe retries 3x over 7 days → email notifications → pause if all fail |

### 5.4 Key Order Management Tasks (Daily)

- [ ] Check new orders in CRM dashboard (every morning)
- [ ] Confirm payment status (Stripe dashboard or Supabase view)
- [ ] Identify orders ready for fulfillment
- [ ] Check for failed payments or subscription issues
- [ ] Respond to any cancellation/pause requests

---

## 6. Process: Inventory Management

**Owner:** Andriy
**Frequency:** Real-time tracking + weekly reconciliation
**Tool:** Notion database or Airtable (Phase 1); Supabase inventory module (Phase 2)

### 6.1 Inventory Categories

| Category | What | Unit | Where Stored |
|----------|------|------|--------------|
| Green coffee | Raw beans by origin/lot | kg | Cool, dark storage |
| Roasted coffee (bulk) | Roasted, not yet packaged | kg | Cool, dark storage |
| Finished goods | Packaged, labeled, ready to ship | units (bags) | Shelves, by SKU |
| Packaging materials | Bags, labels, boxes, tape | units / rolls | Packing area |

### 6.2 Inventory Tracking Sheet (Notion/Airtable Template)

**Green Coffee Stock:**
```
| Lot ID | Origin | Supplier | Date Received | Weight (kg) | Status | Cost/kg |
|--------|--------|----------|---------------|-------------|--------|---------|
| JK-001 | Ethiopia Shakisso | Jakafe | 2026-03-15 | 10 kg | Available | €7.50 |
```

**Finished Goods Stock:**
```
| SKU | Product | Roast Date | Qty in Stock | Min Threshold | Reorder Point |
|-----|---------|------------|--------------|---------------|---------------|
| WO-ETH-200 | Wave Origins Ethiopia 200g | 2026-03-10 | 47 bags | 20 bags | 30 bags |
```

### 6.3 Reorder Logic

```
For each SKU:
  IF finished_goods_stock < reorder_point:
    → Trigger roasting run
    → Check green coffee stock
      IF green_stock < next_roast_quantity:
        → Order green coffee (Jakafe for speed)

Reorder point formula:
  = (avg daily sales × lead time in days) + safety stock
  Example: 3 bags/day avg × 10 days lead time + 10 safety = 40 bags threshold
```

### 6.4 FIFO Rule

Strict FIFO (First In, First Out) on finished goods:
- New stock goes to the BACK of the shelf
- Fulfill from the FRONT (oldest first)
- Label each shelf section with roast date

### 6.5 Weekly Inventory Reconciliation

Every Monday:
1. Count physical stock of all SKUs
2. Compare to tracker
3. Investigate discrepancies (mis-picks, damaged goods)
4. Update tracker
5. Flag any SKUs approaching minimum threshold

---

## 7. Process: Fulfillment — Pick, Pack, Ship

**Owner:** Andriy
**Frequency:** Daily (or every 2 days at low volume)
**Target:** Same-day or next-day dispatch after order placed

### 7.1 Fulfillment Station Setup

Permanent packing area in storage space:
- Shelf with finished goods organized by SKU
- Packing table: boxes, bubble wrap, paper fill, tape gun
- Label printer connected to laptop/tablet
- Scale for package weight
- Printed packing slips or tablet showing orders

### 7.2 Daily Fulfillment Flow

```
MORNING (30–60 minutes):

1. Open CRM dashboard → view today's fulfillment queue
   → Filter: orders paid + not yet shipped

2. Print pick list (or work from tablet screen)
   → Sort by SKU for efficient picking

3. Pick items from shelf
   → Match SKU + quantity to order
   → FIFO: take from front of shelf

4. Pack each order:
   → Choose box/mailer size for contents
   → Wrap delicate items (drip packs)
   → Insert: packing slip + thank-you card + brewing tip card
   → Seal box/mailer

5. Generate shipping label:
   → In CRM (connected to Packeta/DPD API)
   → Enter: customer address, weight, dimensions
   → Select carrier (customer's choice from checkout)
   → Print label → apply to package

6. Sort packages by carrier:
   → Zásilkovna stack vs. DPD stack

7. Update order status to "Shipped" in CRM
   → Enter tracking number
   → System auto-sends tracking email to customer

8. Hand off to carrier:
   → Zásilkovna: take to nearest drop-off point OR arrange pickup
   → DPD: drop at DPD point or schedule courier pickup
```

### 7.3 Packaging Materials Checklist

Per order:
- [ ] Correct SKU(s) — verify against order
- [ ] Roast date (newest stock last, oldest first — FIFO)
- [ ] Appropriate box/mailer (right size — reduces shipping cost)
- [ ] Packing slip (includes order number, customer name, items)
- [ ] Thank-you card (printed, branded)
- [ ] Brewing tip card (one per shipment — rotate tips)
- [ ] Sealed properly — no rattling, no damage risk

### 7.4 Shipping Carrier Selection Logic

```
Customer at checkout selects delivery method.
Default recommended options:

CZ domestic:
  → Pickup point (Zásilkovna): ~89 CZK | 2–3 days | 10 kg max
  → Home delivery (DPD CZ): ~129 CZK | next business day
  → Balikovna (cheapest): ~75 CZK | 2–4 days (for price-sensitive)

EU international:
  → Zásilkovna EU network: varies by country | 3–7 days
  → DPD EU: varies | 3–5 days

Free shipping threshold:
  → CZ: orders ≥ 800 CZK → free Zásilkovna pickup
  → EU: orders ≥ 1,500 CZK (€60) → free Zásilkovna EU
```

### 7.5 Carrier Drop-Off Schedule

- Zásilkovna: drop packages at nearest Zásilkovna point daily (or every 2 days)
- DPD: schedule daily/bi-daily courier pickup from your space (once volume justifies)

---

## 8. Process: Customer Service & Returns

**Owner:** Andriy (primary, handles tech/logistics issues) + wife (handles tone/brand voice communications)
**Channels:** Email (primary), Instagram DM (social queries)
**Target response time:** < 24 hours on working days

### 8.1 Customer Service Categories

| Issue Type | Frequency | Handler | Resolution |
|------------|-----------|---------|------------|
| Order status / tracking | High | Andriy | Check CRM, send tracking link |
| Subscription management | Medium | Andriy | Guide to self-service portal or action directly |
| Coffee quality complaint | Low | Both | Investigate lot, offer replacement or refund |
| Wrong item shipped | Very low | Andriy | Ship correct item + prepaid return label |
| Damaged in transit | Low | Andriy | Photo evidence → carrier claim + resend |
| Cancel subscription | Medium | Both | Offer pause first, then process |
| General coffee questions | Medium | Wife | Brewing guides, recommendations |

### 8.2 Returns & Complaints Policy

**Coffee (perishable goods):**
- EU law: 14-day right of withdrawal applies to distance purchases
- Exception: perishable goods or opened goods — coffee once opened cannot be returned for hygiene reasons
- Practice: if customer is unhappy with taste/quality → offer store credit or replacement (first complaint: goodwill gesture)
- Damaged/wrong order: full replacement at no charge

**Return Flow:**
```
Customer contacts support
  │
  ├─ Quality complaint (bad taste, off flavors)
  │     → Ask: grinder? brew method? storage?
  │     → If likely our fault (bad batch): send replacement + note for batch review
  │     → If likely brewing issue: send brew guide + optional discount on next order
  │
  ├─ Damaged package (carrier damage)
  │     → Ask for photo
  │     → File carrier claim (Zásilkovna/DPD — they have insurance)
  │     → Send replacement immediately, don't wait for claim resolution
  │
  └─ Wrong item shipped
        → Apologize + ship correct item next day
        → Include prepaid return label for the wrong item (or waive return for low value)
```

### 8.3 Standard Email Responses (Templates to Build)

Build a template library in Notion:
1. Order confirmation (automated)
2. Shipping notification with tracking (automated)
3. "Where is my order?" response
4. Quality complaint — brewing issue (with brew guide)
5. Quality complaint — our fault (apology + replacement)
6. Subscription cancellation (offer pause, then confirm)
7. Thank you after first delivery

---

## 9. Process: Content & Marketing

**Owner:** Wife (content/brand/SMM) with Andriy support on coffee knowledge/product info
**Frequency:** See content calendar below
**Channels:** Instagram (primary), TikTok (secondary), Pinterest (passive), Email newsletter

### 9.1 Content Pillars

| Pillar | Description | Owner | Frequency |
|--------|-------------|-------|-----------|
| Origin Stories | Where each coffee comes from, the farm, the process | Both | Per new origin (monthly) |
| Brewing Education | How to brew better at home, tips by method | Wife (script) + Andriy (coffee knowledge) | Weekly |
| Behind the Scenes | Roasting day, packing orders, supplier visits | Wife | Bi-weekly |
| Product/Drop Announcements | New coffees, bundles, limited releases | Wife | Per drop |
| Coffee Atlas Articles | Long-form SEO content on origins, processing, flavor | Wife writes, Andriy reviews | 2–4/month |

### 9.2 Monthly Content Calendar Template

```
Week 1:
  Monday:   Atlas article published (new origin or processing method)
  Tuesday:  Instagram Reel (behind the scenes: packing orders or roasting day)
  Thursday: Instagram carousel (origin story for this month's featured coffee)

Week 2:
  Monday:   Email newsletter (new coffee drop, brewing tip, Atlas highlight)
  Wednesday: Instagram Reel (brewing tutorial: this month's coffee on V60 or Aeropress)
  Friday:   TikTok (quick version of brewing tutorial OR coffee fact)

Week 3:
  Monday:   Atlas article (processing method: washed vs. natural explained)
  Wednesday: Instagram carousel (flavor notes explained — what does "stone fruit" taste like?)
  Friday:   Instagram story series (Q&A about this month's origin)

Week 4:
  Tuesday:  Instagram Reel (teaser for next month's origin)
  Thursday: Email newsletter (subscription spotlight — how subscribers discover new coffees)
  Saturday: Pinterest pins (3–5 recipe/aesthetic pins linking to Atlas)
```

### 9.3 Atlas Article Workflow (SEO Content)

```
1. Choose topic
   → New origin: linked to a current product
   → Processing method (washed, natural, honey, anaerobic)
   → Brewing guide (V60, Chemex, Aeropress, French Press)
   → Coffee concept (specialty coffee vs. commodity, what SCA scores mean)

2. Research
   → Supplier info (Algrano product pages, Jakafe lot details)
   → Andriy provides coffee knowledge inputs
   → External sources: SCA, Perfect Daily Grind, European Coffee Trip

3. Write draft (wife)
   → Target length: 1,200–2,000 words
   → SEO: include target keyword in H1, H2s, first paragraph
   → Format: readable, conversational, with visual breaks (headers, bullets, photos)

4. Review (Andriy)
   → Check coffee facts accuracy
   → Add personal touches (your sourcing story, cupping notes)

5. Publish on Atlas (yourwave.coffee/atlas/[slug])
   → Add featured image (origin photo from supplier or license-free)
   → Link to related products in shop
   → Add email capture CTA at bottom

6. Repurpose
   → Extract 3 Instagram carousel slides from the article
   → Extract 1 Reel script idea
   → 5 Pinterest pins with article link
```

### 9.4 Email Marketing Flows

**Automated flows (build before launch):**

1. **Welcome Series (3 emails over 7 days)**
   - Email 1 (immediate): Welcome + what YourWave is about + link to Atlas
   - Email 2 (day 3): Your sourcing story (green coffee → roaster → your door)
   - Email 3 (day 7): First purchase offer (10% discount or free shipping)

2. **Post-Purchase Flow (first order)**
   - Email 1 (day after delivery): How to brew this coffee + flavor notes
   - Email 2 (day 10): Rate your coffee + origin story article link
   - Email 3 (day 21): Subscription offer ("Get this automatically every month")

3. **Subscription Renewal Reminder**
   - 3 days before billing: "Your next wave is coming" + what's in next delivery

4. **Win-Back (lapsed customers)**
   - 60 days no purchase: "We got something new you'll like" + new origin feature

**Newsletter (monthly):**
- New coffee drop announcement
- Brewing tip of the month
- "Farmer spotlight" (content from Algrano / origin story)
- What's coming next month

### 9.5 Instagram Strategy

- **Handle:** @yourwave.coffee (or @yourwave_coffee)
- **Bio format:** "Coffee discovery. Prague. ☕ Specialty subscriptions. Explore your next wave →" [link in bio]
- **Post formats:** Reels (50%) > Carousels (30%) > Static posts (20%)
- **Aesthetic:** Consistent color palette (TBD from brand identity), natural light, craft materials
- **Hashtags:** #specialtycoffee #coffeesubscription #praguelife #coffeeroaster #singleorigincoffee

### 9.6 Marketing Automation

| Tool | Purpose | Cost |
|------|---------|------|
| Klaviyo | Email flows + newsletter | Free to 500 contacts; ~€30/month at 1,000 |
| Later / Buffer | Schedule Instagram posts | Free plan sufficient at start |
| Canva Pro | Quick content design | €13/month |
| CapCut / DaVinci Resolve | Reel/TikTok editing | Free |

---

## 10. Process: Financial & Accounting

**Owner:** Andriy (primary) + Czech accountant (hired external)
**Frequency:** Weekly bookkeeping, monthly close, quarterly VAT (if registered)
**Czech legal requirement:** Accounting records for 5 years

### 10.1 Legal & Tax Structure

| Item | Detail |
|------|--------|
| Entity | S.R.O. (register ~2 months before launch) |
| Registration | Justice.cz or via Domu Tax (~€300–500 service fee) |
| Trade licence | Živnostenský list — needed for food trade |
| SZPI registration | Czech Food Inspection Authority — mandatory before first sale |
| VAT | Coffee taxed at 12% (reduced rate). Registration required when turnover > 2M CZK (~€80k). Voluntary earlier optional. |
| Corporate tax | 19% of net profit (Czech s.r.o. standard) |
| Invoicing | Must issue Czech-compliant invoices with: IČO, DIČ (if VAT registered), date, due date |

### 10.2 HACCP Requirements

As a food business (packer/distributor, not manufacturer), you need a simplified HACCP plan:
- **Critical control points (CCP) for YourWave:**
  - CCP1: Green coffee storage (temperature, humidity, pest control)
  - CCP2: Packaging hygiene (clean surfaces, no cross-contamination)
  - CCP3: Labeling accuracy (correct date, correct product)
- Document: weekly temperature log for storage space, cleaning schedule
- Self-declaration HACCP plan: acceptable at this scale. Consult a food safety consultant for template (~€200–500 one-time).

### 10.3 Invoicing & Payments

**Incoming (revenue):**
- Stripe processes all customer payments (credit card, Apple Pay, Google Pay)
- Stripe dashboard exports monthly statements
- Stripe connects to accounting software

**Outgoing (suppliers, roasters, logistics):**
- Green coffee suppliers: EUR bank transfer (international) or CZK (Jakafe)
- Contract roaster: invoice-based, 14-day payment terms typical
- Carriers (Zásilkovna, DPD): account-based, monthly invoice
- Tools (hosting, Klaviyo, etc.): card

**Czech-compliant invoicing:**
- Use: Pohoda (industry standard for CZ accounting) or Fakturoid (modern, cheaper)
- Must include: IČO, seller/buyer address, line items, VAT breakdown (once VAT registered), due date

### 10.4 Monthly Financial Routine

**Weekly (15 minutes):**
- Export Stripe payouts to accounting
- Log all expenses (receipts → Fakturoid or Pohoda)
- Flag any unusual transactions

**Monthly (60–90 minutes with accountant):**
- Reconcile bank + Stripe + accounting software
- Review P&L: revenue, COGS, gross margin, operating costs
- Check cash flow: runway, supplier payments due
- Update financial model (actual vs. target)

**Quarterly (if VAT registered):**
- VAT return (Daňové přiznání k DPH) — submit to Finanční úřad
- For non-VAT businesses: simpler tax records only

### 10.5 Startup Budget Tracking

| Category | Phase 1 Budget | Notes |
|----------|---------------|-------|
| Legal (s.r.o. registration) | €300–500 | One-time |
| SZPI + HACCP consultant | €200–500 | One-time |
| Website/platform development | In-house (AI-built) | Low cash cost |
| First green coffee purchase | €500–1,500 | 50–150 kg test lot |
| First roasting run | €150–500 | 3–5 EUR/kg × ~50 kg |
| Packaging materials (bags, labels) | €200–400 | 500-bag MOQ |
| Packaging equipment | €300–600 | Sealer, scale, label printer |
| Storage space rental | €200–500/month | Estimate |
| Marketing (content tools, ads) | €200–500/month | Canva, initial ads |
| Accounting (external) | €50–150/month | |
| Platform/tools (hosting, email) | €50–100/month | |
| **Total Phase 1 startup** | **€3,000–6,000** | Excludes ongoing monthly costs |

### 10.6 Accounting Tools (Czech-Compliant)

| Tool | Best For | Cost |
|------|----------|------|
| Fakturoid | Modern invoicing + basic accounting | ~€15–25/month |
| Pohoda | Full Czech accounting (industry standard) | ~€100–200/year |
| Stripe | Payment processing | 1.4–1.5% + €0.25/txn |
| Wise Business | EUR/CZK international payments (cheap FX) | Low fees |

**Recommendation for Phase 1:** Fakturoid for invoicing + Pohoda handled by external accountant. Stripe for payments. Wise for international supplier payments.

---

## 11. Systems & Tools Stack

### 11.1 Full Tools Map

| Category | Tool | Cost/month | Notes |
|----------|------|-----------|-------|
| **E-commerce platform** | Custom (Astro + Supabase) | ~€25–50 (hosting) | Platform v2 |
| **Payment processing** | Stripe | 1.4–1.5% + €0.25/txn | CZK + EUR |
| **Subscription billing** | Stripe Billing | Included in Stripe | Native |
| **Shipping — CZ pickup** | Zásilkovna/Packeta | Per shipment (~89 CZK) | API integrated |
| **Shipping — CZ home** | DPD CZ (via Balikobot) | Per shipment (~89–129 CZK) | API integrated |
| **Email marketing** | Klaviyo | €0 to 500 contacts | Flows + newsletter |
| **CRM / order management** | Custom CRM (Supabase) | Included | Desktop-only dashboard |
| **Inventory tracking** | Notion database or Airtable | €0–20 | Phase 1 simple tracking |
| **Accounting/invoicing** | Fakturoid + accountant | €15–25 + accountant | Czech-compliant |
| **Content scheduling** | Later / Buffer | €0–18 | Instagram scheduling |
| **Design** | Figma (brand) + Canva (social) | €13–15 | |
| **Video editing** | CapCut (mobile) or DaVinci | €0 | Reels/TikTok |
| **Analytics** | GA4 + Cloudflare Analytics | €0 | |
| **Communication** | Gmail / Notion | €0–6 | |
| **Password/secrets** | 1Password or Bitwarden | €3–5 | Shared with wife |

### 11.2 Tech Integration Map

```
[Customer Browser]
      │
      ▼
[yourwave.coffee — Astro + Cloudflare Pages]
      │
      ├─ Atlas (SSG pages) ──────────────────── No API calls (static)
      │
      ├─ Shop / Bundle Builder (React islands)
      │     │
      │     ├─ Supabase (products, inventory, orders)
      │     └─ Stripe (payments, subscriptions)
      │
      └─ CRM Dashboard (desktop, restricted access)
            │
            ├─ Supabase (all data)
            ├─ Packeta API (create shipments, labels)
            ├─ Balikobot API (DPD, Balikovna, PPL)
            └─ Klaviyo API (trigger emails from order events)

[Stripe] ──webhooks──► [Supabase Edge Function]
                              │
                              ├─ Creates order record
                              ├─ Updates subscription status
                              └─ Triggers Klaviyo email
```

### 11.3 Minimum Viable Tech Setup (Pre-Launch Checklist)

- [ ] Domain registered: yourwave.coffee
- [ ] Cloudflare Pages deployed: Atlas + Shop live
- [ ] Stripe account: verified, CZK + EUR enabled
- [ ] Packeta account: API key obtained, integration tested
- [ ] Klaviyo: connected to platform, welcome flow live
- [ ] GA4: property created, tracking code installed
- [ ] Supabase: project live, products seeded, RLS configured
- [ ] Custom CRM: order view working, label generation working
- [ ] Email: yourwave.coffee domain email set up (e.g., hello@yourwave.coffee)

---

## 12. Weekly Operations Rhythm

### Andriy's Week (Ops/Tech/Product)

**Monday — Weekly Reset (60–90 min)**
- [ ] Count physical inventory (all SKUs + green coffee)
- [ ] Check Stripe: weekend revenue, any failed payments
- [ ] Review CRM: open orders, any stuck in processing
- [ ] Check email: customer service items
- [ ] Plan the week: what needs to be packed? Any roasting coordination needed?

**Tuesday–Thursday — Core Operations**
- Daily: Process fulfillment queue (30–60 min) — pick, pack, ship orders
- Tuesday: Check inventory thresholds → initiate green coffee order if needed
- Wednesday: Platform/tech tasks (bug fixes, feature work with AI agents)
- Thursday: Financial tasks (log expenses, review week's accounting)

**Friday — Supplier & Partner**
- Confirm next roasting run with roaster (if due in next 2 weeks)
- Reply to any supplier queries
- Review marketing analytics (Instagram, email, website) with wife
- Plan next week

**Weekend (minimal)**
- Check for urgent customer issues (5 min)
- Andriy's job: primary income source — weekend is personal time

### Wife's Week (SMM/Content/Brand)

**Monday — Content Planning**
- Review content calendar for the week
- Prepare Canva assets for this week's posts
- Draft caption copy

**Tuesday — Production**
- Film/photograph content for upcoming posts (if new batch arrived: film unboxing, packaging)
- Edit Reel or TikTok video
- Schedule posts in Later/Buffer

**Wednesday — Publishing & Engagement**
- Publish any immediate content
- Reply to Instagram comments + DMs
- Check Pinterest analytics

**Thursday — Writing**
- Write or polish Atlas article draft
- Research next content topic
- Draft monthly newsletter

**Friday — Review & Plan**
- Review: which posts performed well this week?
- Discuss with Andriy: any product info needed for next content?
- Plan next week's calendar

**Ongoing — Instagram DMs**
- Check daily (15 min) for customer questions, collaboration offers
- Escalate order-related DMs to Andriy

### Monthly Rhythm

| Week | Activity |
|------|----------|
| Week 1 | Monthly newsletter sent; inventory review; green coffee order if needed |
| Week 2 | Coordinate roasting run (book slot with roaster) |
| Week 3 | Roasting pickup + packaging batch |
| Week 4 | Financial close with accountant; plan next month's product/content |

---

## 13. Key Metrics & Thresholds

### Business Health Metrics (Track Weekly)

| Metric | How to Measure | Phase 1 Target |
|--------|---------------|----------------|
| Monthly Revenue | Stripe dashboard | Growing toward €2,000–3,000 MRR |
| Active Subscriptions | Supabase / Stripe | 30+ after month 3 |
| Average Order Value | Stripe | €35–50 |
| Customer Acquisition Cost | Ad spend ÷ new customers | < €20 |
| Subscription churn rate | Cancellations ÷ active subs | < 10%/month |
| Gross Margin | (Revenue - COGS) ÷ Revenue | 55–70% |
| Inventory turnover | Units sold ÷ avg inventory | > 2× per month |
| Order fulfillment speed | Order placed → shipped | < 2 business days |

### Operational Red Flags

| Warning | Threshold | Action |
|---------|-----------|--------|
| Finished goods < reorder point | SKU-specific (see §6.3) | Start roasting run |
| Green coffee stock < 2 batches | SKU-specific | Order from Jakafe immediately |
| Failed payment rate | > 5% of renewals | Review Stripe dunning settings |
| Customer complaints | > 2 per week | Review last batch quality |
| Open CS tickets | > 5 unresolved | Prioritize support day |

---

## 14. Phase 2 Transition Triggers

### When to Get Your Own Roaster

**Trigger:** Sustained 80+ orders/month OR €3,000+ MRR for 2 consecutive months

**Recommended equipment:** Aillio Bullet R2 (~€3,700)
- Capacity: 1 kg per roast batch, ~10–15 batches/day = 10–15 kg/day
- Fits in a small rented space (150 × 150 cm footprint)
- App-controlled profiles: consistency and repeatability
- Community: large online community for profile sharing

**Phase 2 changes:**
- Green coffee: bulk forward buying (Algrano, Trabocca) at better prices
- Roast in-house: tighter control of flavor, faster turnaround, ~€3–5/kg cost saving
- Requires: additional HACCP documentation for roasting (separate from packing)
- EU EUDR compliance: prepare from 2026 — all coffee must have plot-level traceability by January 2027

### When to Hire First Employee

**Trigger:** Fulfillment exceeds 3–4 hours/day, or 150+ orders/month sustained

**First hire:** Part-time fulfillment assistant (packing/shipping)
- Frees Andriy for tech, sourcing, supplier relationships
- Can be student/part-time at minimum wage (Czech minimum wage 2026: ~18,900 CZK/month full-time)

### Scaling Shipping

**Trigger:** 200+ orders/month

- Negotiate direct contracts with Zásilkovna and DPD for volume pricing
- Potentially move to 3PL (third-party logistics) if fulfillment exceeds capacity
- Czech 3PLs: Rohlik Group B2B, ShipMonk, local warehousing companies

---

*Last updated: 2026-03-28*
*Next review: After first roasting run or first 10 customer orders — whichever comes first*
