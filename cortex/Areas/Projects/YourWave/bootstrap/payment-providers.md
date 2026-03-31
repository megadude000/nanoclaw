---
cortex_level: L10
confidence: high
domain: yourwave
scope: yourwave — payment-providers
type: bootstrap-extract
tags:
  - yourwave
  - bootstrap
  - core
created: '2026-03-31'
project: yourwave
source_hash: f3a4b46280a9df8fa19fa4ca3ccef961e46792aca06b3b27851c9030c7e509b5
embedding_model: text-embedding-3-small
---
# Payment Providers Research — YourWave Coffee E-Commerce

**Date:** 2026-03-23
**Market:** UK/EU, CZ-based S.R.O.
**Requirements:** Apple Pay, Google Pay, saved cards, one-tap checkout, multi-currency (CZK, EUR, PLN, NOK/SEK/DKK)

---

## 1. Stripe

### Overview
Global leader. Fully available in Czech Republic with CZ-specific pricing. Developer-first, massive ecosystem.

### Fees (CZ account)
- **Domestic EEA cards:** 1.5% + 6.50 CZK
- **Premium/corporate EEA cards:** 1.9% + 6.50 CZK
- **UK cards:** 2.5% + 6.50 CZK (post-Brexit treated as international)
- **Non-EEA international:** 3.25% + 6.50 CZK
- **Currency conversion:** +1% on international + 2% FX conversion
- **Monthly fees:** None
- **Setup fees:** None
- **Disputes:** ~$15 per chargeback

### Apple Pay / Google Pay
Fully supported, no additional fees — same rate as card transactions.

### Multi-Currency
Supports 135+ currencies. Adaptive Pricing uses ML to auto-detect and present local currency (2-4% conversion fee paid by customer). Can settle in multiple currencies. Rate locking for 24h available.

**Supported currencies for YourWave:** CZK, EUR, PLN, NOK, SEK, DKK — all natively supported.

### API / Supabase Integration
- Best-in-class developer experience. Official Supabase Stripe Sync Engine (one-click).
- Supabase Foreign Data Wrapper for Stripe data in Postgres.
- Multiple Next.js + Supabase + Stripe starter kits available.
- Stripe Elements / Payment Intents API for custom checkout.
- Webhooks for real-time event sync.
- SDKs: Node.js, Python, Ruby, Go, PHP, .NET, Java.

### PCI Compliance
Stripe handles PCI compliance — using Stripe Elements or Checkout means card data never touches your servers. SAQ-A level (simplest).

### Setup Complexity
**Low.** Sign up online, instant activation for most EU businesses. No contracts. Dashboard available immediately.

### Verdict
The gold standard for developer-friendly payments. Excellent CZ support, all required currencies, wallet payments, and the deepest Supabase integration ecosystem.

---

## 2. Comgate

### Overview
Czech-native payment gateway. Principal member of Visa/Mastercard. Regulated by Czech National Bank. Strong local bank transfer coverage.

### Fees
- **Start plan:** 0% for first 6 months (up to 50K CZK/month), then Easy plan kicks in
- **Easy plan:** Fixed percentage pricing (transparent, no MIF++ complexity)
- **Profi plan:** MIF++ pricing for higher volumes
- **3 months free promotion** on Easy/Profi for transactions up to 500K CZK
- **Price guarantee:** Fees locked until 31 December 2026
- **Monthly gateway fee:** Varies by plan (free during promotional periods)

### Apple Pay / Google Pay
Supported via Comgate Checkout SDK (embedded in-cart, no redirect needed). Note: From April 2026, Visa will add a 0.05% Token Facilitation Fee for Apple/Google Pay e-commerce.

### Multi-Currency
Supports 9 currencies: **CZK, EUR, PLN, HUF, USD, GBP, RON, NOK, SEK.**
Missing: DKK (not listed).

**Supported for YourWave:** CZK, EUR, PLN, NOK, SEK — yes. DKK — not listed.

### API / Supabase Integration
- REST API with JSON/XML. Authentication via Basic Auth + IP whitelist.
- Postman collection available. Code samples in cURL, PHP, Java, Python.
- No official Supabase integration — would need custom webhook handler.
- `comgate-node` npm package available (community).
- Documentation quality: adequate but not as polished as Stripe.

### PCI Compliance
Comgate holds PCI DSS top-level certification. They handle card data — merchant doesn't need PCI if using hosted checkout or SDK.

### Setup Complexity
**Low-Medium.** Czech-focused onboarding. IP whitelist requirement adds friction. Dashboard in Czech primarily. Good for CZ-first businesses.

### Verdict
Excellent for CZ domestic market with competitive pricing and strong local bank support. The 6-month free period is attractive for a startup. Weaker on international reach and developer experience compared to Stripe.

---

## 3. GoPay

### Overview
Largest Czech-origin online payment provider. 11,000+ merchants. PCI DSS Level 1. Supports 80+ features.

