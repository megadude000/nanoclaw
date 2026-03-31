---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/container-runtime.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - container
created: '2026-03-31'
project: nanoclaw
source_hash: 5b70ebcce3170a3133d79d37b2eb5255934879b73af5a9060e748cf83b8ad388
embedding_model: text-embedding-3-small
---
# container-runtime.ts

> Container runtime abstraction for NanoClaw.

## Exports

### Functions

- `hostGatewayArgs()` -- CLI args needed for the container to resolve the host gateway.
- `readonlyMountArgs(hostPath: string, containerPath: string,)` -- Returns CLI args for a readonly bind mount.
- `stopContainer(name: string)` -- Stop a container by name. Uses execFileSync to avoid shell injection.
- `ensureContainerRuntimeRunning()` -- Ensure the container runtime is running, starting it if needed.
- `cleanupOrphans()` -- Kill orphaned NanoClaw containers from previous runs.

### Constants

- `CONTAINER_RUNTIME_BIN` -- The container runtime binary name.
- `PROXY_BIND_HOST` -- Host address that containers use to reach the credential proxy.
- `CONTAINER_HOST_GATEWAY` -- Hostname containers use to reach the host machine.

## Environment Variables

- `PROXY_BIND_HOST` -- referenced in this module
