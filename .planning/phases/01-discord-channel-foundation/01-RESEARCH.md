# Phase 1: Discord Channel Foundation - Research

**Researched:** 2026-03-26
**Domain:** Discord bot integration into NanoClaw multi-channel system
**Confidence:** HIGH

## Summary

Phase 1 is primarily an **integration phase, not a build-from-scratch phase**. The `nanoclaw-discord` remote repository (`https://github.com/qwibitai/nanoclaw-discord.git`) already contains a complete `DiscordChannel` implementation (250 lines) with comprehensive tests (776 lines). The existing `add-discord` skill at `.claude/skills/add-discord/SKILL.md` documents the merge-and-setup workflow.

The remote branch provides: `src/channels/discord.ts` (DiscordChannel class with self-registration), `src/channels/discord.test.ts` (vitest unit tests with discord.js mock), the discord.js npm dependency, import in the channel barrel file, and `.env.example` entry for `DISCORD_BOT_TOKEN`.

**Primary recommendation:** Use the `add-discord` skill merge workflow to bring in the existing implementation. Phase 1 tasks should focus on: (1) merging the remote, (2) resolving any conflicts with current branch state, (3) building and running tests, (4) verifying the implementation satisfies CHAN-01 through CHAN-04 requirements -- specifically checking reconnection behavior (CHAN-03) which may need enhancement.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAN-01 | Discord bot connects using discord.js v14 with gateway intents (Guilds, GuildMessages, MessageContent) | Remote branch `discord.ts` already implements this: `Client` with `GatewayIntentBits.Guilds`, `GuildMessages`, `MessageContent`, `DirectMessages`. discord.js v14.25.1 confirmed current. |
| CHAN-02 | Discord channel self-registers via `registerChannel('discord', factory)` | Remote branch already has `registerChannel('discord', ...)` at bottom of `discord.ts`, following exact Telegram pattern. |
| CHAN-03 | Bot reconnects automatically after disconnection with exponential backoff | **Partially covered.** discord.js v14 handles reconnection internally via `@discordjs/ws`. However, the remote implementation does NOT listen for `shardDisconnect`/`shardReconnecting`/`shardResume` events for logging/monitoring. May need enhancement for observability. |
| CHAN-04 | Bot gracefully disconnects on NanoClaw shutdown | Remote branch implements `disconnect()` calling `client.destroy()` and nulling the client. Matches Telegram pattern (`bot.stop()`). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Run commands directly; do not tell the user to run them
- Use `npm run dev` for hot reload, `npm run build` for compile
- Service management on Linux via `systemctl --user start/stop/restart nanoclaw`
- Container build cache requires `--no-cache` + prune for clean rebuild

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | ^14.25.1 | Discord API client | De facto standard, 347K weekly npm downloads, ships full TypeScript types. Already selected in remote branch. |

### Supporting (already in project)
| Library | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.7.0 | Type safety (discord.js ships own types) |
| pino (logger) | ^9.6.0 | Logging (use existing `logger` instance) |
| vitest | (project dev dep) | Test runner (remote tests already use vitest) |

### No Additional Libraries Needed
discord.js v14 bundles `@discordjs/rest`, `@discordjs/ws`, `@discordjs/builders`, `@discordjs/collection`, `@discordjs/formatters`, and `discord-api-types`.

**Installation:**
```bash
# Handled by merge + npm install -- discord.js is in the remote's package.json
npm install
```

**Version verification:** discord.js v14.25.1 confirmed via `npm view discord.js version` on 2026-03-26.

## Architecture Patterns

### Existing Remote Implementation Structure

The remote branch follows the **exact same pattern** as `TelegramChannel`:

```
src/channels/
  discord.ts       # DiscordChannel class + registerChannel() call
  discord.test.ts  # 776-line vitest test suite with discord.js mocking
  index.ts         # Barrel: import './discord.js' added
  registry.ts      # Unchanged -- shared registry
```

### Pattern 1: Self-Registration (Already Implemented)
**What:** Channel modules call `registerChannel()` at import time with a factory function.
**Remote implementation:**
```typescript
registerChannel('discord', (opts: ChannelOpts) => {
  const envVars = readEnvFile(['DISCORD_BOT_TOKEN']);
  const token = process.env.DISCORD_BOT_TOKEN || envVars.DISCORD_BOT_TOKEN || '';
  if (!token) {
    logger.warn('Discord: DISCORD_BOT_TOKEN not set');
    return null;
  }
  return new DiscordChannel(token, opts);
});
```

### Pattern 2: JID Format
**Remote uses:** `dc:{channelId}` (simple format, snowflake string)
**Note:** ARCHITECTURE.md suggests `dc:{guildId}:{channelId}` for guild context, but the remote implementation uses the simpler `dc:{channelId}` format. For Phase 1 (foundation), the simpler format is correct -- guild-level operations come in later phases.

