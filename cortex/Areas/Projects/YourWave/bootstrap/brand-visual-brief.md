---
cortex_level: L10
confidence: high
domain: yourwave
scope: yourwave — brand-visual-brief
type: bootstrap-extract
tags:
  - yourwave
  - bootstrap
  - market
created: '2026-03-31'
project: yourwave
source_hash: d9a471214f5c55702e0e4feaa3579435690be4df94406184be406b2004ec81a0
embedding_model: text-embedding-3-small
---
# Brand Visual Direction Brief — YourWave

*Compiled: March 2026*
*Status: Decision-ready — 3 concrete directions for founder review*
*Feeds into: logo creation, packaging design, Shopify theme, social media templates*

---

## Context & Brief

YourWave is a Czech specialty coffee DTC brand at pre-launch stage. The brand name and tagline are confirmed. Visual identity — logo, color system, typography — is the critical path blocker for packaging production and platform store launch.

This brief synthesises patterns from 12 global specialty coffee DTC brands (see `brand-moodboard.md`) and applies them to three distinct, internally coherent visual directions. Each option is ready to execute with DIY or AI-assisted tools.

**Brand essence to carry into all options:**
- Discovery and exploration (the "wave" and "atlas" concepts)
- Czech-rooted, internationally-minded
- Knowledge without snobbery — the knowledgeable friend, not the lecturer
- DTC-native — the brand lives on screens and in unboxing moments, not in physical cafes

---

## Competitive White Space (from moodboard research)

Before choosing a direction, it is worth noting what the Czech specialty market does NOT yet have:

- No Czech brand owns a clean, tech-modern visual aesthetic (all trend Scandinavian-craft-warm)
- No Czech brand positions education as its visual brand language
- The "Central European" cultural identity is completely unused in Czech specialty coffee branding
- Cold, contemporary palettes (navy, grey, teal) are near-absent across all 12 global reference brands — this is ownable territory for a digitally-native brand

---

## Option A — Minimal Wave (Tech-Modern)

### Concept

Clean, confident, digitally native. Borrows the visual grammar of high-quality software products (Linear, Vercel, Raycast) and applies it to specialty coffee. This is the brand that a product designer or software founder would build if they decided to roast coffee. The wave is geometric, precise, almost like a UI component.

This direction has no direct competitor in Czech specialty coffee. It positions YourWave as a digital-first brand rather than a craft-first brand — which is accurate given the DTC/subscription model.

### Color Palette

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Primary | Deep Navy | `#0D1B2A` | Background, wordmark, primary type |
| Secondary | Off-White / Parchment | `#F5F0E8` | Backgrounds, packaging base, light mode |
| Accent | Copper Bronze | `#B87333` | CTAs, wave icon, accent type, packaging detail |
| Supporting | Mid Navy | `#1C3353` | Cards, secondary surfaces |
| Neutral light | Warm Grey | `#E8E4DC` | Dividers, input backgrounds |
| Neutral dark | Slate | `#4A5568` | Body copy, secondary text |

**Accessibility:** Navy `#0D1B2A` on Parchment `#F5F0E8` — contrast ratio ~14:1 (AAA). Copper `#B87333` on Navy — use at large sizes only (3:1 at 24px+).

**Why this palette works:** Deep navy is rare in specialty coffee (most brands use black or warm brown as their dark anchor). The copper accent references premium craft without being warm-earthy. The combination reads as "precision + warmth" — a technology brand that cares about quality.

### Typography

**Primary — Headlines, wordmark, packaging:**
- **Geist** (free, Vercel) — geometric, confident, distinct at small sizes. Available on Google Fonts via npm
- **Inter** (free, Google Fonts) — the benchmark geometric sans. Ubiquitous but near-perfect
- **Neue Haas Grotesk** (paid, ~$200) — the original Swiss grotesque. Elevated version of Helvetica. Worth the investment if budget allows

**Secondary — Body text, descriptions, UI:**
- **Inter Regular/Light** — if using Geist for headlines
- **DM Sans** (free, Google Fonts) — slightly warmer than Inter, pairs well with either headline choice

