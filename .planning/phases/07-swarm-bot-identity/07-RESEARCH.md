# Phase 7: Swarm Bot Identity - Research

**Researched:** 2026-03-26
**Domain:** Discord channel webhooks for swarm agent identity
**Confidence:** HIGH

## Summary

Phase 7 enables swarm agents (Friday, Alfred) to post in Discord with distinct usernames and avatars using Discord channel webhooks. Discord webhooks natively support per-message `username` and `avatarURL` overrides, making this significantly simpler than the Telegram bot pool approach (which requires separate bot tokens and API instances).

The core integration point is the IPC message path. Currently, the container MCP tool `send_message` already accepts an optional `sender` field and writes it to the IPC JSON file, but the IPC watcher in `src/ipc.ts` drops it -- it only passes `(chatJid, text)` to `deps.sendMessage`. Phase 7 must thread the `sender` field through IPC to the Discord channel's `sendMessage`, then use it to route messages through webhooks instead of the bot client.

**Primary recommendation:** Create a `SwarmWebhookManager` class that owns webhook lifecycle (create/cache/send), modify `IpcDeps.sendMessage` to accept an optional `sender` parameter, and add sender-aware routing in `DiscordChannel.sendMessage` that delegates to the webhook manager when a sender identity matches.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Create Discord channel webhooks on demand -- when a swarm bot first posts in a channel, create the webhook then cache it
- **D-02:** Use discord.js `channel.createWebhook({ name, avatar })` -- standard Discord API for channel webhooks
- **D-03:** Webhooks persist in Discord even after bot restart -- on startup, fetch existing webhooks before creating new ones (idempotent)
- **D-04:** Avatar URLs stored in config -- discord.js WebhookClient.send() accepts `avatarURL` and `username` per-message
- **D-05:** Each swarm identity has a name and avatarURL in config -- no local file management needed
- **D-06:** `config/swarm-identities.json` -- JSON config file with array of identities (name, avatarURL), matches Phase 5/6 config pattern
- **D-07:** Zod validation of identity config at load time
- **D-08:** Identity matched by `sender` field from agent prompt (e.g., "Friday" -> Friday webhook identity)
- **D-09:** In-memory `Map<string, Webhook>` keyed by `{channelId}:{identityName}` -- one webhook per identity per channel
- **D-10:** On bot startup, existing webhooks fetched from Discord API and populated into cache (avoids creating duplicates)
- **D-11:** If webhook creation fails or webhook send fails, fall back to main bot `channel.send()` with `[Friday]` prefix in message
- **D-12:** Log fallback events via pino for observability
- **D-13:** Hook into the outbound message path -- when `sender` field is present and matches a swarm identity, use webhook instead of bot send
- **D-14:** Works with existing `sendMessage()` in discord.ts -- check sender, route to webhook or bot

### Claude's Discretion
- Exact webhook naming convention (bot name or "NanoClaw-Friday")
- Whether to create a separate SwarmManager class or extend DiscordChannel
- Default avatar URLs (placeholder or specific)
- Webhook cleanup strategy (if any)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SWRM-01 | Swarm agents post in Discord with distinct usernames via channel webhooks | discord.js `webhook.send({ username, content })` supports per-message username override. IPC sender field already exists in container MCP tool. |
| SWRM-02 | Each swarm identity has custom avatar in Discord | discord.js `webhook.send({ avatarURL })` supports per-message avatar override. Config stores avatarURL per identity. |
| SWRM-03 | Swarm webhook creation automated per registered Discord channel | `channel.createWebhook({ name })` creates webhooks on-demand. `channel.fetchWebhooks()` retrieves existing ones for cache hydration. |
| SWRM-04 | Swarm identity falls back to main bot if webhook unavailable | Wrap webhook send in try/catch, fall back to `channel.send()` with `[SenderName]` prefix. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | 14.25.1 | Discord webhooks API | Already in project. `Webhook.send()`, `TextChannel.createWebhook()`, `TextChannel.fetchWebhooks()` are all built-in. |
| zod | ^4.3.6 | Config validation | Already in project. Used for routing.json schema in Phase 6. |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^9.6.0 | Logging | Log webhook creation, fallback events, errors |

### No Additional Libraries Needed
All webhook functionality is built into discord.js v14. No external packages required.

