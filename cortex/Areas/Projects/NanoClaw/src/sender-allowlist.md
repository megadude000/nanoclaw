---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/sender-allowlist.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - core
created: '2026-03-31'
project: nanoclaw
---
# sender-allowlist.ts

> Exports from sender-allowlist.ts

## Exports

### Functions

- `loadSenderAllowlist(pathOverride?: string,)`
- `isSenderAllowed(chatJid: string, sender: string, cfg: SenderAllowlistConfig,)`
- `shouldDropMessage(chatJid: string, cfg: SenderAllowlistConfig,)`
- `isTriggerAllowed(chatJid: string, sender: string, cfg: SenderAllowlistConfig,)`

### Interfaces

- `ChatAllowlistEntry`
- `SenderAllowlistConfig`
