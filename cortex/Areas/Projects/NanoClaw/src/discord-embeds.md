---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/discord-embeds.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - discord
created: '2026-03-31'
project: nanoclaw
source_hash: 6c77e431dab3d93624fffd7eb1f86922a023c4ae65ca8d73975a0c35d2b249ea
embedding_model: text-embedding-3-small
---
# discord-embeds.ts

> Discord embed builder helpers for NanoClaw notifications.

## Exports

### Functions

- `buildBugEmbed(issue: { title: string; body?: string; reporter?: string; priority?: string; labels?: string[]; url?: string; })`
- `buildTaskEmbed(task: { title: string; description?: string; status?: string; assignee?: string; dueDate?: string; url?: string; })`
- `buildProgressEmbed(data: { phase?: string; plan?: string; percent?: number; description?: string; details?: string; })`

### Constants

- `COLORS`
