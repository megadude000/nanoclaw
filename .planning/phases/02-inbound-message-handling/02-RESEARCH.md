# Phase 2: Inbound Message Handling - Research

**Researched:** 2026-03-26
**Domain:** Discord inbound message processing via discord.js v14 + NanoClaw channel abstraction
**Confidence:** HIGH

## Summary

The Phase 1 merge from `nanoclaw-discord` remote brought in a nearly complete inbound message handler. The current `discord.ts` already handles text messages (IN-01), @mention translation (IN-02), attachment descriptions (IN-04), and partial reply context (IN-03). The trigger-pattern logic for main vs non-main channels (IN-05) lives in `index.ts` and is channel-agnostic -- it already works for Discord channels.

The only meaningful gap is **IN-03: reply context should include an original message preview** (currently only includes the reply author name, not a snippet of what they said). Additionally, there is no original message content snippet in the reply context -- just `[Reply to Bob]` rather than `[Reply to Bob: "the original text snippet"] `.

**Primary recommendation:** This phase requires minimal new code. Add reply message preview to IN-03, verify IN-05 works end-to-end with a registered Discord main group, and ensure comprehensive test coverage for all five requirements.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IN-01 | Bot receives text messages in registered Discord channels | Already implemented: `Events.MessageCreate` handler in discord.ts lines 48-169. Calls `opts.onMessage()` for registered channels. Tests exist. |
| IN-02 | Bot translates Discord @mentions to NanoClaw trigger pattern (`@Andy`) | Already implemented: discord.ts lines 76-93. Strips `<@botId>`, prepends `@Andy`. Tests cover `<@id>` and `<@!id>` formats. |
| IN-03 | Bot extracts reply context (who user is replying to, original message preview) | Partially implemented: discord.ts lines 119-132. Has reply author but NO message preview/snippet. Needs enhancement to include truncated original message text. |
| IN-04 | Bot handles attachment descriptions (images, files shown as metadata) | Already implemented: discord.ts lines 96-116. Maps contentType to `[Image:]`, `[Video:]`, `[Audio:]`, `[File:]` placeholders. Tests cover all types + multiple attachments. |
| IN-05 | Bot respects trigger pattern for non-main channels, responds to all in main | Already implemented in index.ts (channel-agnostic): lines 180-189 (processGroupMessages) and 432-447 (startMessageLoop). Main groups skip trigger check, non-main groups require TRIGGER_PATTERN match. Works for any `dc:` JID. No Discord-specific code needed. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech Stack**: discord.js v14, Node.js, TypeScript
- **Architecture**: Must follow existing channel registry pattern (`registerChannel`)
- **IPC Compatibility**: Discord channels work with existing IPC file-based messaging
- **Existing Code**: Must not break Telegram integration
- **Platform**: Linux (systemd)
- **GSD Workflow**: Use GSD commands for all code changes

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | ^14.25.1 | Discord API client | Already installed from Phase 1. Provides `Events.MessageCreate`, `Message` type, mentions API, attachment API, message reference API. |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 | Test framework | All unit tests for inbound message handling |
| pino | ^9.6.0 | Logging | Debug/info logging for message receipt |

No new packages needed for this phase.

## Architecture Patterns

### Current Message Flow (already working)
```
Discord user sends message
  -> discord.js gateway fires Events.MessageCreate
  -> DiscordChannel.connect() handler (discord.ts line 48)
    -> Ignore bot messages (line 50)
    -> Build chatJid = `dc:{channelId}` (line 53)
    -> Translate @mention to trigger (lines 76-93)
    -> Append attachment placeholders (lines 96-116)
    -> Add reply context prefix (lines 119-132)
    -> Call onChatMetadata() (line 136)
    -> Check registeredGroups[chatJid] (line 145)
    -> Call onMessage() with NewMessage (line 155)
  -> index.ts storeMessage() stores in SQLite (line 631)
  -> startMessageLoop() polls every 2s (line 484)
    -> getNewMessages() from DB
    -> Check trigger pattern (main groups skip, non-main require)
    -> processGroupMessages() -> runAgent() -> container
    -> Agent response -> channel.sendMessage()
```

### Reply Context Enhancement Pattern
The current implementation at lines 119-132:
```typescript
// Current: only author name
content = `[Reply to ${replyAuthor}] ${content}`;

// Enhanced: include message preview (truncated)
const preview = repliedTo.content?.slice(0, 100) || '';
const suffix = repliedTo.content && repliedTo.content.length > 100 ? '...' : '';
content = `[Reply to ${replyAuthor}: "${preview}${suffix}"] ${content}`;
```

