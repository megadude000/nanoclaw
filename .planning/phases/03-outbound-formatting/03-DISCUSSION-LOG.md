# Phase 3: Outbound Formatting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 03-outbound-formatting
**Areas discussed:** Embed styling, Message chunking, Button callbacks, editMessage scope, sendMessageRaw return, Embed builder helpers, Error feedback, sendPhoto for Discord

---

## Embed Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded by source | Red=bugs, blue=tasks, green=progress, orange=alerts. Consistent field layout. | ✓ |
| Minimal text-only | Skip embeds, use markdown text with emoji prefixes. | |
| Hybrid approach | Embeds for structured data, plain text for conversational responses. | |

**User's choice:** Color-coded by source
**Notes:** User selected with preview showing bug report embed structure.

---

## Message Chunking

| Option | Description | Selected |
|--------|-------------|----------|
| Smart line-break split | Split at last newline before 2000 chars. | |
| Markdown-aware split | Respect code fences, bullet lists, headers. | ✓ |
| Keep current (hard split) | Split at exactly 2000 chars. | |

**User's choice:** Markdown-aware split
**Notes:** None

---

## Button Callbacks

| Option | Description | Selected |
|--------|-------------|----------|
| Send + handle callbacks | Implement both sending and interactionCreate handling. | ✓ |
| Send only, defer callbacks | Just display buttons, handle clicks later. | |
| You decide | Claude's discretion. | |

**User's choice:** Send + handle callbacks
**Notes:** None

---

## editMessage Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Add to Channel interface | Optional editMessage in types.ts. Telegram already supports it. | ✓ |
| Discord-only for now | Implement only on DiscordChannel class. | |
| You decide | Claude's discretion. | |

**User's choice:** Add to Channel interface
**Notes:** None

---

## sendMessageRaw Return

| Option | Description | Selected |
|--------|-------------|----------|
| Add sendMessageRaw | New method returning {message_id}. Keeps sendMessage backward-compatible. | ✓ |
| Change sendMessage return | Change sendMessage to return {message_id?}. Breaking change. | |
| You decide | Claude's discretion. | |

**User's choice:** Add sendMessageRaw
**Notes:** CLAUDE.md already documents this pattern.

---

## Embed Builder Helpers

| Option | Description | Selected |
|--------|-------------|----------|
| Type-specific helpers | buildBugEmbed, buildTaskEmbed, buildProgressEmbed. Each knows its layout. | ✓ |
| Generic builder | buildEmbed({color, title, fields, footer}). Flexible but callers need structure knowledge. | |
| Both layers | Generic base + type-specific wrappers. | |

**User's choice:** Type-specific helpers
**Notes:** None

---

## Error Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Silent log only | Log with pino, don't notify users. | |
| Error in originating chat | Send error notification to originating channel (e.g., Telegram). | ✓ |
| You decide | Claude's discretion. | |

**User's choice:** Error in originating chat
**Notes:** Adds cross-channel error routing. Router must pass origin JID context.

---

## sendPhoto for Discord

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, implement now | Straightforward via channel.send({files: [path]}). | ✓ |
| Defer to later | Focus on embeds/buttons/edit only. | |
| You decide | Claude's discretion. | |

**User's choice:** Yes, implement now
**Notes:** Completes Channel interface methods for Discord in one phase.

---

## Claude's Discretion

- Exact embed color hex values
- Error message format and wording
- Internal chunking algorithm details
- Button component styling variants

## Deferred Ideas

None — discussion stayed within phase scope
