# Phase 7: Swarm Bot Identity - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Friday and Alfred post in Discord with their own distinct usernames and avatars using Discord channel webhooks, instead of appearing as the main bot. Webhook creation is automated on first swarm send per channel, with fallback to main bot if webhook is unavailable.

Requirements: SWRM-01 (distinct usernames via webhooks), SWRM-02 (custom avatars), SWRM-03 (automated webhook creation), SWRM-04 (fallback to main bot).

</domain>

<decisions>
## Implementation Decisions

### Webhook Creation Strategy
- **D-01:** Create Discord channel webhooks on demand — when a swarm bot first posts in a channel, create the webhook then cache it
- **D-02:** Use discord.js `channel.createWebhook({ name, avatar })` — standard Discord API for channel webhooks
- **D-03:** Webhooks persist in Discord even after bot restart — on startup, fetch existing webhooks before creating new ones (idempotent)

### Avatar Source
- **D-04:** Avatar URLs stored in config — discord.js WebhookClient.send() accepts `avatarURL` and `username` per-message
- **D-05:** Each swarm identity has a name and avatarURL in config — no local file management needed

### Identity Registry
- **D-06:** `config/swarm-identities.json` — JSON config file with array of identities (name, avatarURL), matches Phase 5/6 config pattern
- **D-07:** Zod validation of identity config at load time
- **D-08:** Identity matched by `sender` field from agent prompt (e.g., "Friday" → Friday webhook identity)

### Webhook Caching
- **D-09:** In-memory `Map<string, Webhook>` keyed by `{channelId}:{identityName}` — one webhook per identity per channel
- **D-10:** On bot startup, existing webhooks fetched from Discord API and populated into cache (avoids creating duplicates)

### Fallback Behavior
- **D-11:** If webhook creation fails or webhook send fails, fall back to main bot `channel.send()` with `[Friday]` prefix in message
- **D-12:** Log fallback events via pino for observability

### Integration Point
- **D-13:** Hook into the outbound message path — when `sender` field is present and matches a swarm identity, use webhook instead of bot send
- **D-14:** Works with existing `sendMessage()` in discord.ts — check sender, route to webhook or bot

### Claude's Discretion
- Exact webhook naming convention (bot name or "NanoClaw-Friday")
- Whether to create a separate SwarmManager class or extend DiscordChannel
- Default avatar URLs (placeholder or specific)
- Webhook cleanup strategy (if any)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Swarm Identity (current implementation)
- `src/github-issues-webhook.ts` — Friday agent prompts with `sender set to "Friday"` pattern (lines 125-212)
- `src/github-webhook.ts` — Friday CI monitor with sender identity (lines 208-233)
- `src/channels/telegram.ts` — `initBotPool()` for Telegram swarm (line 75)
- `src/index.ts` — Bot pool initialization (line 686)

### Discord Channel (modification target)
- `src/channels/discord.ts` — DiscordChannel class, `sendMessage()` method to extend with swarm routing
- `src/channels/registry.ts` — Channel interface, ChannelOpts

### Config Pattern (from prior phases)
- `config/discord-server.json` — JSON config pattern (Phase 5)
- `config/routing.json` — JSON config pattern with zod (Phase 6)
- `src/webhook-router.ts` — Config loading + zod validation pattern

### Discord.js Webhook API
- `CLAUDE.md` §Technology Stack — Guild Management API Surface table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Config loading + zod validation pattern from `src/webhook-router.ts` — reuse for swarm identity config
- `DiscordChannel` class already has `this.client` with full guild access — can create webhooks via `channel.createWebhook()`
- Agent prompts already set `sender` field — no need to change agent behavior, just intercept at send time

### Established Patterns
- Swarm bots identify via `sender` field in `mcp__nanoclaw__send_message` tool calls
- Telegram bot pool uses multiple bot tokens — Discord uses webhooks instead (different mechanism, same concept)
- Config files in `config/` directory with zod schemas

### Integration Points
- `src/channels/discord.ts` `sendMessage()` — add sender-aware routing (webhook vs bot)
- `src/router.ts` — outbound message routing, passes sender info
- New `config/swarm-identities.json` for identity definitions
- New swarm webhook manager (class or module)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-swarm-bot-identity*
*Context gathered: 2026-03-26 via auto-mode*
