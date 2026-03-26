# Domain Pitfalls: Discord Integration for NanoClaw

**Domain:** Multi-channel bot system -- adding Discord to existing Telegram-based assistant
**Researched:** 2026-03-26
**Confidence:** HIGH (verified against Discord API docs, discord.js guide, and NanoClaw source code)

## Critical Pitfalls

Mistakes that cause rewrites, broken integrations, or data loss.

### Pitfall 1: Missing or Wrong Gateway Intents (Silent Deafness)

**What goes wrong:** Bot connects to Discord but receives zero message events, or receives message events with empty `message.content`. No errors thrown -- it just silently ignores all messages. Developers waste hours debugging "why isn't my event handler firing?" when the real cause is a missing `GatewayIntentBits` flag.

**Why it happens:** Discord.js v14 requires explicit intent declaration via `GatewayIntentBits`. Unlike Telegram (where the bot receives all messages sent to it by default), Discord sends NOTHING unless you opt in per event category. The `MessageContent` intent is privileged -- it must be enabled both in code AND in the Discord Developer Portal toggle.

**Consequences:** Bot appears online but is completely deaf. Webhook routing works (webhooks bypass the gateway) but interactive responses in channels fail silently.

**Prevention:**
- Declare all required intents upfront: `Guilds`, `GuildMessages`, `MessageContent`, `GuildMembers`.
- Enable `MESSAGE_CONTENT` privileged intent in Discord Developer Portal before first deploy.
- Add a startup validation that logs which intents are active and warns if `MessageContent` is missing.
- Write a simple "echo" test that proves message content is received before building anything else.

**Detection:** Bot is online (green dot) but never responds. Or: `messageCreate` fires but `message.content === ''`.

**Phase:** Must be addressed in Phase 1 (basic Discord connection). Gate all subsequent phases on this working.

---

### Pitfall 2: Hardcoded mainJid Routing in Webhook Handlers

**What goes wrong:** All webhook handlers (GitHub Issues, Notion, bug reports) currently find the `mainEntry` from registered groups and route exclusively to `mainJid` -- which is `tg:633706070`. Adding Discord channels does NOT automatically route anything to them. Developers assume "register the Discord channel as a group and webhooks will find it" -- they will not.

**Why it happens:** The webhook handlers in `github-issues-webhook.ts`, `notion-webhook.ts`, and `bugreport-webhook.ts` all use a `mainEntry` lookup that returns exactly ONE group. The routing logic is: find main group, send to its JID. There is no concept of "route GitHub Issues to `dc:bugs-channel-id` AND `tg:main`."

**Consequences:** After adding Discord, all notifications still go only to Telegram. Dual-send requires explicit routing changes in every webhook handler. This is the number one migration blocker and the most likely cause of "Discord works but nothing shows up in it."

**Prevention:**
- Design a routing table early: `{ "github-issues": ["tg:633706070", "dc:<bugs-channel-id>"], "notion": ["tg:633706070", "dc:<yw-tasks-id>"] }`.
- Implement the routing abstraction BEFORE wiring up individual Discord channels.
- Make dual-send the default during migration, with per-source toggle to disable Telegram once Discord is confirmed working.
- Do NOT modify existing webhook handlers inline -- create a routing layer that wraps them.

**Detection:** After Discord setup, check: "Does #bugs receive GitHub issue notifications?" If not, routing layer is missing.

**Phase:** Must be designed in Phase 2-3 (routing architecture), implemented before Phase 5+ (webhook wiring).

---

### Pitfall 3: Message Edit Rate Limits Breaking Progress Tracker

**What goes wrong:** The progress tracker uses live message editing to show real-time status updates. Discord's message edit rate limit is 5 edits per 5 seconds per channel (roughly 1/sec). If the progress tracker fires updates more frequently, edits get queued or the bot gets rate-limited, causing cascading delays across ALL Discord API calls on that route bucket.

**Why it happens:** Telegram's edit rate limits are more generous and the current progress tracker was designed for Telegram's behavior. Discord rate limits are strict and per-route -- meaning editing messages in #progress can delay sending messages in other channels if they share the same route bucket.

**Consequences:** Progress updates stall, then burst-catch-up with stale data. In worst case, rate limiting cascades to other channels causing delayed notifications everywhere.

