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
