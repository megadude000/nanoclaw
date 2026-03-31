---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/cortex/types.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - cortex
created: '2026-03-31'
project: nanoclaw
---
# types.ts

> Cortex Schema Types

## Exports

### Interfaces

- `CortexFrontmatter` -- Cortex frontmatter fields (after validation/inference)
- `ValidationResult` -- Result of validating frontmatter against the Cortex schema
- `InferredDefaults` -- Defaults inferred from file path and existing metadata
- `ParsedCortexEntry` -- A fully parsed Cortex entry (frontmatter + body + hash + validation)

### Types

- `CortexLevel` -- Knowledge pyramid level: L10 (file facts) to L50 (experiential)
- `Confidence` -- Confidence rating for a knowledge entry

### Constants

- `STALENESS_TTLS: Record<CortexLevel, number>` -- Staleness TTLs in days per knowledge pyramid level.
