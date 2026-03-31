---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: src/notion-webhook.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - webhook
created: '2026-03-31'
project: nanoclaw
source_hash: 7bdf72e1795228da0ec011081271621605d5ee4de6a226353be1607615f1a59c
embedding_model: text-embedding-3-small
---
# notion-webhook.ts

> Notion webhook handler.

## Exports

### Functions

- `handleNotionWebhook(req: IncomingMessage, res: ServerResponse, rawBody: Buffer, config: NotionHandlerConfig,)`

### Interfaces

- `NotionHandlerConfig`

## Environment Variables

- `NOTION_API_KEY` -- referenced in this module
