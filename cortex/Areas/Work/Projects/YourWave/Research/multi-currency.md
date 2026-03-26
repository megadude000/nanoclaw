# Multi-Currency Architecture Research

**Date:** 2026-03-23
**Context:** CZ-based company (YourWave) selling EU-wide via Supabase + Astro stack
**Currencies:** CZK, EUR, PLN, NOK, SEK, DKK

---

## 1. How Shopify Handles Multi-Currency (Shopify Markets)

Shopify uses a **single-store, multi-market model** — one product catalog, multiple market configurations.

### Key architectural decisions:
- **Geolocation-based detection**: Shopify detects visitor location and auto-shows local currency
- **Automatic conversion**: Product prices, shipping, and discounts convert to customer's currency
- **Rounding rules**: After conversion, prices are rounded to "clean" numbers (e.g., .99 endings)
- **Payout in base currency**: Merchant always receives payouts in their store's default currency
- **URL architecture**: Each market gets a URL path (e.g., `/en-cz`, `/de-de`) with auto-generated hreflang tags
- **Exchange rates**: Auto-updated from third-party providers, or merchants can set manual rates
- **All-in-one checkout**: Currency stays consistent from product page through checkout

### Takeaway for YourWave:
Shopify's model works because they own the entire stack. For a custom build, the key pattern to replicate is: **detect locale → show local price → lock currency at checkout → settle in base currency**.

---

## 2. Database Schema: Prices Per Currency vs Base + Conversion

### Approach A: Base Currency + Real-Time Conversion
```
products
  id, name, price_czk (base), ...

exchange_rates
  from_currency, to_currency, rate, fetched_at
```

**Pros:** Simple schema, one price to manage per product, always "current"
**Cons:** Prices fluctuate with exchange rates, no control over per-market pricing, conversion at query time

### Approach B: Explicit Prices Per Currency
```
products
  id, name, ...

product_prices
  product_id, currency_code, amount, is_manual, updated_at
```

**Pros:** Full control over each market's pricing, PPP adjustments possible, pre-computed (fast reads)
**Cons:** More complex to manage, N prices per product (6 currencies = 6 rows per product)

### Approach C: Hybrid (RECOMMENDED for YourWave)
```
products
  id, name, base_price_czk, ...

product_prices
  product_id, currency_code, amount, is_manual, updated_at

exchange_rates
  base_currency, target_currency, rate, source, fetched_at
```

**How it works:**
1. Every product has a `base_price_czk` (source of truth)
2. A nightly/hourly job auto-generates `product_prices` rows for all 6 currencies
3. Merchant can override any price manually (`is_manual = true`), which skips auto-conversion
4. At checkout, the price is locked from `product_prices` — no real-time conversion needed

### Critical data type rules:
- **Store amounts as integers** in smallest unit (e.g., 29990 = 299.90 CZK) to avoid floating-point errors
- Use `BIGINT` or `NUMERIC(12,0)` for amounts
- Store ISO 4217 currency codes (`CZK`, `EUR`, etc.)
- Keep historical exchange rates for auditing and order reconciliation

### Recommended Schema (Supabase/PostgreSQL):

