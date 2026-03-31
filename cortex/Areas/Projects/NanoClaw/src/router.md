---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/router.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - core
created: '2026-03-31'
project: nanoclaw
source_hash: 3b0663cc0901be059eb5a37cbba2f7a1520107da3c4d17aada75920d5fda88fa
embedding_model: text-embedding-3-small
---
# router.ts

> Exports from router.ts

## Exports

### Functions

- `escapeXml(s: string)`
- `formatMessages(messages: NewMessage[], timezone: string,)`
- `stripInternalTags(text: string)`
- `formatOutbound(rawText: string)`
- `routeOutbound(channels: Channel[], jid: string, text: string, originJid?: string,)`
- `findChannel(channels: Channel[], jid: string,)`