## Architecture Patterns

### Recommended Project Structure
```
src/
  channels/
    discord.ts              # Modified: sender-aware sendMessage routing
  swarm-webhook-manager.ts  # NEW: webhook lifecycle (create/cache/send/fallback)
config/
  swarm-identities.json     # NEW: identity definitions (name, avatarURL)
```

### Pattern 1: Sender-Aware IPC Message Flow
**What:** Thread the `sender` field from IPC JSON through to channel sendMessage
**When to use:** Every IPC message delivery

The current flow drops sender:
```
Container MCP tool -> IPC JSON {chatJid, text, sender} -> ipc.ts -> deps.sendMessage(jid, text) [sender dropped]
```

The new flow:
```
Container MCP tool -> IPC JSON {chatJid, text, sender} -> ipc.ts -> deps.sendMessage(jid, text, sender?) -> discord.ts routes to webhook
```

**Changes required:**
1. `IpcDeps.sendMessage` signature: `(jid: string, text: string, sender?: string) => Promise<void>`
2. `ipc.ts` line 93: pass `data.sender` as third argument
3. `index.ts` IPC watcher setup: thread sender to channel
4. `DiscordChannel.sendMessage`: accept optional sender, route to webhook manager

### Pattern 2: SwarmWebhookManager Class
**What:** Encapsulates webhook creation, caching, sending, and fallback
**When to use:** New class managing all swarm webhook operations

```typescript
// Source: discord.js official guide + CONTEXT.md decisions
import { TextChannel, Webhook } from 'discord.js';

interface SwarmIdentity {
  name: string;
  avatarURL: string;
}

class SwarmWebhookManager {
  // Map<"{channelId}:{identityName}", Webhook> per D-09
  private cache = new Map<string, Webhook>();
  private identities: Map<string, SwarmIdentity>;

  constructor(identities: SwarmIdentity[]) {
    this.identities = new Map(identities.map(i => [i.name.toLowerCase(), i]));
  }

  // D-10: Hydrate cache from existing Discord webhooks on startup
  async hydrateCache(channels: TextChannel[]): Promise<void> {
    for (const channel of channels) {
      const webhooks = await channel.fetchWebhooks();
      for (const [, wh] of webhooks) {
        // Match webhooks we created (by name convention)
        for (const [identityName] of this.identities) {
          if (wh.name === this.webhookName(identityName) && wh.token) {
            this.cache.set(`${channel.id}:${identityName}`, wh);
          }
        }
      }
    }
  }

  // D-01: Create webhook on demand, D-03: idempotent
  async getOrCreateWebhook(channel: TextChannel, senderName: string): Promise<Webhook | null> {
    const key = `${channel.id}:${senderName.toLowerCase()}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const identity = this.identities.get(senderName.toLowerCase());
    if (!identity) return null; // Not a known swarm identity

    try {
      const webhook = await channel.createWebhook({
        name: this.webhookName(senderName),
        avatar: identity.avatarURL,
        reason: `NanoClaw swarm identity: ${senderName}`,
      });
      this.cache.set(key, webhook);
      return webhook;
    } catch (err) {
      logger.warn({ channel: channel.id, sender: senderName, err }, 'Failed to create swarm webhook');
      return null;
    }
  }

  // D-04, SWRM-01, SWRM-02: Send via webhook with identity override
  async send(channel: TextChannel, text: string, senderName: string): Promise<boolean> {
    const webhook = await this.getOrCreateWebhook(channel, senderName);
    if (!webhook) return false;

    const identity = this.identities.get(senderName.toLowerCase());
    try {
      // Per-message username + avatarURL override
      await webhook.send({
        content: text.slice(0, 2000),
        username: identity!.name,
        avatarURL: identity!.avatarURL,
      });
      return true;
    } catch (err) {
      logger.warn({ channel: channel.id, sender: senderName, err }, 'Webhook send failed, will fallback');
      // Remove stale webhook from cache
      this.cache.delete(`${channel.id}:${senderName.toLowerCase()}`);
      return false;
    }
  }

  private webhookName(senderName: string): string {
    return `NanoClaw-${senderName}`;
  }

  hasIdentity(senderName: string): boolean {
    return this.identities.has(senderName.toLowerCase());
  }
}
```

### Pattern 3: Config File Structure
**What:** `config/swarm-identities.json` with Zod validation
**When to use:** Load at startup, validated with zod

```typescript
// Zod schema matching D-06, D-07
const SwarmIdentitySchema = z.object({
  name: z.string().min(1),
  avatarURL: z.string().url(),
});

