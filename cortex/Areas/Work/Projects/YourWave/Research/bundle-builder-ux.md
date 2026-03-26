# Bundle Builder UX Research — YourWave Coffee

**Date:** 2026-03-23
**Status:** Complete
**Purpose:** Research best-in-class UX patterns for a custom coffee bundle creator with gamification

---

## 1. Subscription Box Builder Benchmarks

### Trade Coffee (drinktrade.com)
- **Onboarding:** Quiz-based personalization — users answer ~5 questions about taste, brew method, roast preference
- **Matching:** Algorithmic recommendation from 450+ coffees across 55+ roasters
- **Delivery:** Flexible frequency (every 1–4 weeks), pause/skip anytime
- **Standout UX:** Single-page quiz flow, instant recommendation, seamless add-to-subscription

### Atlas Coffee Club
- **Flow:** Direct plan selection (no quiz) — choose bag size, roast, grind, frequency
- **Options:** Half Bag (6oz/15 cups), Single (12oz/30 cups), Double (24oz/60 cups)
- **Frequency:** Every 2 or 4 weeks
- **Extras:** Postcards, tasting notes, cultural info per origin country
- **UX Pattern:** Simple dropdown configurator, surprise-element (country is chosen for you)

### MistoBox
- **Flow:** 7-question quiz for personalization, paired with a human coffee curator
- **Selection:** 600+ coffees from 60+ US roasters
- **Standout Feature:** "Brew Queue" — users queue specific coffees they want next
- **Frequency:** Every 1–4 weeks, fully flexible
- **UX Pattern:** Quiz → curator match → ongoing personalization via ratings and queue

### Key Takeaway
MistoBox's quiz + human curator approach has the highest user satisfaction scores. Atlas's simpler direct-selection works for users who know what they want. **For YourWave: hybrid approach — optional quiz for discovery, direct browse/filter for experienced users.**

---

## 2. Custom Bundle UX Patterns (Meal Kit Inspiration)

### HelloFresh
- **Flow:** Step 1: Plan (people count + meals/week) → Step 2: Browse recipes → Step 3: Fill your box
- **Minimums:** 3 recipes/week for 2 people
- **Auto-fill:** If no selection made, recipes chosen automatically
- **Weakness:** Difficult subscription cancellation, no dietary filter on mobile app

### Gousto
- **Flow:** Similar stepped approach but more flexible
- **Minimums:** 2 recipes for 2 people (lower barrier)
- **Advantage:** One-off boxes without subscription commitment
- **Preferred UX:** Users consistently rate Gousto higher for usability

### Patterns Applicable to YourWave
- **Stepped flow with clear endpoint:** Select format → Browse/filter coffees → Fill to minimum → Checkout
- **Lower minimums increase conversion:** Gousto's 2-recipe minimum outperforms HelloFresh's 3-recipe
- **One-off option alongside subscription:** Reduces commitment anxiety
- **Auto-fill suggestions:** "Not sure? Let us complete your bundle" for decision-fatigued users
- **Visual recipe/product cards** with rich imagery drive engagement

### Baymard Institute Findings (Meal Kit UX)
- Benchmarked 8 leading US/European meal kit sites across 270+ UX guidelines
- Key issues: mobile optimization gaps, filtering limitations, unclear pricing per portion
- Recommendation: Always show per-unit pricing alongside bundle pricing

---

## 3. Step-by-Step Wizard vs. Single-Page Builder

### When to Use a Wizard (Recommended for YourWave)
| Factor | Wizard Wins | Single Page Wins |
|--------|------------|-------------------|
| **Complexity** | 3+ logical steps with dependencies | <5 simple independent fields |
| **Guidance needed** | Users unfamiliar with options | Users know exactly what they want |
| **Mobile** | Better for small screens | Excessive scrolling |
| **Conversion** | Higher completion via commitment | Faster for simple tasks |
| **Analytics** | Easy to measure step abandonment | Harder to pinpoint drop-off |

