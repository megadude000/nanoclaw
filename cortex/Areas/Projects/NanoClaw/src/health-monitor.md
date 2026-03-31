---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: src/health-monitor.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - health
created: '2026-03-31'
project: nanoclaw
---
# health-monitor.ts

> Health monitor core module.

## Exports

### Functions

- `execAsync(cmd: string, timeoutMs = 5000,)` -- Wraps child_process.exec in a Promise with a configurable timeout.
- `loadState(services: string[])` -- Load persisted service states from data/health-state.json.
- `saveState(stateMap: Map<string, ServiceState>)` -- Persist current service states to data/health-state.json.
- `buildServiceConfigs()` -- Build the list of services to monitor from environment variables.
- `runHealthCheck(services: ServiceConfig[], stateMap: Map<string, ServiceState>, sendEmbed: SendEmbedFn,)` -- Run one health check cycle across all services.
- `runHeartbeat(stateMap: Map<string, ServiceState>, services: ServiceConfig[], sendEmbed: SendEmbedFn,)` -- Post a heartbeat embed only when ALL services are up.
- `startHealthMonitor(sendEmbed: SendEmbedFn)` -- Start the health monitor polling loop.

### Interfaces

- `ServiceConfig`

## Environment Variables

- `CLOUDFLARE_TUNNEL_NAME` -- referenced in this module
- `HEALTH_CHECK_INTERVAL_MS` -- referenced in this module
- `HEALTH_MONITOR_SERVICES` -- referenced in this module