**Accent — Pull quotes, tagline, origin names:**
- **Playfair Display Italic** (free, Google Fonts) — a single italic serif for the "discovery" moments. Used sparingly, this creates a tension between tech precision and coffee romance that feels authentic

**Hierarchy example:**
```
YOURWAVE                    [Geist Bold, 32px, Navy]
Ethiopia Yirgacheffe        [Geist Medium, 18px, Navy]
Washed · 2,100m · Heirloom  [Inter Regular, 14px, Slate]
"Jasmine. Bergamot. Clarity."  [Playfair Italic, 16px, Copper]
```

### Logo Style

**Format:** Wordmark with integrated wave motif

**Description:** The name "YourWave" set in Geist Bold. The letter W features a subtle wave-form modification — either the two peaks of the W are slightly curved/softened into a sine-wave rhythm, or a small geometric wave icon sits to the left of the wordmark (approximately the height of a capital letter). The icon variant (wave glyph alone) serves as the favicon, app icon, and packaging emboss.

**Variants needed:**
- Wordmark horizontal: `[~] YourWave` — primary usage
- Wordmark compact: `YourWave` with W modification — tight spaces
- Icon only: wave glyph — favicon, embossed packaging, app icon
- Dark on light (Navy on Parchment) and light on dark (Parchment on Navy)

**What to avoid:** The wave should be geometric and precise, not organic or hand-drawn. Think sine function plotted on a grid, not a watercolor wave.

### Reference Brands

- **Blue Bottle Coffee** — white/blue minimal, digital ritual brand
- **Square Mile Coffee Roasters** — monochrome confidence, information-as-design
- **Workshop Coffee** (UK) — architectural grid, condensed geometric type
- **Linear / Vercel** (software) — dark mode precision, subtle accent colors
- **Intelligentsia** (USA) — bold wordmark confidence, clean system

### Packaging Direction

Matte navy bag with copper foil wordmark. Origin name in large Geist on the front face. Process and tasting notes on reverse in Inter Regular. A single copper wave motif embossed on the bottom of the bag. Minimal — three elements maximum per face.

### Who This Is For

The buyer who appreciates the craft without needing rustic visual signals to confirm it. Design-literate. Probably uses a V60 or AeroPress. Reads product release notes. Values clarity and precision. Lives in Prague 2, works in tech or creative sector.

### DIY / AI Execution Path

1. **Logo:** Figma — start with Geist typeface, modify the W manually or use Figma AI (or Midjourney with prompt: "minimal geometric wave wordmark logo, navy blue, sans-serif font, clean, tech brand aesthetic")
2. **Color system:** Use the hex codes above directly in Figma and Shopify Dawn theme CSS variables
3. **Social templates:** Figma Community — search "Coffee Brand Social Kit" and re-skin in navy/copper
4. **Packaging mockup:** Canva Pro has bag mockup templates; replace colors with navy/parchment

---

## Option B — Terroir-Craft (Origin Story)

### Concept

Warm, story-forward, craft-first. This is the direction that references the physical world of coffee — farms, processing stations, harvest seasons, hands. The visual language is inspired by Kinfolk magazine, Tim Wendelboe's origin photography, and the quiet luxury of La Cabra. It communicates that YourWave knows where its coffee comes from and believes that origin is the story.

This direction is well-occupied globally (most specialty brands live here) but is underexecuted in the Czech market specifically. Done well, it beats everyone in CZ on visual quality alone.

### Color Palette

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Primary | Deep Amber / Cognac | `#7C4A1E` | Wordmark, primary headings, packaging detail |
| Background | Warm Cream | `#FBF5E6` | Page background, packaging base, light surfaces |
| Supporting | Forest Green | `#2D4A2D` | Secondary headings, botanical accents, origin labels |
| Accent | Terracotta | `#C4622D` | CTAs, limited edition accents, highlight |
| Neutral warm | Oat | `#E8DCC8` | Cards, dividers, secondary surfaces |
| Neutral dark | Espresso Brown | `#2A1810` | Body copy alternative, dark surfaces |