```sql
-- Currencies reference table
CREATE TABLE currencies (
    code CHAR(3) PRIMARY KEY,        -- ISO 4217: CZK, EUR, PLN, NOK, SEK, DKK
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,             -- Kč, €, zł, kr, kr, kr
    decimal_places SMALLINT DEFAULT 2,
    is_active BOOLEAN DEFAULT true
);

-- Exchange rates (historical)
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency CHAR(3) REFERENCES currencies(code) DEFAULT 'CZK',
    target_currency CHAR(3) REFERENCES currencies(code),
    rate NUMERIC(12, 6) NOT NULL,     -- e.g., 0.040816 (1 CZK = 0.04 EUR)
    source TEXT DEFAULT 'ecb',        -- ecb, manual
    fetched_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(base_currency, target_currency, fetched_at)
);
CREATE INDEX idx_rates_latest ON exchange_rates(base_currency, target_currency, fetched_at DESC);

-- Products with base price
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    base_price_amount BIGINT NOT NULL,  -- in smallest unit (hellers for CZK)
    base_currency CHAR(3) DEFAULT 'CZK' REFERENCES currencies(code),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-currency prices (auto-generated + manual overrides)
CREATE TABLE product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    currency_code CHAR(3) REFERENCES currencies(code),
    amount BIGINT NOT NULL,             -- in smallest unit
    is_manual BOOLEAN DEFAULT false,    -- true = merchant override
    exchange_rate_used NUMERIC(12, 6),  -- rate at time of calculation
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, currency_code)
);
CREATE INDEX idx_prices_product ON product_prices(product_id);
CREATE INDEX idx_prices_currency ON product_prices(currency_code);

-- Orders lock the currency and amount at checkout time
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    currency_code CHAR(3) REFERENCES currencies(code),
    total_amount BIGINT NOT NULL,          -- in customer's currency smallest unit
    total_amount_base BIGINT NOT NULL,     -- converted to CZK for accounting
    exchange_rate_at_order NUMERIC(12, 6), -- locked rate
    vat_rate NUMERIC(5, 2),               -- customer country VAT %
    vat_amount BIGINT NOT NULL,           -- VAT in customer currency
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Order items also lock per-item prices
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL,           -- locked price in order currency
    currency_code CHAR(3) REFERENCES currencies(code)
);
```

---

## 3. Exchange Rate APIs

### Recommended: ECB via Frankfurter API

| API | Free Tier | Currencies | Key Feature | Limitation |
|-----|-----------|-----------|-------------|------------|
| **ECB / Frankfurter** | Unlimited, no API key | ~33 (all YW needs) | EUR-based, fully free, historical data | Updates once daily (~16:00 CET) |
| **Fixer.io** | 100 req/month | 170+ | Wide coverage | No HTTPS on free tier |
| **Open Exchange Rates** | 1000 req/month | 170+ | Smoothed "blended" rates | USD-only base on free tier |
| **ExchangeRate-API** | 1500 req/month | 161 | Simple REST | Rate-limited |

### Why ECB/Frankfurter is ideal for YourWave:
1. **EUR is the natural base** — CZ trades mostly in EUR, and all target currencies (CZK, PLN, NOK, SEK, DKK) are published by ECB
2. **Completely free** — no API key, no rate limits, no HTTPS restrictions
3. **Reliable source** — it's the European Central Bank, not a startup
4. **Historical data** — free access to historical rates for auditing
5. **Daily updates are sufficient** — for e-commerce, daily rate updates are fine; you're not doing forex trading

### Implementation pattern:
```javascript
// Supabase Edge Function or cron job
const response = await fetch('https://api.frankfurter.app/latest?from=CZK&to=EUR,PLN,NOK,SEK,DKK');
const data = await response.json();
// data.rates = { EUR: 0.0408, PLN: 0.1715, NOK: 0.4583, SEK: 0.4437, DKK: 0.3045 }

// Store in exchange_rates table
for (const [currency, rate] of Object.entries(data.rates)) {
    await supabase.from('exchange_rates').insert({
        base_currency: 'CZK',
        target_currency: currency,
        rate: rate,
        source: 'ecb'
    });
}

// Then recalculate product_prices where is_manual = false
```

### Fallback strategy:
- Primary: ECB/Frankfurter (daily cron at 17:00 CET, after ECB publishes)
- Fallback: Cache last known rates, use them for up to 72 hours
- Alert: If rates are >24h stale, flag for manual review

---

## 4. Supabase Patterns

### Market-Based RLS

For YourWave's use case, RLS isn't strictly needed for currency isolation (prices are public). However, if you want admin controls per market:

