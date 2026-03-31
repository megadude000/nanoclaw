---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: src/webhook-router.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - webhook
created: '2026-03-31'
project: nanoclaw
source_hash: b0ab460d257738d2dd79cc6d13d3c97d361f3d51cc7f659c4350859cf751545e
embedding_model: text-embedding-3-small
---
# webhook-router.ts

> Webhook routing abstraction layer.

## Exports

### Functions

- `resolveTargets(webhookType: string, groups: Record<string, RegisteredGroup>,)` -- Resolve routing targets for a webhook type.

### Interfaces

- `RouteTarget`

### Types

- `RoutingConfig`

### Constants

- `RoutingConfigSchema`