### Wizard Best Practices (NN/g, UX Collective, Smashing Magazine)
1. **Progress indicator:** Always show current step and total steps (e.g., "Step 2 of 4")
2. **2–4 steps maximum:** Fewer than 2 = unnecessary; more than 10 = simplify
3. **Summary before submit:** Let users review all choices before finalizing
4. **Branching logic:** Show only relevant options based on prior selections
5. **Persistent navigation:** Allow going back without losing data
6. **Mobile-first:** Design for thumb-reach zones, then expand for desktop

### Recommendation for YourWave
**3-step wizard:**
1. **Filter & Discover** — origin, process, roast level, variety (with optional flavor quiz)
2. **Configure** — format (drip bags, capsules, ground), grind size, quantity per item
3. **Review & Gamify** — cart summary with progress bar, discounts, shipping threshold

Each step should be completable independently and persist state. Allow "skip" to browse all.

---

## 4. Mobile vs. Desktop Builder UX

### Mobile-First Mandate
- Start design from mobile, expand to desktop — not the reverse
- Coffee bundle builder will likely see 60–70% mobile traffic
- Mobile users browse during in-between moments (commute, breaks)

### Mobile-Specific Patterns
| Element | Mobile Approach | Desktop Approach |
|---------|----------------|-------------------|
| **Navigation** | Bottom sheet with swipe gestures | Sidebar with persistent filters |
| **Product cards** | Vertical scroll, large tap targets | Grid layout (3–4 columns) |
| **Progress bar** | Sticky bottom bar | Sticky top bar or sidebar |
| **Price** | Always visible in sticky footer | Floating summary panel |
| **Filters** | Modal/bottom sheet overlay | Sidebar accordion |
| **Product preview** | Tap to expand | Hover to preview |
| **CTA** | Full-width sticky button | Standard button in summary |

### Cross-Platform Best Practices (Smashing Magazine, Commerce-UI, Vervaunt)
1. **Thumb-friendly zones:** All configurable options within easy thumb reach on mobile
2. **Sticky pricing & CTA:** Price always visible; CTA greyed until minimum met
3. **Real-time visual feedback:** Instant updates when adding/removing items
4. **Performance:** Optimize for slow mobile networks — lazy load images, skeleton screens
5. **Contextual help:** Tooltips for roast levels, process methods, flavor notes

### Standout Examples
- **Nike (customizer):** Mobile-first, desktop is the expanded version
- **Tylko (furniture builder):** Best-in-class builder UI, works across all device types
- **Gousto:** Clean mobile meal selection with minimal friction

---

## 5. Gamification in E-Commerce

### Psychology & Impact
- **Endowed Progress Effect:** People who feel they've started toward a goal are more motivated to complete it
- **Goal Gradient Effect:** Effort accelerates as people approach a goal
- **Completion Drive:** Progress bars create open loops the brain wants to close

### Key Statistics
| Metric | Impact |
|--------|--------|
| Conversion rate with gamification | **7x higher** |
| AOV lift from progress bars | **15–20%** |
| User engagement increase | **48% average** |
| Repurchase intention (loyalty programs) | **+30–50%** |
| Shoppers who buy more for free shipping | **52%** (UPS survey) |

### Gamification Elements for YourWave Bundle Builder

#### A. Progress Bar (Grams Filled)
- Show visual progress: "120g / 250g filled" with animated fill
- Color changes at milestones (red → yellow → green)
- Micro-animations on each item added (confetti, pulse, checkmark)
- Message: "You're 50g away from completing your bundle!"

#### B. Growing Discount with Volume
- **Tier 1 (250g):** Base price, no discount
- **Tier 2 (500g):** 5% off — "Unlock 5% off! Add 250g more"
- **Tier 3 (750g):** 10% off — "You're a coffee enthusiast! 10% off"
- **Tier 4 (1kg+):** 15% off — "Coffee connoisseur discount unlocked!"
- Show savings in real-time: "You're saving ₴85 with this bundle"

