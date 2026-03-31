---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/agent-message-schema.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - core
created: '2026-03-31'
project: nanoclaw
source_hash: 130c83d7c76009f67a57e68c4bc309ca8dec8967291a65cac04e35f2fe595593
embedding_model: text-embedding-3-small
---
# agent-message-schema.ts

> Shared schema and helpers for #agents channel message metadata.

## Exports

### Functions

- `withAgentMeta(embed: EmbedBuilder, meta: AgentMessageMeta,)` -- Appends structured metadata fields to a Discord embed.

### Types

- `AgentMessageType`
- `AgentMessageMeta`

### Constants

- `AgentMessageTypeSchema` -- The 8 message types used in the #agents channel.
- `AgentMessageMetaSchema` -- Structured metadata for every #agents embed.
- `AGENT_COLORS: Record<AgentMessageType, number>` -- Color map for each AgentMessageType.
