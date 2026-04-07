---
source_hash: 1c32cd6764ae512be83626376c28660360063d390b04efe646057cecfc28c5aa
embedding_model: text-embedding-3-small
---
# YourWave — Blog/News Section + Morning Coffee News Cron (IDEA)

*Status: Idea only — not yet implemented. Research before implementation.*
*Added: 2026-03-28*

## Concept

Two new content sections on YourWave platform (separate from Coffee Atlas):

### Blog
- Brand stories (sourcing journeys, roaster visits)
- Brew guides (longer than Atlas articles, more personal/opinionated)
- YourWave origin story, team, values
- Astro content collection: `src/content/blog/`

### News
- Industry news: competitions, market trends, new origins
- Curated for home brewers (not trade-only)
- Links back to relevant Atlas articles (e.g. Ethiopian harvest news → atlas/en/ethiopia)
- Astro content collection: `src/content/news/`

## Morning Coffee News Cron (idea)

Daily cron at ~07:45 CET:
1. Fetch 2-3 fresh headlines from RSS feeds:
   - perfectdailygrind.com/feed
   - sprudge.com/feed
   - dailycoffeenews.com/feed
2. Pick 2 most relevant to YourWave audience (home brewers, CZ/EU market, origin stories)
3. Format as Instagram Stories draft:
   - Hook (1 line)
   - Summary (1-2 sentences)
   - CTA + Atlas article link
4. Send to main chat via nanoclaw

## Why this matters for Instagram
- Fresh daily Stories content without manual research
- Each story anchored to Atlas article → drives traffic
- Positions YourWave as "the coffee knowledge brand" not just a shop

## Implementation notes (for when ready)
- RSS fetching: simple Node.js with `rss-parser` or `fast-xml-parser`
- Story draft formatting: Claude API call with 1-sentence prompt
- Scheduling: nanoclaw cron task with script (wakeAgent: true only if fresh news found)
- Atlas linking: keyword match against article slugs