#### C. Free Shipping Threshold
- Set at 20–30% above current AOV
- Dynamic message: "You're ₴120 away from FREE shipping!"
- Progress bar fills as cart value increases
- Celebrate when reached: checkmark animation + "Free shipping unlocked!"
- Sweet spot for motivation: ₴50–250 gap from threshold

#### D. Urgency & Scarcity
- "Only 12 bags of Ethiopia Yirgacheffe left"
- "This lot roasted 2 days ago — freshness countdown"
- Seasonal/limited editions with expiration badges
- "3 other people are building bundles right now" (social proof)

### Implementation Best Practices
1. **Three layers working together:** Progress bar (motivation) + threshold (goal) + product suggestion (solution)
2. **Celebrate milestones:** Green checkmark, confetti animation, haptic feedback on mobile
3. **A/B test thresholds:** Run 15-day tests, measure AOV lift and conversion
4. **Optimal threshold reach rate:** 40–60% of users should reach it; adjust if too many or too few do
5. **Tiered progress bars outperform single-goal bars** by 25%+ in AOV lift

---

## 6. Coffee-Specific: Flavor Profile & Recommendations

### Quiz-Based Discovery (Best-in-Class Examples)

#### Intelligentsia
- 5 short questions → matched to flavor profile + recommendations
- Clean, visual design with coffee imagery

#### Coffee Bros.
- Factors: brewing method, roast level, origin, varietal, taste preferences
- No email required to see results (reduces friction)
- Clear factor explanations

#### Devocion
- 3-step flow: taste preferences → brewing method → roast level
- Instant matching, farm-fresh positioning
- Color-coded flavor profiles

#### Equator (via Digioh)
- Results page shows #1 match + runner-ups
- Built-in grind/size/subscription selectors on results page
- One-click add to cart without leaving quiz

### Recommendation Engine Approach for YourWave

#### Option A: Guided Quiz (New Users)
1. "How do you brew?" — drip, espresso, pour-over, French press, capsule
2. "What flavors do you enjoy?" — visual flavor wheel (chocolate, fruity, nutty, floral)
3. "How adventurous are you?" — stick to favorites vs. explore new origins
4. "Roast preference?" — light / medium / dark / no preference
5. Result: Curated bundle suggestion with explanation per coffee

#### Option B: Smart Filters (Experienced Users)
- Origin: Ethiopia, Colombia, Brazil, Kenya, Guatemala, etc.
- Process: Washed, Natural, Honey, Anaerobic
- Roast: Light, Medium, Dark, Omni
- Variety: Gesha, Bourbon, Typica, SL28, Caturra
- Flavor notes: Tag-based filtering (chocolate, berry, citrus, floral, nutty)
- Score: SCA score range slider

#### Option C: Hybrid (Recommended)
- Default: Browse with smart filters
- Floating "Help me choose" button → launches mini-quiz
- AI-powered "If you liked X, try Y" suggestions based on past orders
- "Staff picks" and "Trending this week" curated collections

---

## 7. Pricing Psychology

### Price Anchoring
- Show original per-100g price crossed out, bundle price alongside
- "Individual purchase: ₴450 | Bundle price: ₴380 — Save ₴70"
- Always show the highest tier first to anchor expectations

### Decoy Effect
- Offer 3 bundle sizes: Small (250g), Medium (500g), Large (1kg)
- Price Medium closer to Large to make Large feel like the obvious choice
- Example: 250g = ₴350 | 500g = ₴620 | 1kg = ₴680
- The 500g "decoy" makes 1kg look like an incredible deal

### Volume Discounts (Tiered Pricing)
- Transparent tier display: "The more you add, the more you save"
- Show per-gram price decreasing with quantity
- Real-time savings counter in the cart
- Research shows 10–15% higher growth for companies that A/B test pricing

