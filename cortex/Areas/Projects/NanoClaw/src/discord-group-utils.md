---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/discord-group-utils.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - discord
created: '2026-03-31'
project: nanoclaw
---
# discord-group-utils.ts

> Exports from discord-group-utils.ts

## Exports

### Functions

- `sanitizeDiscordChannelName(channelName: string)` -- Sanitize a Discord channel name into a valid group folder name.
- `sanitizeWithCollisionCheck(channelName: string, channelId: string, existingFolders: Set<string>,)` -- Sanitize with collision detection: if the base name already exists,
- `createGroupStub(channelName: string, isMain: boolean)` -- Create a CLAUDE.md for a new Discord group folder.