```sql
-- Markets table
CREATE TABLE markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code CHAR(2) NOT NULL UNIQUE,     -- CZ, DE, PL, NO, SE, DK
    name TEXT NOT NULL,
    default_currency CHAR(3) REFERENCES currencies(code),
    vat_rate NUMERIC(5, 2) NOT NULL,  -- standard VAT rate
    is_active BOOLEAN DEFAULT true
);

-- Insert EU markets
INSERT INTO markets (code, name, default_currency, vat_rate) VALUES
    ('CZ', 'Czech Republic', 'CZK', 21.00),
    ('DE', 'Germany', 'EUR', 19.00),
    ('AT', 'Austria', 'EUR', 20.00),
    ('PL', 'Poland', 'PLN', 23.00),
    ('NO', 'Norway', 'NOK', 25.00),
    ('SE', 'Sweden', 'SEK', 25.00),
    ('DK', 'Denmark', 'DKK', 25.00);
```

### RLS for orders (users see only their own):
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own orders"
ON orders FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users create own orders"
ON orders FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
```

### Supabase Edge Function for price calculation:
Use a Supabase Edge Function (Deno) to:
1. Detect user's market from IP/locale/preference
2. Fetch product prices in the appropriate currency
3. Return formatted prices

### Supabase Realtime for rate updates:
When exchange rates update, use Supabase Realtime to push updated prices to connected clients (optional, nice UX).

---

## 5. Frontend: Intl.NumberFormat & Locale Detection

### Currency formatting utility:
```typescript
// lib/currency.ts

const LOCALE_MAP: Record<string, string> = {
    CZK: 'cs-CZ',
    EUR: 'de-DE',  // or detect from country
    PLN: 'pl-PL',
    NOK: 'nb-NO',
    SEK: 'sv-SE',
    DKK: 'da-DK',
};

// Cache formatters for performance (significant when formatting lists)
const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatPrice(amountInSmallestUnit: number, currencyCode: string): string {
    const key = currencyCode;
    if (!formatterCache.has(key)) {
        const locale = LOCALE_MAP[currencyCode] || 'en-US';
        formatterCache.set(key, new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
        }));
    }
    const formatter = formatterCache.get(key)!;
    const decimalPlaces = currencyCode === 'JPY' ? 0 : 2;
    return formatter.format(amountInSmallestUnit / Math.pow(10, decimalPlaces));
}

// Examples:
// formatPrice(29990, 'CZK') → "299,90 Kč"
// formatPrice(1199, 'EUR')  → "11,99 €"
// formatPrice(4999, 'PLN')  → "49,99 zł"
// formatPrice(9900, 'NOK')  → "99,00 kr"
```

### Locale/currency detection strategy:

```typescript
// lib/detect-market.ts

interface Market {
    countryCode: string;
    currencyCode: string;
    locale: string;
}

export function detectMarket(request: Request): Market {
    // Priority 1: User's explicit preference (cookie/localStorage)
    const savedCurrency = getCookie(request, 'preferred_currency');
    if (savedCurrency) {
        return getMarketByCurrency(savedCurrency);
    }

    // Priority 2: Accept-Language header
    const acceptLang = request.headers.get('accept-language') || '';
    const primaryLang = acceptLang.split(',')[0]?.trim(); // e.g., "cs-CZ"

    // Priority 3: Cloudflare/Vercel geo headers
    const country = request.headers.get('cf-ipcountry')
                 || request.headers.get('x-vercel-ip-country')
                 || '';

    // Map country to currency
    const COUNTRY_CURRENCY: Record<string, string> = {
        CZ: 'CZK',
        SK: 'EUR', // Slovakia uses EUR
        DE: 'EUR',
        AT: 'EUR',
        FR: 'EUR',
        NL: 'EUR',
        PL: 'PLN',
        NO: 'NOK',
        SE: 'SEK',
        DK: 'DKK',
    };

    const currencyCode = COUNTRY_CURRENCY[country] || 'EUR'; // default to EUR

    return {
        countryCode: country,
        currencyCode,
        locale: primaryLang || 'en',
    };
}
```

### Astro integration pattern:
```astro
---
// src/pages/products/[slug].astro
import { detectMarket } from '@/lib/detect-market';
import { formatPrice } from '@/lib/currency';
import { supabase } from '@/lib/supabase';

