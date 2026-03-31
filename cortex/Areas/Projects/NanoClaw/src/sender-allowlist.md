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
source_hash: 25d77ab9dbd7571d9feef43232d8efda748d2ca014185626eec15de7dbefa6b1
embedding_model: text-embedding-3-small
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