### Subscription vs. One-Off Pricing
- Show monthly equivalent for subscriptions: "₴380/month" not "₴4,560/year"
- Annual discount framing: "Save 2 months free with annual plan"
- 30% better retention with annual plans (Zuora research)
- Allow one-off bundles alongside subscription to reduce commitment anxiety

### Psychological Pricing Tactics for YourWave
1. **Charm pricing:** ₴299 instead of ₴300
2. **Savings framing:** "Save ₴85" is more motivating than "15% off" for high values
3. **Per-cup pricing:** "Only ₴12 per cup of specialty coffee" (normalization)
4. **Comparison anchor:** "Café price: ₴80/cup. Your bundle: ₴12/cup" (external anchor)
5. **Loss aversion:** "Your 15% discount expires when you leave this page" (use sparingly)

---

## 8. Technical Architecture: React Multi-Step Builder

### Recommended Stack (2025–2026 Best Practice)
```
React Hook Form  — form state & validation per step
Zod              — schema-based validation per step
Zustand          — cross-step state management (bundle state)
Shadcn UI        — polished UI components
TanStack Query   — async API calls (product data, pricing)
Framer Motion    — step transitions & micro-animations
```

### Component Architecture
```
src/
├── features/
│   └── bundle-builder/
│       ├── BundleBuilder.tsx          # Main orchestrator
│       ├── BundleWizard.tsx           # Step controller (navigation, progress)
│       ├── stores/
│       │   └── useBundleStore.ts      # Zustand store (selected items, format, quantity)
│       ├── steps/
│       │   ├── DiscoverStep.tsx       # Filter/browse coffees
│       │   ├── ConfigureStep.tsx      # Format, grind, quantity per item
│       │   └── ReviewStep.tsx         # Cart summary + gamification
│       ├── components/
│       │   ├── CoffeeCard.tsx         # Product card with quick-add
│       │   ├── FlavorQuiz.tsx         # Optional guided quiz
│       │   ├── FilterPanel.tsx        # Origin, process, roast, variety filters
│       │   ├── ProgressBar.tsx        # Grams filled + milestones
│       │   ├── DiscountTier.tsx       # Volume discount display
│       │   ├── ShippingThreshold.tsx  # Free shipping progress
│       │   └── BundleSummary.tsx      # Floating/sticky order summary
│       ├── hooks/
│       │   ├── useBundlePricing.ts    # Real-time price calculation
│       │   ├── useGamification.ts     # Milestone tracking, animations
│       │   └── useRecommendations.ts  # "You might also like" logic
│       └── schemas/
│           └── bundleSchema.ts        # Zod validation per step
├── components/ui/                     # Shadcn UI components
└── lib/
    └── api/
        └── products.ts                # Product API calls
```

### State Management (Zustand Store)
```typescript
interface BundleState {
  // Step tracking
  currentStep: number;
  completedSteps: Set<number>;

  // Product selection
  items: BundleItem[];          // { productId, format, grind, quantity }
  totalGrams: number;

  // Gamification
  currentTier: DiscountTier;
  savingsAmount: number;
  shippingUnlocked: boolean;
  milestonesReached: string[];

  // Actions
  addItem: (item: BundleItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setFormat: (productId: string, format: Format) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}
```

### Key Architectural Decisions
1. **Separate form per step:** Each step validates independently, sends data to central Zustand store
2. **Optimistic updates:** Update UI immediately on add/remove, sync with backend async
3. **Persistent state:** Save bundle to localStorage so users don't lose progress on page refresh
4. **URL-based steps:** `/bundle/discover`, `/bundle/configure`, `/bundle/review` for deep linking
5. **Server-side pricing:** Never trust client-side price calculations — validate on backend
6. **Skeleton loading:** Show skeleton cards while products load, especially on mobile