const SwarmIdentitiesConfigSchema = z.array(SwarmIdentitySchema).min(1);

// Example config/swarm-identities.json:
// [
//   { "name": "Friday", "avatarURL": "https://cdn.discordapp.com/..." },
//   { "name": "Alfred", "avatarURL": "https://cdn.discordapp.com/..." }
// ]
```

### Pattern 4: Fallback Strategy (D-11)
**What:** When webhook unavailable, fall back to main bot with sender prefix
**When to use:** Webhook creation failure or send failure

```typescript
// In DiscordChannel.sendMessage, after webhook fails:
async sendMessage(jid: string, text: string, sender?: string): Promise<void> {
  if (sender && this.swarmManager?.hasIdentity(sender)) {
    const channel = await this.getTextChannel(jid);
    if (channel) {
      const sent = await this.swarmManager.send(channel, text, sender);
      if (sent) return; // Webhook succeeded
      // Fallback: prefix message with sender name
      logger.warn({ jid, sender }, 'Swarm webhook fallback to main bot');
      const fallbackText = `[${sender}] ${text}`;
      // Continue to normal send below with fallbackText
      text = fallbackText;
    }
  }
  // Normal bot send (existing code)
  // ...
}
```

### Anti-Patterns to Avoid
- **Creating webhooks at startup for all channels:** Wasteful -- create on first send per D-01
- **Using WebhookClient with URL:** Unnecessary -- we have the Webhook object from createWebhook/fetchWebhooks
- **Storing webhook IDs in database:** Discord persists them -- fetch on startup per D-10
- **One webhook per channel shared by all identities:** Use separate webhooks per identity for cleaner management, though username/avatarURL can override per-message

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook management | Custom HTTP calls to Discord API | discord.js `TextChannel.createWebhook()` + `Webhook.send()` | Handles rate limiting, error codes, caching internally |
| Message chunking for webhooks | Separate chunker | Existing `chunkMessage()` from `discord-chunker.ts` | Already handles code block splitting correctly |
| Avatar hosting | Self-hosted image server | Discord CDN URLs or Imgur | Free, reliable, no infrastructure |

## Common Pitfalls

### Pitfall 1: Webhook Token Loss
**What goes wrong:** `fetchWebhooks()` returns webhooks but some may not have a `token` property (webhooks created by other integrations or with limited scope)
**Why it happens:** Only webhooks created by the bot with full permissions return the token needed to send
**How to avoid:** Filter fetched webhooks by `wh.token` existence AND match by name convention (`NanoClaw-{sender}`)
**Warning signs:** `webhook.send()` throws "Missing token" error

### Pitfall 2: Webhook Rate Limits
**What goes wrong:** Discord rate-limits webhook sends at 5 requests per 2 seconds per webhook
**Why it happens:** Multiple rapid messages from same swarm agent
**How to avoid:** discord.js handles rate limiting internally with queue. No manual throttling needed, but be aware of slight delays.
**Warning signs:** Slow message delivery in bursts

### Pitfall 3: Webhook Count Limit
**What goes wrong:** Discord limits 15 webhooks per channel (was 10, increased)
**Why it happens:** Creating too many identity webhooks per channel
**How to avoid:** With 2-3 swarm identities this is not an issue. Cache properly and don't create duplicates.
**Warning signs:** Discord API error 30007 "Maximum number of webhooks reached"

### Pitfall 4: IPC Sender Field Not Threaded
**What goes wrong:** `sender` field exists in IPC JSON but is dropped by `ipc.ts` line 93
**Why it happens:** Original `IpcDeps.sendMessage` signature is `(jid, text)` with no sender parameter
**How to avoid:** Modify `IpcDeps.sendMessage` to accept optional `sender` parameter. This is backwards-compatible.
**Warning signs:** All swarm messages appear as main bot

### Pitfall 5: Message Length with Webhook
**What goes wrong:** Webhook messages also have 2000-char limit but chunking logic may not be applied
**Why it happens:** If webhook send bypasses the existing `chunkMessage()` pipeline
**How to avoid:** Apply same `chunkMessage()` splitting to webhook sends
**Warning signs:** Messages truncated at 2000 chars without continuation

### Pitfall 6: Cache Stale After Webhook Deletion
**What goes wrong:** If someone manually deletes a webhook from Discord, the cached reference becomes stale
**Why it happens:** Discord doesn't notify the bot when webhooks are deleted
**How to avoid:** On send failure (specifically 10015 "Unknown Webhook"), remove from cache and recreate on next send
**Warning signs:** 404 errors on webhook.send()

## Code Examples

### Creating a Webhook (verified from discord.js guide)
```typescript
// Source: https://discordjs.guide/popular-topics/webhooks.html
const webhook = await channel.createWebhook({
  name: 'NanoClaw-Friday',
  avatar: 'https://i.imgur.com/example.png',
  reason: 'NanoClaw swarm identity: Friday',
});
```

### Sending with Username/Avatar Override
```typescript
// Source: https://discordjs.guide/popular-topics/webhooks.html
await webhook.send({
  content: 'Bug report analysis complete.',
  username: 'Friday',
  avatarURL: 'https://i.imgur.com/example.png',
});
```

### Fetching Existing Webhooks (for cache hydration)
```typescript
// Source: https://discordjs.guide/popular-topics/webhooks.html
const webhooks = await channel.fetchWebhooks();
const ours = webhooks.filter(wh => wh.token && wh.name?.startsWith('NanoClaw-'));
```

### Existing Pattern: Config Loading with Zod (from webhook-router.ts)
```typescript
// Source: src/webhook-router.ts (existing project pattern)
const raw = readFileSync(CONFIG_PATH, 'utf-8');
const json = JSON.parse(raw);
const config = SwarmIdentitiesConfigSchema.parse(json);
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (from existing project) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SWRM-01 | Webhook send with custom username | unit | `npx vitest run src/swarm-webhook-manager.test.ts -t "sends with username"` | No - Wave 0 |
| SWRM-02 | Webhook send with custom avatar | unit | `npx vitest run src/swarm-webhook-manager.test.ts -t "sends with avatarURL"` | No - Wave 0 |
| SWRM-03 | Auto-create webhook on first send | unit | `npx vitest run src/swarm-webhook-manager.test.ts -t "creates webhook"` | No - Wave 0 |
| SWRM-04 | Fallback to bot send on webhook failure | unit | `npx vitest run src/swarm-webhook-manager.test.ts -t "fallback"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/swarm-webhook-manager.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/swarm-webhook-manager.test.ts` -- covers SWRM-01 through SWRM-04
- [ ] Mock discord.js `TextChannel`, `Webhook` objects for unit tests