This follows the same pattern Telegram uses for providing reply context to the agent. The truncation at 100 chars prevents bloating the prompt with long quoted messages.

### Anti-Patterns to Avoid
- **Do not add Discord-specific trigger logic**: IN-05 is already handled channel-agnostically in index.ts. Adding duplicate logic in discord.ts would create divergence.
- **Do not fetch full message history for replies**: Only fetch the single referenced message. Fetching threads or chains is unnecessary and rate-limit-risky.
- **Do not download Discord attachments**: Unlike Telegram (which downloads photos/PDFs to local paths), Discord attachments are accessible via URL. The current placeholder approach (`[Image: name]`) is correct per IN-04 spec ("metadata description").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mention detection | Regex parsing of `<@id>` from raw content | `message.mentions.users.has(botId)` | discord.js already parses mentions; the raw content check is a fallback only |
| Reply message fetch | Custom caching of replied-to messages | `message.channel.messages.fetch(messageId)` | discord.js handles caching and API calls; single fetch is sufficient |
| Attachment type detection | Manual MIME parsing | `attachment.contentType` property | discord.js provides parsed content type from Discord API |

## Common Pitfalls

### Pitfall 1: Reply fetch can fail silently
**What goes wrong:** The referenced message may have been deleted, or the bot may lack permission to read message history in that channel.
**Why it happens:** Discord channels can have `ReadMessageHistory` permission disabled for the bot role.
**How to avoid:** The current try/catch at lines 129-131 already handles this gracefully. Ensure the enhanced version maintains this pattern.
**Warning signs:** Reply context silently missing from agent prompts.

### Pitfall 2: Mention stripping leaves extra whitespace
**What goes wrong:** After stripping `<@botId>` from content, there may be leading/trailing spaces or double spaces.
**Why it happens:** The mention could be at the start, middle, or end of the message.
**How to avoid:** The current `.trim()` at line 87 handles leading/trailing. Consider also normalizing internal double spaces.
**Warning signs:** Agent sees messages with awkward spacing like `"@Andy  what is this"`.

### Pitfall 3: Assuming IN-05 needs Discord-specific code
**What goes wrong:** Implementer adds main-channel detection logic inside discord.ts MessageCreate handler.
**Why it happens:** The requirement says "responds to all in main" which sounds Discord-specific.
**How to avoid:** Understand that index.ts already implements this: `isMainGroup` check at line 169/432 skips trigger requirement. The Discord channel just delivers messages; index.ts decides whether to process them based on group registration.
**Warning signs:** Duplicate trigger logic in discord.ts.

### Pitfall 4: Rate limiting on reply message fetches
**What goes wrong:** High-traffic channels cause many `messages.fetch()` calls, hitting Discord API rate limits.
**Why it happens:** Every reply message triggers an API call to fetch the referenced message.
**How to avoid:** discord.js has built-in rate limit handling with queuing. For a private bot with single user, this is not a practical concern. No additional caching needed.
**Warning signs:** 429 responses in logs (discord.js handles retries automatically).

## Code Examples

### Enhanced Reply Context (IN-03 gap fix)
```typescript
// Source: current discord.ts lines 119-132, enhanced
if (message.reference?.messageId) {
  try {
    const repliedTo = await message.channel.messages.fetch(
      message.reference.messageId,
    );
    const replyAuthor =
      repliedTo.member?.displayName ||
      repliedTo.author.displayName ||
      repliedTo.author.username;
    // Include truncated preview of original message
    const preview = repliedTo.content
      ? repliedTo.content.slice(0, 100) +
        (repliedTo.content.length > 100 ? '...' : '')
      : '';
    const previewPart = preview ? `: "${preview}"` : '';
    content = `[Reply to ${replyAuthor}${previewPart}] ${content}`;
  } catch {
    // Referenced message may have been deleted
  }
}
```

