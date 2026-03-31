---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/agent-status-embeds.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - core
created: '2026-03-31'
project: nanoclaw
---
# agent-status-embeds.ts

> Agent status embed builders for #agents Discord channel.

## Exports

### Functions

- `buildTookEmbed(params: { title: string; taskId: string; agentName: string; description?: string; })` -- Build an embed for when an agent takes a task.
- `buildClosedEmbed(params: { title: string; taskId: string; agentName: string; prUrl?: string; summary?: string; })` -- Build an embed for when an agent closes a task.
- `buildProgressEmbed(params: { title: string; agentName: string; description: string; taskId?: string; summary?: string; })` -- Build an embed for agent progress updates.
- `buildBlockerEmbed(params: { blockerType: 'perm' | 'service' | 'conflict'; resource: string; description: string; agentName: string; taskId?: string; })` -- Build an embed for when an agent is blocked.
- `buildHandoffEmbed(params: { toAgent: string; what: string; why: string; agentName: string; taskId?: string; })` -- Build an embed for when an agent hands off work to another agent.
