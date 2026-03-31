---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/cortex/qdrant-client.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - cortex
created: '2026-03-31'
project: nanoclaw
---
# qdrant-client.ts

> Qdrant Client Factory

## Exports

### Functions

- `createQdrantClient()` -- Create a new QdrantClient configured for localhost:6333.
- `checkQdrantHealth(client: QdrantClient)` -- Check if Qdrant is reachable by attempting to list collections.

### Constants

- `COLLECTION_NAME` -- Name of the Qdrant collection that stores Cortex vectors (Phase 15).
