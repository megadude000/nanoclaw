---
cortex_level: L20
confidence: high
domain: yourwave
scope: yourwave
project: yourwave
tags: [design, hero, atlas, mobile, desktop, tailwind, astro]
---

# Atlas Article Hero Design — Decisions

## Desktop Hero
- Photo: `absolute inset-x-0 top-0 lg:h-[50vh] overflow-hidden` — extends 50vh, article overlaps below
- Metadata card: normal flow `hidden lg:flex w-[45%] p-6 pt-8` — drives container height
- Frosted glass card: `bg-background/50 backdrop-blur-md rounded-2xl p-5 max-w-[480px]`
- Left gradients (2 layers): `from-background/90 via-background/60 w-[52%]` + `from-background/30 w-[68%]` — hidden on mobile (`hidden lg:block`)
- Bottom blend: `from-background via-background/80 h-48 bg-gradient-to-t`

## Mobile Hero
- Outer container: `min-h-[55vh] overflow-hidden lg:overflow-visible rounded-t-2xl`
- Photo: `h-full` (fills outer container) on mobile, `lg:h-[50vh]` on desktop
- Two strong gradient layers (`lg:hidden`): `h-[78%] via-background/70` + `h-[65%] via-background/85`
- Content: `absolute bottom-0 left-0 right-0 px-5 pb-8` — index-style pinned to bottom
- No frosted glass on mobile — matches atlas index hero style (`/atlas?category=origin`)

## Blend bridge (hero → article)
- `<div class="h-4 bg-gradient-to-b from-transparent to-background relative z-10">`
- Article body: `bg-background relative z-10` to cover photo behind text

## ToC Sidebar
- `fixed right-10 top-1/2 z-30 -translate-y-1/2 hidden lg:block`
- CSS class `.toc-active` with `opacity: 1`, `.toc-line` with `scaleX(1.4) transform-origin: right`
- `isScrolling` flag (900ms) prevents IntersectionObserver overriding click-active state
- H2: `w-5 h-[3px]`, H3: `w-3 h-[2px]`, gap-[2px]
- First stick click → `scrollTo(top)`, rest → `scrollIntoView`