const market = detectMarket(Astro.request);

const { data: product } = await supabase
    .from('products')
    .select('*, product_prices(*)')
    .eq('slug', Astro.params.slug)
    .single();

const price = product.product_prices.find(
    (p) => p.currency_code === market.currencyCode
);
---

<p class="price">{formatPrice(price.amount, price.currency_code)}</p>

<!-- Currency selector for manual override -->
<select id="currency-selector">
    <option value="CZK" selected={market.currencyCode === 'CZK'}>CZK (Kč)</option>
    <option value="EUR" selected={market.currencyCode === 'EUR'}>EUR (€)</option>
    <option value="PLN" selected={market.currencyCode === 'PLN'}>PLN (zł)</option>
    <option value="NOK" selected={market.currencyCode === 'NOK'}>NOK (kr)</option>
    <option value="SEK" selected={market.currencyCode === 'SEK'}>SEK (kr)</option>
    <option value="DKK" selected={market.currencyCode === 'DKK'}>DKK (kr)</option>
</select>
```

---

## 6. Tax: EU VAT & OSS Scheme

### OSS Overview for a CZ Company

The **One-Stop-Shop (OSS) Union scheme** is ideal for YourWave:

| Aspect | Detail |
|--------|--------|
| **Threshold** | €10,000 combined cross-border B2C sales/year triggers obligation |
| **Registration** | Czech tax authority (Member State of Identification) |
| **Filing** | Quarterly OSS return |
| **VAT rate applied** | Customer's country rate (not CZ rate) |
| **Scope** | All EU B2C cross-border distance sales |
| **Exclusions** | B2B sales, domestic CZ sales (filed on normal CZ VAT return) |

### VAT Rates by Market

| Country | Standard VAT | Reduced Rate | Notes |
|---------|-------------|-------------|-------|
| CZ | 21% | 12% | Domestic — normal CZ VAT return |
| Germany | 19% | 7% | Largest EU market |
| Austria | 20% | 10% | |
| Poland | 23% | 8% | |
| Norway | 25% | 15% / 12% | NOT EU — separate VOEC scheme |
| Sweden | 25% | 12% / 6% | |
| Denmark | 25% | — | No reduced rate |

### Critical: Norway is NOT in the EU
Norway is EEA but not EU. The OSS scheme does NOT cover Norway. For Norway:
- Register for Norwegian VAT if selling >NOK 50,000/year to Norwegian consumers
- The **VOEC (VAT on E-Commerce)** scheme applies
- 25% standard VAT rate
- Separate filing and registration required

### Implementation in the database:
```sql
-- Store VAT rates per country (updated periodically)
CREATE TABLE vat_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code CHAR(2) NOT NULL,
    rate_type TEXT NOT NULL DEFAULT 'standard', -- standard, reduced, zero
    rate NUMERIC(5, 2) NOT NULL,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,                                -- NULL = currently active
    UNIQUE(country_code, rate_type, valid_from)
);