### Performance Considerations
- Lazy load step components: `React.lazy(() => import('./steps/ConfigureStep'))`
- Image optimization: WebP with responsive srcset, lazy loading below fold
- Virtual scrolling for large product catalogs (react-window or TanStack Virtual)
- Debounce filter changes (300ms) to reduce API calls
- Prefetch next step data while user is on current step

---

## 9. Recommended User Flow for YourWave

### Complete Flow Map
```
Landing Page
  │
  ├─→ "Build Your Bundle" CTA
  │     │
  │     ▼
  │   Step 1: DISCOVER
  │     ├─ Smart filters (origin, process, roast, variety)
  │     ├─ Optional: "Help me choose" quiz
  │     ├─ Product cards with flavor notes + quick-add
  │     ├─ Sticky progress bar at bottom: "0g / 250g minimum"
  │     └─ "Next: Configure →" (enabled when ≥1 item selected)
  │           │
  │           ▼
  │         Step 2: CONFIGURE
  │           ├─ Per-item: format (drip bag / capsule / ground)
  │           ├─ Per-item: grind size (if ground selected)
  │           ├─ Per-item: quantity (min 30g increments)
  │           ├─ Running total with tier discount preview
  │           └─ "Review Bundle →"
  │                 │
  │                 ▼
  │               Step 3: REVIEW & CHECKOUT
  │                 ├─ Full bundle summary
  │                 ├─ Gamification dashboard:
  │                 │   ├─ Progress bar (grams filled)
  │                 │   ├─ Current discount tier + next tier preview
  │                 │   ├─ Free shipping progress
  │                 │   └─ "Add ₴X more to unlock Y"
  │                 ├─ "You might also like" suggestions
  │                 ├─ One-off vs. subscription toggle
  │                 └─ Checkout CTA
  │
  └─→ "Take the Quiz" CTA
        │
        ▼
      Flavor Quiz (5 questions)
        │
        ▼
      Curated Bundle Suggestion
        ├─ Accept & go to Step 3
        └─ Modify → goes to Step 1 with pre-filters
```

### Minimum Viable Gamification (Phase 1)
1. Progress bar showing grams filled toward minimum
2. Single free shipping threshold with dynamic messaging
3. Volume discount tiers (3 tiers: base, 5%, 10%)
4. Celebration animation when milestones reached

### Enhanced Gamification (Phase 2)
1. Flavor diversity badge ("You've explored 4 origins!")
2. Subscription streak rewards
3. Referral program integration
4. Limited edition "drops" with countdown timers
5. Coffee passport — collect stamps per origin tried

---

## 10. Key Recommendations Summary

### Must-Have (Launch)
1. **3-step wizard** with clear progress indicator and persistent state
2. **Mobile-first design** with sticky bottom progress bar and CTA
3. **Smart filters** with real-time product count updates
4. **Progress bar** for grams filled with minimum threshold
5. **Tiered volume discounts** with real-time savings display
6. **Free shipping threshold** with dynamic gap messaging
7. **Per-unit pricing** displayed alongside bundle pricing
8. **One-off + subscription** options to reduce commitment anxiety

### Should-Have (V2)
1. **Flavor quiz** for new user onboarding and discovery
2. **AI recommendations** based on past purchases and ratings
3. **Decoy pricing** on bundle size options
4. **Social proof** ("12 people built this bundle today")
5. **Freshness indicator** with roast date countdown
6. **A/B testing framework** for pricing and gamification thresholds

### Nice-to-Have (V3)
1. **Coffee passport** gamification with origin collection
2. **AR packaging preview** on mobile
3. **Brew guide** matched to selected coffees
4. **Community ratings** and taste notes per coffee
5. **Gift bundle builder** with custom messaging

---

## Sources & References