**Prevention:**
- Buffer progress updates: collect changes for 2-3 seconds, then send one edit with consolidated state.
- Use discord.js's built-in rate limit handler (never bypass it with raw REST calls).
- Consider Discord embeds for progress -- structured format naturally encourages less-frequent, more-complete updates.
- Test with a synthetic rapid-fire edit scenario before connecting the real progress tracker.

**Detection:** Progress messages show stale data, or other channels experience delayed message delivery during active progress tracking.

**Phase:** Phase 6-7 (progress tracker routing). Must be tested independently before connecting to real progress events.

---

### Pitfall 4: Channel ID vs Channel Name Confusion in JID Registration

**What goes wrong:** NanoClaw's group system uses JIDs like `tg:633706070` (numeric Telegram chat ID). Discord channels also have numeric snowflake IDs (`dc:1234567890123456`), but developers are tempted to use channel NAMES (like `dc:bugs` or `dc:#bugs`) for readability. Channel names can be renamed by any server admin at any time, breaking all routing.

**Why it happens:** Discord channel names are human-readable and feel natural as identifiers. Telegram chat IDs are always numeric so there is no temptation to use names. Discord's API returns both `channel.id` (stable snowflake) and `channel.name` (mutable string).

**Consequences:** If a channel is renamed in Discord (even accidentally), all IPC routing, webhook targeting, scheduled tasks, and group configuration silently breaks. Messages route to nowhere with no error.

**Prevention:**
- ALWAYS use `dc:{snowflake_id}` as the JID. Never use channel names in JIDs.
- Store channel name as metadata in the `RegisteredGroup` entry for display purposes only.
- When the bot creates channels programmatically, immediately capture and store the returned snowflake ID.
- Implement `syncGroups` to update display names from Discord without changing JIDs.

**Detection:** After any channel rename in Discord, check if NanoClaw still routes correctly to it.

**Phase:** Phase 1-2 (channel registration). Must be a hard rule from day one.

---

### Pitfall 5: Gateway Disconnection Causing Silent Message Loss

**What goes wrong:** Discord gateway connections drop periodically (this is normal and expected). During the disconnect-reconnect window (2-30 seconds), any messages sent to Discord channels are lost -- the bot never receives them. Unlike Telegram (which queues messages and delivers them when the bot reconnects via long polling), Discord's gateway does NOT replay missed messages reliably.

**Why it happens:** Discord's gateway is a WebSocket. If you are not connected, you do not receive events. The `RESUME` mechanism replays events the server buffered, but only if you resume within ~60 seconds and the server has not purged the buffer. For longer outages or failed resumes, messages are permanently lost.

**Consequences:** User sends a command in Discord during a brief disconnect. Bot never sees it. No error, no retry, no notification. User thinks the bot is ignoring them.

**Prevention:**
- Listen for `shardDisconnect`, `shardReconnecting`, and `shardResume` events. Log them prominently.
- After reconnection, fetch recent channel history for registered channels to catch messages sent during the gap (`channel.messages.fetch({ limit: 10, after: lastProcessedMessageId })`).
- Store the last processed message ID per channel in SQLite so gap recovery knows where to start.
- Keep Telegram as the reliable fallback during the migration period -- this is why gradual migration matters.

**Detection:** Users report "bot didn't respond to my Discord message" but bot logs show no incoming message event for that timestamp.

**Phase:** Phase 2-3 (connection resilience). Must be implemented before any channel is considered production ready.

## Moderate Pitfalls

### Pitfall 6: Markdown Format Incompatibility

**What goes wrong:** NanoClaw's agent output uses Telegram Markdown v1 format (`*bold*`, `_italic_`). Discord uses a different dialect: `**bold**`, `*italic*`. Sending Telegram-formatted text to Discord produces wrong formatting -- `*bold*` renders as italic in Discord.

**Prevention:**
- Implement a format adapter in the Discord channel's `sendMessage()` method. Key conversions: bold `*x*` to `**x**`, italic `_x_` to `*x*`. Code blocks use the same triple-backtick syntax.
- The `sendTelegramMessage` function in `telegram.ts` already has a Markdown-with-fallback pattern. Mirror this in Discord with Discord-specific formatting.

**Detection:** Messages in Discord show wrong emphasis (italic where bold was intended, or raw asterisks).