### Pattern 3: Gateway Connect with Ready Promise
**Remote uses:** Same pattern as Telegram -- `connect()` returns a Promise that resolves when `ClientReady` fires:
```typescript
return new Promise<void>((resolve) => {
  this.client!.once(Events.ClientReady, (readyClient) => {
    logger.info({ username: readyClient.user.tag }, 'Discord bot connected');
    resolve();
  });
  this.client!.login(this.botToken);
});
```

### Anti-Patterns to Avoid
- **Do NOT build discord.ts from scratch** -- the remote branch has a tested implementation
- **Do NOT use channel names in JIDs** -- always use snowflake IDs (`dc:1234567890123456`)
- **Do NOT register event handlers dynamically** -- all handlers in `connect()`, once

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Discord channel code | Write from scratch | Merge `nanoclaw-discord` remote branch | 250 lines of tested code + 776 lines of tests already exist |
| Gateway reconnection | Custom reconnect logic | discord.js built-in `@discordjs/ws` auto-reconnect | discord.js handles resume, heartbeat, and reconnection internally |
| Rate limiting | Manual rate limit handling | discord.js built-in rate limiter | Handles per-route buckets and global limits automatically |
| Message splitting | Custom chunker | Simple 2000-char split (already in remote) | Remote already implements the same pattern as Telegram's 4096-char split |

## Common Pitfalls

### Pitfall 1: Merge Conflicts with Current Branch
**What goes wrong:** Current branch (`nightshift/2026-03-25`) has modified `src/channels/index.ts`, `package.json`, `package-lock.json`, `src/types.ts`, and other files. The merge from `nanoclaw-discord` will likely conflict on `index.ts` (it adds `import './discord.js'`), `package.json` (adds discord.js dep), and possibly other shared files.
**How to avoid:** Follow the skill's merge strategy: `git checkout --theirs package-lock.json` for lockfile conflicts, then manually resolve `index.ts` (ensure both gmail and discord imports are present) and `package.json` (merge deps from both sides).
**Warning signs:** Build fails after merge, missing imports, duplicate entries.

### Pitfall 2: Missing MessageContent Privileged Intent
**What goes wrong:** Bot connects but `message.content` is empty. The intent must be enabled in Discord Developer Portal AND in code.
**How to avoid:** The remote code already requests `GatewayIntentBits.MessageContent`. User must also enable it in the Developer Portal (documented in add-discord skill Phase 3).
**Detection:** Bot appears online but never responds. `message.content === ''` in logs.

### Pitfall 3: No Reconnection Observability (CHAN-03 Gap)
**What goes wrong:** discord.js handles reconnection automatically, but the remote implementation has no `shardDisconnect`/`shardReconnecting`/`shardResume` event listeners. When disconnects happen, there is no log output to confirm reconnection worked.
**How to avoid:** Add shard lifecycle event listeners for logging. This is the main enhancement needed on top of the remote code for CHAN-03 compliance.
**Code to add:**
```typescript
this.client.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn({ shardId, code: event.code }, 'Discord shard disconnected');
});
this.client.on(Events.ShardReconnecting, (shardId) => {
  logger.info({ shardId }, 'Discord shard reconnecting');
});
this.client.on(Events.ShardResume, (shardId, replayedEvents) => {
  logger.info({ shardId, replayedEvents }, 'Discord shard resumed');
});
```

### Pitfall 4: Bot Token Not Synced to Container Environment
**What goes wrong:** Token set in `.env` but not in `data/env/env`. NanoClaw reads from both locations.
**How to avoid:** Follow add-discord skill: `mkdir -p data/env && cp .env data/env/env` after setting token.

## Code Examples

### What the Remote Branch Already Provides

**Channel class structure (verified from remote):**
```typescript
export class DiscordChannel implements Channel {
  name = 'discord';
  private client: Client | null = null;

  async connect(): Promise<void>        // Login + ClientReady promise
  async sendMessage(jid, text): void    // 2000-char split, TextChannel.send()
  isConnected(): boolean                // client?.isReady()
  ownsJid(jid): boolean                 // jid.startsWith('dc:')
  async disconnect(): Promise<void>     // client.destroy()
  async setTyping(jid, isTyping): void  // TextChannel.sendTyping()
}
```

**Features already implemented in remote:**
- Gateway intents: Guilds, GuildMessages, MessageContent, DirectMessages
- Inbound message handling with `onMessage` / `onChatMetadata` callbacks
- @mention translation: `<@botId>` stripped and `@Andy` prepended
- Attachment descriptions (image/video/audio/file placeholders)
- Reply context extraction (fetches replied-to message author)
- Message splitting at 2000-char boundary
- Typing indicator support
- Error handler on `Events.Error`
- Self-registration via `registerChannel('discord', factory)`

