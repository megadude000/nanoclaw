# Phase 3: Outbound Formatting - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Bot sends well-formatted messages to Discord including rich embeds, message editing, typing indicators, interactive buttons with callback handling, and file attachments. Also improves message chunking to be markdown-aware and adds cross-channel error feedback.

OUT-01 (sendMessage), OUT-02 (basic chunking), and OUT-05 (typing indicator) are already implemented from Phase 1. This phase enhances chunking quality and adds OUT-03 (embeds), OUT-04 (editMessage), OUT-06 (sendWithButtons + callbacks), plus sendPhoto and sendMessageRaw.

</domain>

<decisions>
## Implementation Decisions

### Embed Styling
- **D-01:** Color-coded embeds by notification source — red for bugs, blue for tasks, green for progress, orange for alerts
- **D-02:** Consistent embed field layout: title, description, inline fields, footer with timestamp
- **D-03:** Type-specific embed builder helpers: `buildBugEmbed(issue)`, `buildTaskEmbed(task)`, `buildProgressEmbed(data)` — each knows its color, fields, and layout

### Message Chunking
- **D-04:** Markdown-aware splitting — respect code fences, bullet lists, and headers when splitting at 2000-char Discord limit
- **D-05:** Falls back to line-break split if no markdown boundary found, then hard split as last resort

### Button Callbacks
- **D-06:** Full button implementation — send buttons via `sendWithButtons` AND handle `interactionCreate` events for button click callbacks
- **D-07:** Button clicks route back to the agent for processing

### editMessage
- **D-08:** Add `editMessage?(jid: string, messageId: string, text: string): Promise<void>` as optional method on Channel interface in types.ts
- **D-09:** Discord implements editMessage using discord.js `message.edit()` — needed for progress tracker updates (Phase 6)

### sendMessageRaw
- **D-10:** Add `sendMessageRaw?(jid: string, text: string): Promise<{message_id: string}>` to Channel interface — returns message ID for edit/button tracking
- **D-11:** Keeps `sendMessage` backward-compatible (void return) — CLAUDE.md already documents this pattern

### Error Feedback
- **D-12:** When outbound operations fail (sendMessage, editMessage, etc.), send an error notification to the originating chat (e.g., Telegram) rather than silent logging only
- **D-13:** Requires knowing the originating JID context — router must pass origin info for cross-channel error reporting

### sendPhoto
- **D-14:** Discord implements `sendPhoto` in this phase using `channel.send({files: [path], content: caption})`
- **D-15:** Completes the Channel interface methods for Discord in one phase

### Claude's Discretion
- Exact embed color hex values
- Error message format and wording
- Internal chunking algorithm implementation details
- Button component styling (primary/secondary/danger variants)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Discord Integration
- `CLAUDE.md` — Integration pattern table with discord.js equivalents for each Channel method
- `CLAUDE.md` §Technology Stack — Message limits (2000 chars), embed limits (10 per message, 6000 total chars)

### Channel Architecture
- `src/types.ts` — Channel interface definition (lines 82-99)
- `src/router.ts` — `formatOutbound()`, `routeOutbound()`, `findChannel()` functions
- `src/channels/discord.ts` — Current Discord implementation (sendMessage with basic chunking, setTyping)

### Existing Patterns
- `src/channels/discord.test.ts` — 42 existing tests, test patterns for mocking discord.js

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sendMessage` (discord.ts:209-238): Already has basic 2000-char chunking — enhance, don't replace
- `setTyping` (discord.ts:257-268): Already implemented for OUT-05
- `formatOutbound` (router.ts:31-35): Strips `<internal>` tags — outbound formatting pipeline entry point
- `routeOutbound` (router.ts:37-45): Routes to channel by JID — needs origin context for error feedback

### Established Patterns
- Channel methods are optional via `?` suffix in interface (sendPhoto, reactToMessage, sendWithButtons)
- JID prefix routing: `dc:` for Discord, `tg:` for Telegram
- Pino logger used consistently for error/info/debug levels
- Channel self-registration via `registerChannel()` factory pattern

### Integration Points
- `routeOutbound()` is the main outbound call site — error feedback hooks here
- `Channel` interface in types.ts is the contract — editMessage and sendMessageRaw added here
- discord.js `EmbedBuilder` for rich embeds, `ActionRowBuilder` + `ButtonBuilder` for buttons
- discord.js `Events.InteractionCreate` for button callback handling

</code_context>

<specifics>
## Specific Ideas

- Bug embeds: red color bar, emoji prefix, reporter/priority/labels as inline fields, GitHub link in footer
- Progress embeds: green color, percentage bar in description, phase/plan details as fields
- Task embeds: blue color, status/assignee/due date as fields, Notion link in footer

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-outbound-formatting*
*Context gathered: 2026-03-26*
