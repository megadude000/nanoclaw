---
cortex_level: L20
confidence: high
domain: yourwave
scope: infra
tags:
  - gemini
  - api-key
  - security
  - imagen
  - image-generation
  - resolved
created: 2026-04-01T00:00:00.000Z
updated: 2026-04-05T09:30:00.000Z
status: 'resolved — key replaced, working as of 2026-04-02'
source_hash: 85b6041522c211e4fc319b218abb3e8e4a2dafe30dfc1dd05aecc3f70ada0565
embedding_model: text-embedding-3-small
---

# Gemini API Key — Status

## Current State: ✅ WORKING

Key was leaked and blocked on 2026-04-01. User replaced it before the 2026-04-02 nightshift.

On 2026-04-02 nightshift: **30 inline figures generated** (arabica, bourbon, brazil, burundi, catuai, caturra, chemex, coffee-belt) + hero images for all 10 new Getting Started articles. Imagen 4 Fast working correctly.

## History
- 2026-04-01: Key flagged as leaked by Google (HTTP 403 "Your API key was reported as leaked")
- 2026-04-01: 31 inline images could not be generated; nightshift image tasks skipped
- 2026-04-02: Key replaced (user action). Working.
- 2026-04-02: 30 inline figures generated, hero images for Getting Started series

## Image Generation Setup
- Model: `imagen-4.0-fast-generate-001`
- Rate limit: max 10 req/min
- Key location: `/workspace/host/nanoclaw/.env` → `GEMINI_API_KEY`
- Scripts: `generate-science-images.mjs`, `generate-history-images.mjs` in `/workspace/host/YW_Core/`

## Still Pending
- Remaining inline figures across non-science articles — `gen_remaining.py` now exists at `/workspace/group/nightshift/gen_remaining.py` (created nightshift/2026-04-05). Run to scan and generate missing hero images.
- Some articles may still have missing local hero paths
