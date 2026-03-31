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