## Open Questions

1. **Avatar URLs**
   - What we know: Config stores URLs, discord.js accepts any image URL
   - What's unclear: What specific avatar images to use for Friday and Alfred
   - Recommendation: Use placeholder URLs in config (e.g., Dicebear API or generic icons), user can replace later

2. **Webhook hydration scope**
   - What we know: D-10 says fetch existing webhooks on startup
   - What's unclear: Whether to hydrate all registered Discord channels or only on first send
   - Recommendation: Lazy hydration per-channel on first swarm send (avoids N API calls at startup for channels that may never receive swarm messages). The `getOrCreateWebhook` method handles this naturally.

## Sources

### Primary (HIGH confidence)
- [discord.js Webhooks Guide](https://discordjs.guide/popular-topics/webhooks.html) - createWebhook, send with username/avatar, fetchWebhooks
- [discord.js TextChannel docs](https://discord.js.org/docs/packages/discord.js/14.24.0/TextChannel:Class) - fetchWebhooks() method
- [discord.js Webhook class](https://discord.js.org/docs/packages/discord.js/14.24.0/Webhook:Class) - send() method options
- discord.js npm v14.25.1 confirmed current

### Secondary (MEDIUM confidence)
- [Discord Developer Docs - Webhook Resource](https://discord.com/developers/docs/resources/webhook) - rate limits, webhook limits

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - discord.js webhooks are well-documented, already in project
- Architecture: HIGH - IPC sender field already exists, just needs threading through
- Pitfalls: HIGH - webhook patterns are well-established, pitfalls are documented

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, discord.js v14 is mature)