**Accessibility:** Amber `#7C4A1E` on Cream `#FBF5E6` — contrast ratio ~7:1 (AA large, borderline AA normal). Forest Green on Cream — ~8:1 (AA). For body text, use Espresso Brown on Cream (~14:1).

**Why this palette works:** Directly references the physical materials of specialty coffee — parchment, dried cherry, leaf, soil. Ten of twelve reference brands use warm neutrals as their foundation for exactly this reason. This palette has the highest chance of reading as "premium specialty coffee" to a first-time visitor.

### Typography

**Primary — Headlines, packaging, pull quotes:**
- **Playfair Display** (free, Google Fonts) — the benchmark humanist serif for editorial craft brands. Confident serifs, designed for editorial use
- **EB Garamond** (free, Google Fonts) — more classical, older, richer. Better for packaging than screen
- **Cormorant Garamond** (free, Google Fonts) — elegant, fine-stroked, high fashion. Very beautiful on packaging; requires careful sizing for screen use

**Secondary — Body text, descriptions, UI, product info:**
- **Source Sans 3** (free, Google Fonts) — clean, neutral, designed for information-dense text. Perfect counterpart to editorial serifs
- **Lato** (free, Google Fonts) — friendly humanist sans, very readable, works well alongside serifs

**Accent — Origin labels, tasting notes, producer names:**
- **Playfair Display Italic** — used inline within the same typeface family for accent moments

**Hierarchy example:**
```
Ethiopia Yirgacheffe        [Playfair Display Bold, 28px, Amber]
Natural Process             [Source Sans 3 Medium, 16px, Forest Green]
Tibebu Roba Farm · 2,200m   [Source Sans 3 Regular, 14px, Brown]
"Hibiscus. Fig. Wild honey." [Playfair Display Italic, 16px, Amber]
```

### Logo Style

**Format:** Small illustrative mark + wordmark

**Description:** A simple line-drawn mark to the left of the wordmark. The mark is a stylised combination of a wave and a coffee leaf — approximately 3-4 lines suggesting both. Set in the amber color. The wordmark uses Playfair Display Regular or Cormorant Garamond — elegant, confident, unhurried.

**Variants needed:**
- Full lockup: `[mark] YourWave` horizontal — primary
- Stacked: `[mark]` above `YOURWAVE` — packaging, square formats
- Mark only: coffee-wave glyph — stamp, emboss, favicon
- Light version on forest green background for seasonal/limited editions

**What to avoid:** The illustration should not be literal or decorative. One line drawing, refined to the minimum — closer to a cartographer's symbol than a botanical illustration.

### Reference Brands

- **Tim Wendelboe** (Norway) — origin-first, kraft materials, hand-drawn origin maps
- **Nomad Coffee** (Spain) — illustration-led, exploration narrative, Mediterranean warmth
- **La Cabra Coffee** (Denmark) — quiet luxury, restraint, negative space
- **Stumptown Coffee** — illustrated, story-per-bag, approachable
- **Kinfolk Magazine** (not coffee, but the exact aesthetic reference for editorial photography)

### Packaging Direction

Kraft base or warm cream matte bag. Amber wordmark and mark. Each origin gets a different color-coded accent label (terracotta for Ethiopia, forest green for Colombia, ochre for Brazil). Origin name in Playfair Display Bold as the dominant element on the front face. Tasting notes and farm details on reverse. The bag should feel like it contains something worth reading.

### Who This Is For

The buyer drawn to quality by story. Cares about provenance. Probably subscribes to at least one food/drink content newsletter. Appreciates craftsmanship but isn't interested in the process-forward aesthetics of tech or architecture. The person who buys from Rohlík but also goes to the farmers market. Lives anywhere in CZ — this direction travels beyond Prague.

### DIY / AI Execution Path

1. **Illustration mark:** Midjourney prompt: "minimal single-line botanical illustration of a wave and coffee leaf combined, clean vector, amber on cream, editorial style, no shading"
2. **Logo assembly:** Figma — place illustration beside Playfair Display wordmark
3. **Packaging:** Canva Pro kraft bag mockups, re-skin with warm palette
4. **Photography filter:** VSCO A4 or Lightroom "Analog Warmth" preset — apply consistently across all social photography