**Phase:** Phase 1-2. Must be working before any human-visible messages are sent.

---

### Pitfall 7: 2000-Character Message Limit (vs Telegram's 4096)

**What goes wrong:** Discord messages have a hard 2000-character limit. Telegram's limit is 4096. Agent responses, especially for code-heavy tasks or bug reports, frequently exceed 2000 characters. The Discord API rejects the message with a 400 error.

**Prevention:**
- Implement message splitting in the Discord channel's `sendMessage()`: split at natural boundaries (paragraph breaks, code block boundaries) into chunks under 2000 characters.
- Never split inside a code block -- find the closing triple backticks first.
- For very long responses, consider using Discord threads: post a summary in the channel, full response in an auto-created thread.
- Embed fields have their own limits (1024 chars per field, 6000 total per embed) -- do not assume embeds solve the length problem.

**Detection:** `DiscordAPIError[50035]: Invalid Form Body` with `content: Must be 2000 or fewer in length`.

**Phase:** Phase 1 (basic message sending). Must be handled before any real content flows through.

---

### Pitfall 8: IPC Authorization Model -- Non-Main Groups Cannot Cross-Send

**What goes wrong:** Current IPC authorization says "main group can send to all groups; non-main groups can only send to own JID." If Discord channels are registered as non-main groups (which they should be -- only one group should be main), they cannot IPC-message each other. An agent responding in `#bugs` cannot post a summary to `#progress`.

**Prevention:**
- Design IPC permissions for Discord channels early. Recommended approach: the routing layer handles cross-channel delivery so agents do not need IPC cross-send permissions. Agent outputs go through the router, which distributes to appropriate channels based on the routing table.
- Alternative: allow cross-group IPC within the same platform prefix (`dc:*` can message `dc:*`).
- Do NOT make multiple Discord channels "main" -- that breaks the security model.

**Detection:** Agent in one Discord channel tries to send a message to another Discord channel via IPC and gets authorization denied.

**Phase:** Phase 3-4 (IPC integration). Must be decided before webhooks/notifications phase.

---

### Pitfall 9: Dual-Send Deduplication During Migration

**What goes wrong:** During gradual migration, notifications go to both Telegram and Discord. If a user RESPONDS to the Discord copy AND the Telegram copy, the agent processes both -- potentially running the same action twice (acknowledging a bug twice, executing a task twice).

**Prevention:**
- During dual-send, make one platform "authoritative" for responses (Telegram stays authoritative initially).
- Discord notification channels during dual-send should be notification-only: display messages but do not process inbound responses from those mirrored channels.
- Alternatively: implement deduplication at the IPC level using a hash of (source_webhook + timestamp + content).
- Clearly document for yourself: "Respond in Telegram, not Discord, until migration is complete for this channel."

**Detection:** Same webhook event triggers two agent runs, or same task gets executed twice.

**Phase:** Phase 4-5 (dual-send implementation). Critical during the migration window.

---

### Pitfall 10: Event Handler Memory Leaks

**What goes wrong:** Adding event listeners in loops or on every message creates memory leaks. discord.js warns at 10+ listeners on the same event.

**Prevention:** Register all event handlers once in `connect()`. Never add listeners dynamically. Use the same pattern as the Telegram channel: all handlers registered at startup, message routing done via JID lookup internally.

**Detection:** Node.js `MaxListenersExceededWarning` in logs, growing memory usage over time.

**Phase:** Phase 1 (connection setup). Establish the pattern correctly from the start.

---

### Pitfall 11: Bot Token Exposure in Group CLAUDE.md Files

**What goes wrong:** Each Discord channel gets a per-channel `CLAUDE.md` with behavioral context. Developers accidentally include the bot token, channel IDs with tokens, or webhook URLs. These files are mounted into agent containers, making secrets accessible to the agent.

**Prevention:**
- Bot token lives ONLY in `.env` or environment variables, never in any `CLAUDE.md` or group config.
- Channel-specific `CLAUDE.md` files contain only behavioral instructions ("You are in the bug triage channel..."), never credentials.
- Add startup validation that scans group `CLAUDE.md` files for patterns matching Discord tokens (`[\w-]{24}\.[\w-]{6}\.[\w-]{38}`).

**Phase:** Phase 2 (group configuration). Establish the pattern from the first channel registration.

