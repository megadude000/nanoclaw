---
phase: 03-outbound-formatting
plan: 02
subsystem: messaging
tags: [discord, outbound, editMessage, sendPhoto, buttons, chunker, router, error-feedback]
dependency_graph:
  requires: [03-01]
  provides: [discord-outbound-methods, router-error-feedback]
  affects: [src/channels/discord.ts, src/router.ts]
tech_stack:
  added: []
  patterns: [markdown-aware-chunking, button-interaction-routing, cross-channel-error-feedback]
key_files:
  created: []
  modified: [src/channels/discord.ts, src/channels/discord.test.ts, src/router.ts]
decisions:
  - Used ASSISTANT_NAME from config for button interaction trigger format
  - Button clicks route as synthetic messages with [button:customId] content
  - Router originJid is optional for backward compatibility
metrics:
  duration: 3min
  completed: "2026-03-26T17:49:00Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 20
  tests_total: 60
---

# Phase 03 Plan 02: Discord Outbound Methods and Router Error Feedback Summary

Full Discord outbound capability with markdown-aware chunking, message editing, photo sending, button interactions, and cross-channel router error feedback.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Discord outbound methods + interaction handler | 86741fd | editMessage, sendMessageRaw, sendPhoto, sendWithButtons, interactionCreate handler, chunker integration |
| 2 | Router error feedback with origin JID | f3fcefa | Optional originJid param, cross-channel error notification, infinite loop prevention |

## Implementation Details

### Task 1: Discord Outbound Methods

- **sendMessage**: Replaced naive 2000-char slicing with `chunkMessage()` from `discord-chunker.ts` for markdown-aware splitting at code fence, paragraph, and newline boundaries
- **editMessage**: Fetches channel and message by ID, calls `message.edit(text)`
- **sendMessageRaw**: Sends single message (truncated to 2000 chars), returns `{ message_id }` for later editing
- **sendPhoto**: Sends file attachment with optional caption via `channel.send({ files, content })`
- **sendWithButtons**: Creates `ActionRowBuilder<ButtonBuilder>` components with configurable row size (default 5)
- **interactionCreate handler**: Registered in `connect()`, defers button updates, routes clicks as `@Andy [button:customId]` messages via `onMessage` callback
- **Tests**: 20 new tests covering all methods + interaction handler (60 total, all pass)

### Task 2: Router Error Feedback

- Added optional `originJid` parameter to `routeOutbound` (backward-compatible)
- When target channel not found: notifies origin channel with `[Error] Failed to deliver message to {jid}`
- When send fails: notifies origin channel with error details
- Nested try/catch prevents infinite error loops
- No type errors in router.ts; pre-existing failures in unrelated files

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all methods are fully wired to discord.js APIs.

## Self-Check: PASSED