---

## Option C — Bold Czech (Local Pride)

### Concept

Strong, graphic, unapologetically Central European. This direction takes inspiration from the golden age of Czech graphic design (the functionalist typography of the 1920s–30s, the bold editorial design tradition of the Czech arts) and applies it to a contemporary specialty coffee brand. The result is something that feels neither Scandinavian-imported nor vintage-nostalgic — it is genuinely its own thing.

This is the highest-risk, highest-reward direction. No Czech coffee brand looks like this. If executed well, it is the most distinctive and memorable option. If executed poorly, it reads as either generic or archaic.

### Color Palette

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Primary | Near Black | `#1A1A1A` | Wordmark, primary type, packaging base option |
| Background | Warm Cream | `#F7F2E8` | Page background, light packaging base |
| Accent | Terracotta Red | `#C0392B` | Mark, CTAs, seasonal limited editions |
| Supporting | Warm Charcoal | `#3A3A3A` | Body copy, secondary type |
| Alternative accent | Emerald | `#1A5C3A` | Second seasonal accent (alternating with terracotta) |
| Neutral | Stone | `#D4CFC4` | Dividers, subtle backgrounds |

**Accessibility:** Near Black `#1A1A1A` on Cream `#F7F2E8` — contrast ratio ~17:1 (AAA). Terracotta `#C0392B` on Cream — ~5:1 (AA for large text). Use Near Black for all body copy.

**Why this palette works:** Black and cream is the most versatile base in graphic design — it works at any scale, in any medium, for any audience. The terracotta accent gives the system warmth and distinctiveness without compromising the graphic strength. The emerald alternative enables a split-accent system (terracotta for washed coffees, emerald for naturals, for example).

### Typography

**Primary — Headlines, wordmark, dominant packaging text:**
- **Aktiv Grotesk Bold/Black** (paid, ~$250 for desktop license) — the modern Swiss grotesque. Confident, contemporary, slightly warmer than Helvetica Neue
- **Neue Haas Grotesk Display** (paid, ~$200) — the original. Authority without aggression
- **Space Grotesk** (free, Google Fonts) — geometric grotesque with slightly quirky character. Interesting and free — best free option for this direction

**Secondary — Body text, product descriptions:**
- **Space Grotesk Regular** (if using Space Grotesk Bold for headlines — use across the system)
- **DM Mono** (free, Google Fonts) — monospaced option for technical details (altitude, lot number, SCA score) — adds a data/precision element

**Accent — Origin details, tasting notes (optional serif contrast):**
- If the system feels too cold, a single italic serif (EB Garamond Italic) can be introduced for tasting note moments only

**Hierarchy example:**
```
YOURWAVE                    [Space Grotesk Black, 40px, Near Black, all caps]
ETHIOPIA YIRGACHEFFE        [Space Grotesk Bold, 20px, Near Black, all caps]
Natural · 2,100m · Heirloom [Space Grotesk Regular, 14px, Charcoal]
SCA 87                      [DM Mono Regular, 13px, Terracotta]
```

### Logo Style

**Format:** Strong geometric mark + confident wordmark

**Description:** The mark is an abstract, geometric interpretation of a wave — a bold, angular or stepped form (not curved), approximately the height and width of two capital letters. Think Bauhaus geometry, not coastal illustration. It sits to the left of "YOURWAVE" set in Space Grotesk Black at a slightly smaller scale than the mark. The result reads as a single strong unit.

**Variants needed:**
- Full lockup: `[mark] YOURWAVE` — primary, horizontal
- Mark only: for emboss, stamp, favicon, packaging badge
- Stacked: mark above wordmark — square formats
- Single-color reverse: white on Near Black, Near Black on Cream

**What to avoid:** Rounded corners. Thin lines. Gradients. This mark should be reproducible in a single ink, hot-stamped on paper, or embossed in blind — and look better every time.

### Reference Brands