### Subscription Box Builders
- [Atlas Coffee Club](https://atlascoffeeclub.com/)
- [MistoBox](https://mistobox.com/)
- [Trade Coffee](https://www.drinktrade.com/)

### Meal Kit UX
- [Baymard Institute — Meal Kit UX Research](https://baymard.com/research/meal-kits)
- [HelloFresh UX Case Study](https://medium.com/@2rankc81/hellofresh-case-study-usability-design-solutions-for-the-hellofresh-smartphone-application-a71e44bd50aa)

### Wizard vs. Single Page
- [NN/g — Wizards: Definition and Design Recommendations](https://www.nngroup.com/articles/wizards/)
- [Zuko — Single Page or Multi Step Form](https://www.zuko.io/blog/single-page-or-multi-step-form)
- [UX Collective — The Wizard of User Experience](https://uxdesign.cc/the-wizard-of-user-experience-6926ca41bc9a)

### Mobile vs. Desktop Builder
- [Smashing Magazine — Designing A Perfect Responsive Configurator](https://www.smashingmagazine.com/2018/02/designing-a-perfect-responsive-configurator/)
- [Vervaunt — eCommerce Product Builders](https://vervaunt.com/ecommerce-product-builders-configurable-products-considerations-ux-best-practices-examples)
- [Commerce-UI — Product Configurator Guide](https://commerce-ui.com/insights/ecommerce-product-configurator-2024-guide)

### Gamification
- [EasyApps — Ecommerce Gamification Guide 2026](https://easyappsecom.com/guides/ecommerce-gamification-guide.html)
- [MobiLoud — Gamification in Ecommerce Apps](https://www.mobiloud.com/blog/gamification-in-ecommerce)
- [ConvertCart — 36 Real-World Examples of Gamification](https://www.convertcart.com/blog/gamification-ecommerce)

### Free Shipping & Progress Bars
- [Growth Suite — Progress Bar AOV Guide](https://www.growthsuite.net/resources/shopify-discount/progress-bar-aov-boost-strategy-guide)
- [GroPulse — Free Shipping Progress Bar Guide](https://gropulse.com/how-to-add-a-free-shipping-progress-bar-in-shopify/)
- [Identixweb — Shopify Cart Gamification](https://www.identixweb.com/shopify-cart-drawer-gamification-how-tiered-rewards-lift-aov/)

### Pricing Psychology
- [RevenueCat — Subscription Pricing Psychology](https://www.revenuecat.com/blog/growth/subscription-pricing-psychology-how-to-influence-purchasing-decisions/)
- [Shopify — Price Anchoring](https://www.shopify.com/enterprise/blog/44331971-6-scientific-principles-of-persuasion-all-smart-ecommerce-founders-know)
- [NetSuite — Psychological Pricing Tactics](https://www.netsuite.com/portal/resource/articles/ecommerce/psychological-pricing.shtml)

### Coffee Flavor Quizzes
- [Intelligentsia — Flavor Profile Quiz](https://www.intelligentsia.com/pages/quiz)
- [Coffee Bros. — Coffee Match Quiz](https://coffeebros.com/pages/coffee-match-quiz)
- [Digioh — 50+ Product Recommendation Quiz Examples](https://www.digioh.com/product-recommendation-quiz-examples)

### Build Your Own Bundle (Shopify)
- [Kaching — Mix and Match Bundle on Shopify](https://www.kachingappz.com/blogs/shopify-mix-and-match-bundle)
- [Fast Bundle — Shopify Mix and Match](https://fastbundle.co/blog/shopify-mix-and-match-bundle/)
- [BYOB — Shopify App](https://apps.shopify.com/byob-build-your-own-bundle)

### React Architecture
- [Build with Matija — React Hook Form Multi-Step Tutorial](https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps)
- [ClarityDev — Build a Multistep Form with React Hook Form](https://claritydev.net/blog/build-a-multistep-form-with-react-hook-form)
- [Codemotion — Building Reusable Multi-Step Form in ReactJS](https://www.codemotion.com/magazine/frontend/building-reusable-multiple-step-form-in-reactjs/)
