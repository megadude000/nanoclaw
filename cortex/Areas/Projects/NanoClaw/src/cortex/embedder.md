---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: src/cortex/embedder.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - cortex
created: '2026-03-31'
project: nanoclaw
---
# embedder.ts

> Cortex Embedder — Shared Embedding Pipeline

## Exports

### Functions

- `createOpenAIClient()` -- Create an OpenAI client by reading OPENAI_API_KEY from .env (D-05).
- `deterministicId(filePath: string)` -- Produce a stable UUID-formatted point ID from a Cortex file path.
- `updateFrontmatter(filePath: string, updates: Record<string, string>,)` -- Write key-value pairs into a file's YAML frontmatter without disturbing body
- `embedEntry(filePath: string, openai: OpenAI, qdrant: QdrantClient, options?: { force?: boolean },)` -- Embed a single Cortex entry into the Qdrant vector collection.

### Interfaces

- `EmbedResult` -- Result returned by embedEntry() for each file processed.

### Constants

- `EMBEDDING_MODEL` -- OpenAI embedding model — locked from Phase 15 (1536 dims, $0.02/1M tokens).
- `MIN_CONTENT_LENGTH` -- Minimum body content length to consider for embedding (Pitfall 3).