### Fees
- **Pricing:** Tailored per merchant (not publicly transparent)
- **12 months free** for new-to-card merchants (up to 50K CZK/month)
- **No setup fees** advertised
- **Chargebacks, refunds, administration:** additional fees (merchant-specific)

### Apple Pay / Google Pay
Both supported through card rails.

### Multi-Currency
8 currencies: **CZK, EUR, USD, GBP, PLN, HUF, RON, BGN.**
Missing: NOK, SEK, DKK — critical gap for Nordic markets.

**Supported for YourWave:** CZK, EUR, PLN — yes. NOK, SEK, DKK — NO.

### API / Supabase Integration
- REST API with inline, redirect, and mobile checkout variants.
- SDKs and plugins for WooCommerce, PrestaShop, Shoptet, Shopify.
- No Supabase integration — would need custom implementation.
- Documentation available but less developer-focused than Stripe.

### PCI Compliance
PCI DSS Level 1 compliant. 3D Secure 2.0 supported.

### Setup Complexity
**Medium.** Czech-oriented onboarding. Pricing requires negotiation.

### CRITICAL WARNING
GoPay's e-money institution authorization was **revoked by the Czech National Bank on 16 April 2025**. This is a significant regulatory red flag. Their current operating status needs verification before any integration decision.

### Verdict
Cannot recommend until regulatory status is clarified. Missing Nordic currencies. Non-transparent pricing. The CNB license revocation is a dealbreaker until resolved.

---

## 4. Adyen

### Overview
Enterprise-grade global payment platform. Interchange++ pricing. 150+ currencies, 250+ payment methods, 45+ acquiring markets.

### Fees
- **Pricing model:** Interchange++ (transparent, but complex)
- **Processing fee:** ~€0.11 fixed + payment method fee (~0.60%+)
- **EEA debit interchange cap:** 0.2%
- **EEA credit interchange cap:** 0.3%
- **Estimated total domestic EEA:** ~0.5-1.0% per transaction
- **Chargebacks:** €25 per dispute
- **Monthly fees:** None stated (but enterprise onboarding)
- **Setup fees:** None stated
- **Amex:** 3.95%

### Apple Pay / Google Pay
Fully supported across all markets.

### Multi-Currency
150+ currencies. Multi-currency settlement. Can link multiple bank accounts in different currencies.

**Supported for YourWave:** All currencies supported — CZK, EUR, PLN, NOK, SEK, DKK.

### API / Supabase Integration
- Comprehensive REST API. Well-documented.
- Drop-in UI components and custom integration options.
- No native Supabase integration — custom webhook setup required.
- Excellent documentation and sandbox environment.

### PCI Compliance
Adyen handles full PCI compliance. SAQ-A with their hosted payment forms.

### Setup Complexity
**High.** Enterprise-oriented onboarding. May have minimum volume requirements. Integration is more complex. Not designed for small startups.

### Verdict
Overkill for a coffee e-commerce startup. Best-in-class for enterprise, but the complexity, onboarding process, and enterprise orientation make it impractical at the early stage. Good migration target if YourWave scales significantly.

---

## 5. Mollie

### Overview
Amsterdam-based, EU-focused. 130,000+ businesses. Recently launched localized services in Czechia. Authorized by De Nederlandsche Bank.

### Fees
- **EEA consumer credit cards:** 1.80% + €0.25 to 2.90% + €0.25
- **UK consumer cards:** 1.20% + £0.20
- **UK business/EU cards:** 2.90% + £0.20
- **Non-EU cards:** 3.25% + £0.20
- **FX conversion:** 2.5-3% markup
- **Monthly fees:** None
- **Setup fees:** None
- **Refunds:** Original fee not returned + refund processing fee

### Apple Pay / Google Pay
Both supported. 25+ payment methods including SEPA, Klarna, PayPal.

### Multi-Currency
Payouts in: EUR, GBP, USD, CHF, DKK, NOK, SEK, PLN (+ AUD, CAD optional).
Accepts CZK for charging customers but payout in CZK is not confirmed as a standard option — may auto-convert to primary currency.

**Supported for YourWave:** EUR, PLN, NOK, SEK, DKK — yes for payouts. CZK — can accept but payout may require conversion.

### API / Supabase Integration
- Clean REST API. Well-documented.
- Official plugins for Shopify, WooCommerce, Magento, PrestaShop.
- No native Supabase integration — custom implementation needed.
- API is clean and straightforward but less extensive than Stripe.

### PCI Compliance
Mollie handles PCI compliance. Hosted checkout / components approach.

### Setup Complexity
**Low.** Online signup, fast onboarding. Czech localization recently added. Czech support team being built.

### Verdict
Strong EU alternative. Good for multi-currency with Nordic support. The recent Czech market entry is positive but the ecosystem is less mature than Stripe. CZK payout handling needs verification. Higher base transaction fees than Stripe for EEA cards.

---

## Comparison Matrix

