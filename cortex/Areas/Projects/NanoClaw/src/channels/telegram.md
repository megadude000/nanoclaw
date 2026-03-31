---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/channels/telegram.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - channel
created: '2026-03-31'
project: nanoclaw
source_hash: f84f223eb93b9681ae4f9d6e24e9d26aa26a3a22a5e2d643137aaa4cb56eb6b8
embedding_model: text-embedding-3-small
---
# telegram.ts

> Exports from telegram.ts

## Exports

### Functions

- `initBotPool(tokens: string[])` -- Initialize send-only Api instances for the bot pool.
- `sendPoolMessage(chatId: string, text: string, sender: string, groupFolder: string,)` -- Send a message via a pool bot assigned to the given sender name.

### Interfaces

- `TelegramChannelOpts`

### Classes

- `TelegramChannel`

## Environment Variables

- `TELEGRAM_BOT_TOKEN` -- referenced in this module
