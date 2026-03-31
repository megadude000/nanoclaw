---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/remote-control.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - core
created: '2026-03-31'
project: nanoclaw
source_hash: ac5108d56e2b211b6bf4326d2d0ef8a07d2330617832dd89be48afab4096f104
embedding_model: text-embedding-3-small
---
# remote-control.ts

> Exports from remote-control.ts

## Exports

### Functions

- `restoreRemoteControl()` -- Restore session from disk on startup.
- `getActiveSession()`
- `_resetForTesting()` -- @internal — exported for testing only
- `_getStateFilePath()` -- @internal — exported for testing only
- `startRemoteControl(sender: string, chatJid: string, cwd: string,)`
- `stopRemoteControl()`