- **Stumptown** — confident mark, not afraid to be bold
- **Belleville Brulerie** (France) — charcoal/cream/terracotta, sophisticated but strong
- **Workshop Coffee** (UK) — architectural, condensed, uncompromising
- **Muji** (Japan) — near-black on cream, strong grid, information as design
- **Czech functionalist poster design** (1920s–1930s) — look at Ladislav Sutnar's work specifically

### Packaging Direction

Near-black matte bag with cream wordmark and mark. Each origin gets a different terracotta or emerald accent (for label color coding). The origin name and key details are set in all-caps Space Grotesk Bold, large, as the dominant packaging element. Back of bag has SCA score, producer name, altitude, and process in a clean information grid. The bag should look like a product designed by someone who takes both coffee and design seriously.

### Who This Is For

The design-literate buyer who is slightly tired of Scandinavian minimalism and wants something with a distinct point of view. Probably 25–40, urban, has opinions about typography. Would notice if the wordmark was set in Helvetica vs. Space Grotesk. Appreciates craft without needing rusticity as a signal of quality. The person who follows @fonts.in.use on Instagram.

### DIY / AI Execution Path

1. **Mark creation:** Figma — draw geometric wave mark using rectangles and boolean operations. No illustration skills needed. Or use Midjourney: "bold geometric abstract wave logo mark, black, Bauhaus influenced, strong, clean vector, no text"
2. **Wordmark:** Figma with Space Grotesk Black (free from Google Fonts)
3. **Packaging:** Canva Pro black kraft bag mockup, cream text overlay
4. **CSS/Shopify:** Near-black background with cream text is trivial to implement — no custom development needed

---

## Decision Framework

### Choose Option A if:
- YourWave's primary audience is tech-adjacent, design-literate, urban Prague
- The founder's personal aesthetic skews toward software/product design
- Speed to execution is critical — the system is simple enough to implement in a week
- You want the brand to feel like a startup that happens to sell coffee

### Choose Option B if:
- Story and origin are central to the brand's communication strategy
- The Atlas product (education, terroir) is as important as the subscription product
- The founder wants the brand to feel warm and approachable across all of Czech Republic, not just Prague
- You are willing to invest in photography — this direction requires good natural-light photography to work

### Choose Option C if:
- The founder has a strong, distinctive personal aesthetic and the confidence to commit to it
- Brand differentiation in the Czech market is the top priority
- The brand will expand beyond CZ (this direction travels better internationally)
- You are willing to invest in font licensing (or commit to Space Grotesk as a free alternative)

---

## Shared Recommendations Across All Options

Regardless of which direction is chosen, the following apply:

**Logo files to produce:**
- SVG (master, scalable)
- PNG transparent background (web use)
- PDF (print-ready)
- Reversed/white variant of all above

**Minimum color system:**
- Primary brand color (dark anchor)
- Light/background color
- Accent color
- At least one neutral

**Typography minimum:**
- One headline font (loaded via Google Fonts or self-hosted)
- One body font (can be same family at different weights)

**Packaging must-haves:**
- Matte surface (not gloss — matte = craft, gloss = commodity)
- Origin name as primary text hierarchy (not brand name)
- QR code linking to origin story page on yourwave.coffee
- Roast date (not "best before")
- SCA score if 85+ (signals specialty grade clearly)

**Tools shortlist:**
- Design: Figma (free for solo, essential for brand system management)
- AI logo iteration: Midjourney, Adobe Firefly (vector output), Recraft.ai (best free vector AI)
- Mockups: Canva Pro or Smartmockups.com
- Font source: Google Fonts (free), fonts.adobe.com (with Creative Cloud), MyFonts (paid)
- Color accessibility checker: webaim.org/resources/contrastchecker

---

## Next Steps

1. Founder reviews all three options and selects a direction (or hybrid)
2. Create 3–5 logo concepts within the chosen direction using Figma + AI
3. Test logos at packaging scale (mockup on a coffee bag) before finalising
4. Build minimal design system in Figma: colors, type scale, logo variants
5. Apply to: Shopify storefront, Instagram profile, packaging brief for printer

---

*Research basis: brand-moodboard.md (12 global brands analysed), yw.branding.md, yw.market.md*
*Last updated: March 2026*
