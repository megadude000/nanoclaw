# Shipping & Delivery Providers Research

> **Project:** YourWave (Coffee E-commerce)
> **Scope:** CZ origin, EU-wide delivery
> **Date:** 2026-03-23
> **Status:** Research complete

---

## Requirements Recap

- Customer chooses provider at checkout
- Auto price calculation by destination address
- Free shipping threshold support
- 2-5 day EU delivery target
- Unified Integration Hub module (abstraction layer)

---

## 1. Zasilkovna / Packeta

**Best for:** Pickup point delivery across CZ + EU. Dominant in Czech e-commerce.

### Coverage
- 160,000+ pickup points across Europe (CZ, SK, HU, RO, PL, DE, SI strongest)
- Delivers to 32+ European countries + USA, UAE
- Partners with FoxPost, InPost, Mondial Relay, DPD, Correos, Royal Mail, Evri, Omniva, etc.

### API
- **Type:** SOAP + REST API (full docs at [docs.packeta.com](https://docs.packeta.com))
- **GitHub:** [github.com/Packeta/api-documentation](https://github.com/Packeta/api-documentation)
- **Key endpoints:**
  - `createPacket` — create shipment in Packeta system
  - `packetLabelPdf` — generate label (internal pickup points)
  - `packetCourierNumber` — order with external courier
  - `packetCourierLabelPdf` — label for external courier delivery
  - `packetCourierTracking` — tracking via courier
- **Pickup point widget:** Embeddable JS widget (v6) for checkout — customer selects point on map
- **Sandbox:** Available via integration team (integrations@packeta.com)
- **Quality:** Good documentation, active GitHub repo, dedicated integration support

### Pricing (CZ)
- Pickup point delivery: ~89 CZK (retail), negotiable for e-commerce
- Home delivery: additional surcharge
- Auto-valuation: 300 CZK (pickup) / 10,000 CZK (address) included
- COD: available (SK: +1.30 EUR)
- Fuel surcharge: 12.5% (as of Mar 2026)
- Toll surcharge: 1.10 CZK/kg
- **EU pricing:** Individual quotes based on volume — contact sales

### Limits
- Max weight: 10 kg (parcels over 10 kg returned to sender)
- Max dimensions: 120 cm sum (or 150 cm extended)
- No multi-package shipments natively

### Tracking & Returns
- Full tracking via API + customer SMS/email notifications
- Returns supported via pickup point network

### Verdict
Top choice for CZ + EU pickup point delivery. The 10 kg limit is fine for coffee. Widget integration is excellent for checkout UX. EU coverage is unmatched via partner network. Individual e-commerce pricing needed.

---

## 2. PPL (DHL Company)

**Best for:** Heavier parcels, home delivery in CZ, DHL network for EU.

### Coverage
- CZ domestic: 6,500+ pickup points + parcel boxes
- EU: Parcel Smart Europe — pickup delivery in PL, DE, SK
- COD available to SK, PL, HU, RO
- International via DHL network (230+ countries)

### API
- **Type:** REST API via "My DPD API" / integration partners
- **Docs:** [ppl.cz/en/integrators](https://www.ppl.cz/en/integrators)
- **Sandbox:** Available (contact CISteam@ppl.cz)
- **Platform plugins:** WooCommerce, PrestaShop (free), Baselinker, Globe Pickup Points (Shopify)
- **Quality:** Less developer-friendly than Packeta. Relies heavily on integration partners. Contact sales for API credentials.

### Pricing (CZ)
- From 76 CZK (pickup point, small parcel)
- Home delivery competitively priced
- International: individual pricing based on volume
- Max weight: 31.5 kg (best in class, no surcharge)
- Max dimensions: 100 x 50 x 50 cm

### Tracking & Returns
- Full Track & Trace
- SMS/email notifications with 1-hour delivery window (CZ + EU)
- Returns supported

### Verdict
Strong choice for home delivery and heavier orders. DHL backbone gives EU reach. API is less polished — consider using via aggregator (Balikoboti / Shippo). The 31.5 kg limit is overkill for coffee but good for bulk orders.

---

## 3. DPD Czech Republic

**Best for:** Largest pickup network in CZ, fast delivery, cross-border EU.

### Coverage
- CZ: 14,000+ pickup points and lockers (largest network as of 2025)
- Includes OX Point, One By Allegro, Z-BOX (Packeta), GLS Parcel Boxes
- EU-wide delivery to 230 countries
- Cross-border pickup point selection via widget

### API
- **Type:** REST API ("My DPD API")
- **Pickup widget:** iframe with cross-border parameter (`crossboarder=1` for EU-wide points)
- **Country presets:** `?countries=CZ&countries=SK` in widget URL
- **Pickup list:** Downloadable as JSON, XML, or CSV (recommended daily update)
- **Platform plugins:** Odoo (v17), AfterShip, TrackingMore, TrackShip (WooCommerce/Shopify)
- **Quality:** Decent API. Widget is practical for multi-country checkout.

### Pricing (CZ)
- Pickup point: from 68 CZK (cheapest among major carriers for small parcels)
- Home delivery: from 89 CZK + 40 CZK home surcharge
- 15 kg parcel: 149 CZK
- Insurance: 50,000 CZK included
- Next business day guaranteed (CZ domestic)
- 4 size variants available

### Tracking & Returns
- SMS/email with 1-hour delivery window
- Full tracking API
- Returns via DPD pickup network

### Verdict
Most competitive on price for CZ domestic. Largest pickup network. Cross-border widget is a plus. Good all-rounder but less dominant in EU-wide coverage compared to Packeta's partner network.

---

## 4. FedEx

**Best for:** Premium international shipping, express delivery, non-EU destinations.

### Coverage
- Global: 220+ countries
- EU: FedEx International Connect Plus (FICP) for cost-effective EU shipping
- Express Domestic services for intra-EU
- "Simplified Commodity Shipping" for goods in free circulation within EU

### API
- **Type:** RESTful API via [developer.fedex.com](https://developer.fedex.com)
- **Key APIs:**
  - Ship API — create shipments, labels
  - Rates and Transit Times API — real-time rate calculation with discounts/surcharges
  - Track API — shipment tracking
- **Quality:** Excellent developer portal, comprehensive docs, well-structured REST endpoints
- **Sandbox:** Full test environment available
- **Pricing for API:** Free trial (30 days), then subscription-based for tracking volume

### Pricing
- Premium tier — significantly more expensive than CZ domestic carriers
- FICP: contractual service, pricing competitive vs. FedEx International Priority
- Account-specific rates via Rates API (discounts based on volume)
- No public price list — must have FedEx account

### Tracking & Returns
- Industry-leading tracking with webhooks (Advanced Integrated Visibility)
- Full returns management

### Verdict
Overkill for standard CZ-EU coffee delivery. Reserve for express/premium shipping tier or non-EU destinations. API quality is best-in-class. Cost prohibitive as default carrier. Consider as premium upsell option at checkout.

---

## 5. Balikovna (Ceska posta)

**Best for:** Cheapest CZ domestic option, massive post office network.

### Coverage
- CZ only (no EU delivery)
- 3,000 post offices + 4,000 external pickup points + ~3,000 self-service boxes
- Total: ~10,000 delivery points in CZ

### API
- **Type:** B2BZasilka REST API + nPOL (new Podani Online)
- **2025 changes:** "Balik Na postu" discontinued Jan 1, 2025 — replaced by Balikovna / Balikovna Plus
- **Submission:** Electronic only (API or nPOL)
- **Platform plugins:** WooCommerce (Toret plugin), PrestaShop (CSV + API), OpenCart, Shopify (Digismoothie)
- **Quality:** API modernized in 2025. Less polished than Packeta but functional.

### Pricing (CZ)
- From 75 CZK (pickup point, small parcel) — second cheapest after DPD
- Best value considering network size + reliability
- Weight limits competitive

### Tracking & Returns
- Full tracking via API
- Returns via post office network

### Verdict
Must-have for budget-conscious CZ customers. Largest physical network (post offices everywhere). No EU capability — pair with another carrier for international. The 2025 API modernization makes integration reasonable.

---

## 6. Unified API Aggregators

### Shippo
- **Carriers:** 85+ globally, including European carriers
- **Pricing:** Pay-as-you-go, no monthly fees
- **Strengths:** Balance of UI dashboard + REST API, pre-negotiated rates, branded tracking pages
- **Weaknesses:** Limited batch handling, automation depth at scale
- **CZ carriers:** FedEx, DHL/PPL supported. Packeta via ShipEngine. Limited direct CZ carrier support.
- **Docs:** [docs.goshippo.com](https://docs.goshippo.com)

### EasyPost
- **Carriers:** 100+ carriers
- **Pricing:** Monthly fee + per-shipment, free tier available
- **Strengths:** Developer-first, automatic cheapest-carrier selection, address verification
- **Weaknesses:** Less transparent pricing, weaker customer support, limited EU-specific carrier coverage
- **CZ carriers:** Major internationals only (FedEx, DHL, UPS). No Packeta/PPL/DPD CZ.

### Balikoboti (Czech-specific aggregator)
- **Carriers:** PPL, DPD, GLS, Ceska posta, Zasilkovna, and more Czech carriers
- **Type:** REST API (v2) — [balikobotv2eng.docs.apiary.io](https://balikobotv2eng.docs.apiary.io)
- **Strengths:** Purpose-built for Czech market, single API for all CZ carriers
- **Weaknesses:** CZ/SK focused, less international coverage

### Packeta as Hub
- Packeta itself acts as an aggregator — routes through partner carriers (InPost, Mondial Relay, DPD, etc.) across EU
- Single API integration covers 160,000+ points in 32+ countries
- Best option if pickup-point delivery is the primary EU strategy

### Recommendation
**For CZ carriers:** Use Balikoboti API as the aggregator — it covers PPL, DPD, GLS, Ceska posta, and Zasilkovna in one API.
**For EU pickup points:** Use Packeta API directly — it already aggregates EU-wide delivery via partner carriers.
**For premium international:** Use FedEx API directly.
**Skip Shippo/EasyPost** — they lack direct support for Czech carriers, adding complexity without benefit.

---

## 7. Integration Hub Architecture

### Recommended Pattern: Carrier Abstraction Layer

```
[Checkout UI]
     |
     v
[Shipping Integration Hub]
     |
     +-- CarrierAdapter (interface)
     |       |
     |       +-- PacketaAdapter    --> Packeta REST API (CZ pickup + EU-wide)
     |       +-- BalikobotAdapter  --> Balikobot API (PPL, DPD, Balikovna, GLS)
     |       +-- FedExAdapter      --> FedEx REST API (premium international)
     |
     +-- RateCalculator
     |       |
     |       +-- Queries all adapters for rates by destination
     |       +-- Applies free shipping threshold logic
     |       +-- Returns sorted options to checkout
     |
     +-- ShipmentManager
     |       |
     |       +-- Creates shipment via selected adapter
     |       +-- Generates labels
     |       +-- Stores tracking numbers
     |
     +-- TrackingHub
             |
             +-- Polls/webhooks from all carriers
             +-- Unified status enum: CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RETURNED
             +-- Pushes updates to order system
```

### Key Design Decisions

1. **CarrierAdapter Interface:**
   - `getRates(origin, destination, weight, dimensions) -> Rate[]`
   - `createShipment(order, carrier, service) -> Shipment`
   - `getLabel(shipmentId) -> PDF`
   - `getTracking(shipmentId) -> TrackingEvent[]`
   - `cancelShipment(shipmentId) -> boolean`

2. **Rate Calculation Flow:**
   - Customer enters address at checkout
   - Hub queries all relevant adapters in parallel
   - Each adapter returns available services + prices
   - Hub applies business rules (free shipping threshold, markup, restrictions)
   - Returns sorted list to frontend

3. **Free Shipping Threshold:**
   - Configurable per carrier + destination zone
   - Example: Free Packeta CZ pickup over 800 CZK, Free EU over 1500 CZK
   - Stored in config, applied in RateCalculator

4. **Carrier Selection at Checkout:**
   - Show carrier options grouped: "Pickup Point" vs "Home Delivery" vs "Express"
   - For pickup: embed Packeta widget or DPD iframe
   - For home delivery: show PPL/DPD options with price
   - For express: FedEx with premium pricing

5. **Minimal Integration Count:**
   - Packeta API (1 integration) = CZ pickup + EU-wide pickup via partners
   - Balikobot API (1 integration) = PPL + DPD + Balikovna + GLS domestic
   - FedEx API (1 integration) = Premium international
   - **Total: 3 API integrations cover all requirements**

### Technology Considerations

- **Balikobot** is the linchpin — it unifies all Czech domestic carriers behind one API, eliminating the need to integrate PPL, DPD, and Balikovna separately
- **Packeta** doubles as both a carrier and an EU aggregator — its partner network means one integration covers EU-wide pickup delivery
- **FedEx** is optional at launch — can be added later for premium tier
- Consider caching carrier rate responses (TTL: 15-30 min) to reduce API calls
- Implement circuit breakers per adapter — if one carrier API is down, others still work

---

## Provider Comparison Matrix

| Provider | CZ Pickup | CZ Home | EU Pickup | EU Home | API Quality | Min Price (CZ) | Max Weight | COD |
|----------|-----------|---------|-----------|---------|-------------|----------------|------------|-----|
| Packeta/Zasilkovna | 160K+ points | Yes (via courier) | 32+ countries | Via partners | Good (REST+SOAP) | ~89 CZK | 10 kg | Yes |
| PPL (DHL) | 6,500+ | Yes | PL,DE,SK | Via DHL | Medium | ~76 CZK | 31.5 kg | Yes (SK,PL,HU,RO) |
| DPD CZ | 14,000+ | Yes | 230 countries | Yes | Good | ~68 CZK | 15 kg (standard) | Yes |
| FedEx | No | Yes | Global | Yes | Excellent | Premium | 68 kg | No |
| Balikovna | 10,000+ | Via post | CZ only | CZ only | Medium | ~75 CZK | Competitive | Yes |

---

## Recommended Implementation Order

### Phase 1 (MVP)
1. **Packeta** — CZ pickup points + EU pickup via partner network
2. **Balikovna** (via Balikobot) — cheapest CZ option for budget customers

### Phase 2
3. **PPL + DPD** (via Balikobot) — CZ home delivery options
4. Free shipping threshold logic
5. Carrier selection UI at checkout

### Phase 3
6. **FedEx** — premium/express international tier
7. Advanced tracking hub with unified status
8. Returns management

---

## Key Links

- Packeta API Docs: https://docs.packeta.com
- Packeta GitHub: https://github.com/Packeta/api-documentation
- PPL Integration: https://www.ppl.cz/en/integrators
- DPD ParcelShop Widget: https://pickup.dpd.cz/integrace/en/
- FedEx Developer Portal: https://developer.fedex.com
- Balikobot API v2: https://balikobotv2eng.docs.apiary.io
- Zasilkovna Pricing: https://www.zasilkovna.cz/en/pricing
- Multiship Price Comparison: https://multiship.cz