-- At checkout, determine VAT based on customer's country
-- Lock the rate into the order for audit trail
```

### Tax compliance checklist:
1. Register for OSS in CZ once cross-border B2C sales exceed €10,000
2. Apply destination country VAT rate at checkout
3. File quarterly OSS returns through Czech tax portal
4. Keep records for 10 years
5. Handle Norway separately (VOEC scheme)
6. Display prices inclusive of VAT (required in EU B2C)
7. Show VAT breakdown on invoices

---

## 7. Recommended Approach for YourWave (Small Startup)

### Phase 1: MVP (Launch)

**Keep it simple. Ship fast.**

1. **Base currency: CZK** — you're a CZ company, your accounting is in CZK
2. **Start with 2 currencies: CZK + EUR** — covers CZ domestic + most EU customers
3. **Use ECB/Frankfurter API** — free, reliable, no API key needed
4. **Hybrid pricing model**:
   - Auto-generate EUR prices from CZK base using daily ECB rates
   - Round to clean numbers (.99, .90, .00) after conversion
   - Allow manual overrides for key products
5. **Detect currency from geo** (Cloudflare headers or Accept-Language)
6. **Let users switch currency manually** (dropdown in header)
7. **Store orders in customer's currency AND CZK** for accounting
8. **Skip OSS initially** — until you hit €10,000 cross-border sales, charge CZ VAT on everything

**Estimated effort:** 2-3 days for a developer familiar with Supabase

### Phase 2: Growth (Post-Launch)

When you have traction and sales in multiple countries:

1. **Add PLN, NOK, SEK, DKK** currencies
2. **Register for OSS** once you cross the €10,000 threshold
3. **Implement per-country VAT rates** at checkout
4. **Add Norway VOEC handling** if selling to Norway
5. **Consider Stripe** for multi-currency payment processing (handles conversion on their end)
6. **Add price rounding rules** per currency for psychological pricing

### Phase 3: Scale

1. **Market-specific pricing** (not just conversion — actual different prices per market)
2. **A/B test pricing** per market
3. **Multi-language support** alongside multi-currency
4. **Automated tax filing** integration (e.g., Taxdoo, SimplyVAT)

### Architecture diagram (text):
```
[Customer Browser]
    |
    | Geo detection (Cloudflare CF-IPCountry header)
    |
[Astro SSR / Edge]
    |
    | detectMarket() → { currency: 'EUR', country: 'DE', vat: 19% }
    |
[Supabase]
    ├── products (base_price_czk)
    ├── product_prices (per-currency, auto + manual)
    ├── exchange_rates (daily from ECB)
    ├── orders (locked currency + rate + VAT)
    └── vat_rates (per-country)

[Cron Job / Edge Function]
    |
    | Daily: Fetch ECB rates → Update exchange_rates → Recalc product_prices
```

### Payment gateway recommendation:
- **Stripe** — best multi-currency support, handles CZK/EUR/PLN/NOK/SEK/DKK natively
- Stripe can charge in the customer's currency and settle to your CZK bank account
- Stripe also handles SCA (Strong Customer Authentication) required in EU
- Alternative: **Adyen** (better rates for high volume, but more complex integration)

---

## Sources

- [Shopify Multi-Currency Architecture](https://www.shopify.com/enterprise/blog/multi-currency)
- [Shopify Markets Setup Guide](https://geotargetly.com/blog/shopify-multi-currency)
- [Multi-Currency Database Schema Design](https://www.zigpoll.com/content/how-can-we-design-our-database-schema-to-efficiently-handle-multiple-currencies-and-ensure-accurate-conversion-rates-for-transaction-records-across-different-regions)
- [Multi-Currency PHP/Laravel Patterns](https://laraveldaily.com/post/multi-currency-laravel-php-structure)
- [Exchange Rate APIs Compared (2026)](https://unirateapi.com/articles/free-exchange-rate-apis-compared)
- [ECB Data Portal API](https://data.ecb.europa.eu/help/api/overview)
- [Open Exchange Rates](https://openexchangerates.org/)
- [Frankfurter API (ECB rates)](https://api.frankfurter.app/)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [EU VAT OSS Official Portal](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en)
- [OSS Guide for E-commerce (2025)](https://polishtax.com/one-stop-shop-oss/)
- [OSS for CZ E-commerce (Domytax)](https://domytax.cz/en/blog/single/oss-vat-eu-ecommerce)
- [Intl.NumberFormat MDN Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
- [Currency Formatting Best Practices](https://dev.to/schalkneethling/number-and-currency-formatting-in-javascript-using-intlnumberformat-46og)
- [Stripe EU VAT & OSS Guide](https://stripe.com/guides/introduction-to-eu-vat-and-european-vat-oss)