| Feature | Stripe | Comgate | GoPay | Adyen | Mollie |
|---------|--------|---------|-------|-------|--------|
| **EEA card fee** | 1.5% + 6.50 CZK | ~1% (Start) | Negotiated | ~0.5-1.0% (IC++) | 1.8-2.9% + €0.25 |
| **Monthly fee** | None | Varies | Varies | None | None |
| **Setup fee** | None | None | None | None | None |
| **Apple Pay** | Yes | Yes (SDK) | Yes | Yes | Yes |
| **Google Pay** | Yes | Yes (SDK) | Yes | Yes | Yes |
| **CZK** | Yes | Yes | Yes | Yes | Accept yes, payout TBC |
| **EUR** | Yes | Yes | Yes | Yes | Yes |
| **PLN** | Yes | Yes | Yes | Yes | Yes |
| **NOK** | Yes | Yes | No | Yes | Yes |
| **SEK** | Yes | Yes | No | Yes | Yes |
| **DKK** | Yes | No | No | Yes | Yes |
| **Supabase integration** | Native (Sync Engine, FDW) | Custom only | Custom only | Custom only | Custom only |
| **API quality** | Excellent | Good | Good | Excellent | Very Good |
| **PCI approach** | SAQ-A (Elements) | Hosted/SDK | Hosted | Hosted | Hosted |
| **CZ S.R.O. support** | Yes | Yes (native) | Uncertain (license revoked) | Yes | Yes (new) |
| **Setup complexity** | Low | Low-Medium | Medium | High | Low |
| **Starter-friendly** | Yes | Yes | No | No | Yes |

---

## Recommendation

### Primary: Stripe

**Start with Stripe.** The reasoning:

1. **Best developer experience** — unmatched API quality, documentation, and Supabase integration (official Sync Engine, Foreign Data Wrapper, starter kits). This directly reduces development time and cost.

2. **Complete currency coverage** — all 6 required currencies (CZK, EUR, PLN, NOK, SEK, DKK) with native multi-currency settlement. No gaps.

3. **Wallet payments included** — Apple Pay and Google Pay at no extra cost, same card rate. Stripe Elements provides one-tap checkout with saved cards (Link).

4. **CZ-native pricing** — 1.5% + 6.50 CZK for domestic EEA cards is competitive. No monthly fees, no setup fees, no contracts. Pay-as-you-go is perfect for a startup.

5. **Regulatory confidence** — Stripe is a well-regulated, globally trusted platform. No regulatory concerns like GoPay's license revocation.

6. **Scale path** — volume discounts available as you grow. No migration needed.

### Secondary consideration: Comgate

Keep Comgate as a potential **supplementary gateway** for Czech domestic payments if you find that local bank transfers (which Comgate handles exceptionally well) drive significant volume. The 6-month free period is attractive. However, the missing DKK support and weaker developer tooling make it unsuitable as a primary.

### Not recommended for now:
- **GoPay** — License revocation by CNB is a critical risk. Missing Nordic currencies.
- **Adyen** — Enterprise complexity is unnecessary overhead at startup stage. Revisit if processing >€1M/year.
- **Mollie** — Higher fees than Stripe for EEA cards. CZK payout handling uncertain. Less mature Czech presence. Could be a backup option.

### Implementation approach:
1. Register Stripe CZ account (instant, free)
2. Integrate Stripe Elements + Payment Intents API
3. Enable Apple Pay + Google Pay (configuration only, no extra code)
4. Set up Supabase Stripe Sync Engine for order/payment data sync
5. Configure multi-currency pricing for CZK, EUR, PLN, NOK, SEK, DKK
6. Use Stripe Adaptive Pricing for automatic currency detection

---

## Sources
- [Stripe CZ Pricing](https://stripe.com/en-cz/pricing)
- [Stripe Payments Features](https://stripe.com/en-cz/payments/features)
- [Stripe Apple Pay](https://docs.stripe.com/apple-pay)
- [Stripe Adaptive Pricing](https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing)
- [Supabase Stripe Sync Engine](https://supabase.com/blog/stripe-sync-engine-integration)
- [Comgate Pricing](https://www.comgate.eu/online-payments-pricing)
- [Comgate Currencies](https://help.comgate.cz/docs/en/currencies-and-languages)
- [Comgate API](https://apidoc.comgate.cz/en/api/rest/)
- [GoPay](https://www.gopay.com/en/)
- [GoPay Payment Methods](https://help.gopay.com/en/knowledge-base/payment-gateway/payment-methods/list-of-payment-methods-for-cz-market)
- [Adyen Pricing](https://www.adyen.com/pricing)
- [Adyen Review 2026](https://blog.finexer.com/adyen-pricing/)
- [Mollie Pricing](https://www.mollie.com/pricing)
- [Mollie Czech Launch](https://www.mollie.com/gb/news/mollie-launches-czechia)
- [Mollie Apple Pay Docs](https://docs.mollie.com/docs/applepay)
