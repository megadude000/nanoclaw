---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/health-monitor-embeds.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - health
created: '2026-03-31'
project: nanoclaw
source_hash: b2342c1a76994bc70f7bb789562f166d0a2620cc71f941d7991be176a946ca2c
embedding_model: text-embedding-3-small
---
# health-monitor-embeds.ts

> Discord embed builder helpers for health monitor notifications.

## Exports

### Functions

- `buildDownEmbed(service: string, errorSnippet?: string,)` -- Build a RED embed for when a service goes down.
- `buildUpEmbed(service: string)` -- Build a GREEN embed for when a service recovers.
- `buildHeartbeatEmbed(services: string[])` -- Build a GREY heartbeat embed listing all services as operational.

### Constants

- `HEALTH_COLORS`