## Minor Pitfalls

### Pitfall 12: Snowflake IDs Are Strings, Not Numbers

**What goes wrong:** Treating Discord IDs as JavaScript numbers causes precision loss -- they exceed `Number.MAX_SAFE_INTEGER`. Channel lookups silently fail.

**Prevention:** Always use string type for Discord IDs. discord.js returns them as strings. The existing JID format (`dc:string_id`) naturally handles this.

**Phase:** Phase 1. Simple awareness prevents it entirely.

---

### Pitfall 13: sendTyping Duration Is Only 10 Seconds

**What goes wrong:** Typing indicator disappears after 10 seconds in Discord, making it look like the bot stopped processing during long agent runs.

**Prevention:** Call `channel.sendTyping()` on an interval (every 8-9 seconds) while the agent is processing. Same pattern as Telegram's typing indicator.

**Phase:** Phase 2 (message handling polish).

---

### Pitfall 14: Swarm Bot Identity Requires Webhooks, Not Bot Rename

**What goes wrong:** In Telegram, Friday and Alfred are separate bot accounts. In Discord, all responses come from one bot application. Developers try to change the bot's display name per message, which is rate-limited and applies globally.

**Prevention:** Use Discord channel webhooks (not bot messages) for swarm bot output. Webhooks allow per-message `username` and `avatar_url` override without rate limits.

**Detection:** All Discord messages show the same bot name regardless of which swarm agent generated them.

**Phase:** Phase 7-8 (swarm bot presence). Not blocking for core functionality.

---

### Pitfall 15: Category/Channel Creation Race Conditions

**What goes wrong:** Bot tries to create channels within a category before the category creation API call has resolved.

**Prevention:** Sequential creation: create category, await response with the category ID, then create channels within it. Do not parallelize category and channel creation.

**Phase:** Phase 2 (server setup). Simple to avoid with awareness.

## Phase-Specific Warnings Summary

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Bot setup and connection | Missing intents (P1), wrong JID format (P4) | Startup validation, echo test, enforce snowflake JIDs |
| Channel registration | Name vs ID confusion (P4), token exposure (P11) | Snowflake-only JIDs, secrets audit |
| Message handling | 2000-char limit (P7), Markdown mismatch (P6) | Channel-specific splitting, format adapter |
| Server structure creation | Rate limiting (P3), creation race conditions (P15) | Sequential creation with delays |
| Routing architecture | Hardcoded mainJid (P2), IPC auth model (P8) | Routing table abstraction, permission design |
| Dual-send migration | Deduplication (P9), response authority | One-platform-authoritative rule |
| Webhook forwarding | Hardcoded mainJid (P2) | Routing layer wrapping existing handlers |
| Progress tracker | Edit rate limits (P3) | Buffered updates, 2-3 sec consolidation |
| Connection resilience | Gateway disconnects (P5) | Gap recovery, message ID tracking per channel |
| Swarm bots | Single identity (P14) | Discord webhooks per bot identity |

## Sources

- [Discord Rate Limits Documentation](https://docs.discord.com/developers/topics/rate-limits) -- official rate limit rules, 50 req/sec global, per-route buckets
- [Discord Gateway Documentation](https://docs.discord.com/developers/events/gateway) -- disconnect/resume behavior, close codes
- [discord.js Gateway Intents Guide](https://discordjs.guide/legacy/popular-topics/intents) -- intent configuration for v14
- [Discord Privileged Intents FAQ](https://support-dev.discord.com/hc/en-us/articles/4404772028055-Message-Content-Privileged-Intent-FAQ) -- MessageContent requirements, under-100-server exception
- [discord.js Common Errors Guide](https://discordjs.guide/legacy/popular-topics/errors) -- DM failures, permission errors
- [Discord Developer Support: Rate Limiting](https://support-dev.discord.com/hc/en-us/articles/6223003921559-My-Bot-is-Being-Rate-Limited) -- Cloudflare ban thresholds, invalid request limits
- NanoClaw source analysis: `src/types.ts` (Channel interface contract), `src/channels/telegram.ts` (existing channel pattern), `src/github-issues-webhook.ts` and `src/notion-webhook.ts` (hardcoded mainJid routing pattern), `src/ipc.ts` (IPC authorization model)
