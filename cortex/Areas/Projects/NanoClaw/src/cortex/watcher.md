---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: src/cortex/watcher.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - cortex
created: '2026-03-31'
project: nanoclaw
---
# watcher.ts

> Cortex File System Watcher

## Exports

### Functions

- `getInFlightFiles()` -- @internal - exported for testing only
- `startCortexWatcher(cortexDir: string)` -- Start the cortex file system watcher (per D-04, called from main() in index.ts).
- `stopCortexWatcher()` -- Stop the cortex watcher and clean up all state.

### Constants

- `DEBOUNCE_MS` -- Debounce interval in milliseconds (10 minutes per D-01).
