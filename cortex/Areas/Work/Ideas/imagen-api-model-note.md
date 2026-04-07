---
cortex_level: L10
confidence: high
domain: tooling
scope: image-generation
type: operational-note
tags:
  - imagen
  - gemini
  - api
  - image-generation
created: 2026-04-02T23:59:00.000Z
updated: 2026-04-02T23:59:00.000Z
source_hash: 2387c2fcd48252b278decb645e1ee132daa8cd4aaed5b99c17a6667ffb2bff65
embedding_model: text-embedding-3-small
---

# Imagen API — Working Model

`imagen-4.0-generate-preview-06-06` consistently returns **404** in production.

**Always use:** `imagen-4.0-fast-generate-001`

This model works reliably with the project GEMINI_API_KEY and produces high-quality results. Confirmed across 3 independent agents on nightshift/2026-04-02 (30 inline figures + 10 hero images all generated successfully via fast model).