### Test Pattern for Reply Preview
```typescript
// Source: existing test pattern from discord.test.ts, extended
it('includes reply message preview in content', async () => {
  const opts = createTestOpts();
  const channel = new DiscordChannel('test-token', opts);
  await channel.connect();

  // The mock at createMessage line 171 returns author 'Bob'
  // Need to also mock content on the fetched message
  const msg = createMessage({
    content: 'I agree',
    reference: { messageId: 'original_msg_id' },
    guildName: 'Server',
  });
  // Override the channel.messages.fetch mock to include content
  msg.channel.messages.fetch = vi.fn().mockResolvedValue({
    author: { username: 'Bob', displayName: 'Bob' },
    member: { displayName: 'Bob' },
    content: 'The original message text here',
  });
  await triggerMessage(msg);

  expect(opts.onMessage).toHaveBeenCalledWith(
    'dc:1234567890123456',
    expect.objectContaining({
      content: '[Reply to Bob: "The original message text here"] I agree',
    }),
  );
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest v4.0.18 |
| Config file | vitest inferred from package.json |
| Quick run command | `npx vitest run src/channels/discord.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IN-01 | Receives text messages in registered channels | unit | `npx vitest run src/channels/discord.test.ts -t "delivers message for registered channel"` | Exists |
| IN-01 | Ignores messages from unregistered channels | unit | `npx vitest run src/channels/discord.test.ts -t "only emits metadata for unregistered"` | Exists |
| IN-01 | Ignores bot messages | unit | `npx vitest run src/channels/discord.test.ts -t "ignores bot messages"` | Exists |
| IN-02 | Translates `<@botId>` to `@Andy` prefix | unit | `npx vitest run src/channels/discord.test.ts -t "translates.*mention to trigger"` | Exists |
| IN-02 | Handles `<@!botId>` nickname mention | unit | `npx vitest run src/channels/discord.test.ts -t "nickname mention"` | Exists |
| IN-02 | Does not double-prepend trigger | unit | `npx vitest run src/channels/discord.test.ts -t "does not translate if message already"` | Exists |
| IN-03 | Includes reply author in content | unit | `npx vitest run src/channels/discord.test.ts -t "includes reply author"` | Exists |
| IN-03 | Includes original message preview | unit | `npx vitest run src/channels/discord.test.ts -t "reply message preview"` | Wave 0 |
| IN-03 | Handles deleted referenced message gracefully | unit | `npx vitest run src/channels/discord.test.ts -t "deleted referenced"` | Wave 0 |
| IN-04 | Image attachment placeholder | unit | `npx vitest run src/channels/discord.test.ts -t "stores image attachment"` | Exists |
| IN-04 | Video attachment placeholder | unit | `npx vitest run src/channels/discord.test.ts -t "stores video attachment"` | Exists |
| IN-04 | File attachment placeholder | unit | `npx vitest run src/channels/discord.test.ts -t "stores file attachment"` | Exists |
| IN-04 | Multiple attachments | unit | `npx vitest run src/channels/discord.test.ts -t "handles multiple attachments"` | Exists |
| IN-05 | Main group skips trigger, non-main requires trigger | unit | manual-only (logic is in index.ts, tested via integration) | Manual verification |

### Sampling Rate
- **Per task commit:** `npx vitest run src/channels/discord.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/channels/discord.test.ts` -- add test for reply message preview content (IN-03)
- [ ] `src/channels/discord.test.ts` -- add test for deleted referenced message fallback (IN-03)
- [ ] `src/channels/discord.test.ts` -- add test for reply to message with no text content (IN-03 edge case)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate inbound handler file | Inline in `connect()` method | Phase 1 merge | All message handling is in the single `MessageCreate` event handler |
| Channel-specific trigger logic | Channel-agnostic trigger in index.ts | Existing design | Discord needs no trigger-specific code; index.ts handles main vs non-main |

## Open Questions

1. **Reply preview length limit**
   - What we know: Telegram does not include reply previews (just sender name). Discord's reply context is richer.
   - What's unclear: Whether 100 chars is the right truncation length for the agent prompt.
   - Recommendation: Start with 100 chars (roughly 1-2 sentences). Adjust based on agent feedback.

2. **Attachment URLs vs metadata-only**
   - What we know: IN-04 says "metadata description". Current implementation uses `[Image: filename]` placeholders.
   - What's unclear: Whether the agent should also receive the Discord CDN URL for attachments (e.g., for image analysis).
   - Recommendation: Keep metadata-only for now (matches IN-04 spec). URL inclusion is a future enhancement if agents need to fetch/analyze files.

## Sources

### Primary (HIGH confidence)
- `src/channels/discord.ts` -- current implementation (merged from nanoclaw-discord in Phase 1)
- `src/channels/discord.test.ts` -- existing test suite (38 tests covering IN-01, IN-02, IN-03 partial, IN-04)
- `src/index.ts` -- message loop and trigger logic (IN-05)
- `src/types.ts` -- Channel interface and NewMessage type
- `src/config.ts` -- TRIGGER_PATTERN definition

### Secondary (MEDIUM confidence)
- `src/channels/telegram.ts` -- reference implementation showing similar patterns for reply context, attachments, trigger translation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - discord.js v14 already installed and working
- Architecture: HIGH - all patterns visible in existing code, minimal changes needed
- Pitfalls: HIGH - based on direct code analysis, not theoretical
- Gap analysis: HIGH - line-by-line comparison of requirements vs implementation

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- no moving parts, discord.js v14 is mature)