**Features NOT in remote (needed for later phases):**
- `sendMessageRaw` / `editMessage` / `deleteMessage` (Phase 3: progress tracker)
- `reactToMessage` (Phase 3)
- `sendWithButtons` (Phase 3)
- `sendPhoto` (Phase 3)
- Server management methods (Phase 5)
- Shard lifecycle logging (needed for CHAN-03 -- add in Phase 1)

### CHAN-03 Enhancement: Reconnection Observability

```typescript
// Add inside connect(), after client creation, before login:
this.client.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn({ shardId, code: event.code }, 'Discord shard disconnected');
});
this.client.on(Events.ShardReconnecting, (shardId) => {
  logger.info({ shardId }, 'Discord shard reconnecting');
});
this.client.on(Events.ShardResume, (shardId, replayedEvents) => {
  logger.info({ shardId, replayedEvents }, 'Discord shard resumed');
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (already in project) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/channels/discord.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAN-01 | Bot connects with correct intents | unit | `npx vitest run src/channels/discord.test.ts -t "connect"` | Exists in remote (merge brings it in) |
| CHAN-02 | Self-registration via registerChannel | unit | `npx vitest run src/channels/discord.test.ts -t "register"` | Exists in remote |
| CHAN-03 | Reconnection with shard event logging | unit | `npx vitest run src/channels/discord.test.ts -t "reconnect"` | Needs new test after enhancement |
| CHAN-04 | Graceful disconnect via client.destroy() | unit | `npx vitest run src/channels/discord.test.ts -t "disconnect"` | Exists in remote |

### Sampling Rate
- **Per task commit:** `npx vitest run src/channels/discord.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] Test for CHAN-03 shard lifecycle logging -- add after reconnection enhancement
- [ ] Verify existing 776-line test suite passes after merge with current branch

## Merge Strategy (Critical Path)

The primary technical risk for this phase is the **merge from the remote branch** onto the current working branch which has significant uncommitted/modified changes.

**Recommended approach:**
1. Commit or stash current working changes
2. `git remote add discord https://github.com/qwibitai/nanoclaw-discord.git`
3. `git fetch discord main`
4. `git merge discord/main`
5. Resolve conflicts (expected in: `index.ts`, `package.json`, `package-lock.json`, possibly `types.ts`)
6. `npm install && npm run build && npx vitest run src/channels/discord.test.ts`

**Files the remote modifies (potential conflict points):**
- `src/channels/index.ts` -- adds `import './discord.js'` (current has gmail+telegram; remote has discord only)
- `package.json` -- adds discord.js dependency
- `package-lock.json` -- always conflicts on merge
- `src/types.ts` -- may have diverged
- `.env.example` -- adds DISCORD_BOT_TOKEN

## Open Questions

1. **Current branch state for merge**
   - What we know: Branch `nightshift/2026-03-25` has many modified files (both staged and unstaged)
   - What's unclear: Whether these changes should be committed before the discord merge
   - Recommendation: Commit or stash all current changes first to get a clean merge base

2. **Bot token availability**
   - What we know: User needs to create a Discord bot and provide a token (STATE.md notes this as a blocker)
   - What's unclear: Whether the user already has a bot token ready
   - Recommendation: Plan should include a user-interaction step for token collection, following the add-discord skill's Phase 3

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | discord.js v14 (requires >= 16.11) | Yes | v22.22.2 | -- |
| npm | Package installation | Yes | (bundled with Node) | -- |
| git | Remote merge | Yes | (system) | -- |
| vitest | Test execution | Yes | (project dev dep) | -- |
| Discord bot token | CHAN-01 connection | No (user must provide) | -- | Cannot proceed without it |

**Missing dependencies with no fallback:**
- Discord bot token -- requires user to create application in Discord Developer Portal (~5 min)

## Sources

### Primary (HIGH confidence)
- Remote branch `nanoclaw-discord` main -- direct inspection of `src/channels/discord.ts` (250 lines), `src/channels/discord.test.ts` (776 lines), `src/channels/index.ts`
- Local codebase -- `src/channels/telegram.ts`, `src/channels/registry.ts`, `src/types.ts` (Channel interface)
- `.claude/skills/add-discord/SKILL.md` -- merge workflow and setup instructions
- `npm view discord.js version` -- confirmed v14.25.1

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` -- discord.js v14 capabilities and API mapping
- `.planning/research/ARCHITECTURE.md` -- component boundaries and data flow
- `.planning/research/PITFALLS.md` -- 15 documented pitfalls with mitigations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- discord.js v14.25.1 confirmed, already in remote branch
- Architecture: HIGH -- remote implementation follows exact same pattern as Telegram channel
- Pitfalls: HIGH -- merge conflicts are the main risk; discord.js reconnection is built-in
- CHAN-03 gap: MEDIUM -- discord.js auto-reconnects but observability enhancement needed

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- discord.js v14 is mature, patterns are established)
