---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/cortex/schema.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - cortex
created: '2026-03-31'
project: nanoclaw
source_hash: be13437a06f339b00065d37dedbed7843bad8e5aeba1ac27fbf59417c40023e4
embedding_model: text-embedding-3-small
---
# schema.ts

> Cortex Schema Validation

## Exports

### Functions

- `inferDefaults(filePath: string, existingMeta: Record<string, unknown>,)` -- Infer sensible defaults for missing Cortex fields from file path and
- `validateFrontmatter(raw: Record<string, unknown>, filePath: string, mode: 'strict' | 'permissive' = 'permissive',)` -- Validate frontmatter against the Cortex schema.

### Constants

- `CortexLevelSchema` -- Knowledge pyramid levels
- `ConfidenceSchema` -- Confidence ratings
- `CortexFieldsStrict` -- Core Cortex fields -- all required for strict (new writes)
- `EmbeddingMeta` -- Embedding metadata -- optional until embedding pipeline runs
- `ExistingFields` -- Existing vault fields preserved as-is.
- `CortexFrontmatterStrict` -- Full strict schema: all Cortex fields required.
- `CortexFrontmatterPermissive` -- Permissive schema: Cortex fields optional, defaults applied externally.
