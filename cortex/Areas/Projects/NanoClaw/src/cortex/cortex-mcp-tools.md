---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/cortex/cortex-mcp-tools.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - cortex
created: '2026-03-31'
project: nanoclaw
source_hash: 951b8c0f1dba1254b92e5367867833f2b7beebff47bb32d7f14c0f403a7d3aed
embedding_model: text-embedding-3-small
---
# cortex-mcp-tools.ts

> Cortex MCP tool logic functions.

## Exports

### Functions

- `isVaultPath(query: string)` -- Returns true if the query looks like an exact vault path (route to file read),
- `checkConfidenceFirewall(level: string, domain: string, qdrant: QdrantClient,)` -- Checks whether writing a Cortex entry at `level` for `domain` is allowed.
- `buildSearchHandler({ qdrant, openai, vaultRoot, }: { qdrant: QdrantClient; openai: OpenAI; vaultRoot: string; })` -- Factory for the cortex_search handler.
- `buildReadHandler({ vaultRoot }: { vaultRoot: string })` -- Factory for the cortex_read handler.
- `buildWriteHandler({ qdrant, writeIpc, vaultRoot: _vaultRoot, }: { qdrant: QdrantClient; writeIpc: (data: object)` -- Factory for the cortex_write handler.
