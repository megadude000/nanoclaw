# Phase 5: Server Structure Management - Research

**Researched:** 2026-03-26
**Domain:** Discord guild management via discord.js + IPC command integration
**Confidence:** HIGH

## Summary

Phase 5 adds programmatic Discord server management (create/delete/rename channels, categories, permissions) exposed through a new `discord_manage` IPC message type restricted to the main group. The core work involves: (1) adding server management methods to `DiscordChannel`, (2) extending the IPC handler with a `discord_manage` case, (3) creating a JSON config file defining the target server structure, and (4) implementing an idempotent bootstrap that creates missing categories/channels.

All required discord.js APIs (`guild.channels.create()`, `channel.delete()`, `channel.edit()`, `channel.permissionOverwrites.edit()`) are already available through the `Client` instance in `discord.ts`. The IPC pattern in `ipc.ts` is well-established with `processTaskIpc` switch-case and `isMain` authorization -- adding `discord_manage` follows the exact same pattern as `register_group` and `refresh_groups`.

**Primary recommendation:** Add a `discord_manage` case to the IPC switch in `ipc.ts` that delegates to new methods on the Discord channel instance. Bootstrap reads a JSON config, fetches current guild channels, and creates only what is missing (idempotent).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: `discord_manage` IPC message type with typed `action` field and `params` object -- matches existing IPC patterns (schedule_task, register_group)
- D-02: Actions: `create_channel`, `create_category`, `delete_channel`, `rename_channel`, `set_permissions`, `bootstrap`
- D-03: Main-group-only authorization -- reuse existing `isMain` check in ipc.ts
- D-04: JSON config file (`discord-server.json` or similar) defining target server structure -- categories and channels with their properties
- D-05: Bootstrap reads config, compares to current server state, creates missing categories/channels (idempotent -- safe to re-run)
- D-06: Target structure from PROJECT.md: General (#main, #agents), YourWave (#yw-tasks, #bugs, #progress), Dev (#dev-alerts, #logs), Admin (#bot-control)
- D-07: Basic read/write/send permissions per role -- sufficient for private ops server
- D-08: Permissions set via discord.js `channel.permissionOverwrites.edit()` -- per-channel overrides
- D-09: No complex role hierarchy -- single bot role with Administrator permission handles everything
- D-10: Log errors via pino + return failure status in IPC response so the requesting agent knows the operation failed
- D-11: Non-destructive on failure -- if channel creation fails, don't leave partial state

### Claude's Discretion
- Exact JSON config file schema and location
- Bootstrap idempotency strategy details
- IPC response format for success/failure
- Channel position ordering within categories

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRV-01 | Bot can create text channels programmatically via discord.js guild API | `guild.channels.create({ name, type: ChannelType.GuildText, parent })` -- verified in CLAUDE.md tech stack |
| SRV-02 | Bot can create channel categories (General, YourWave, Dev, Admin) | `guild.channels.create({ name, type: ChannelType.GuildCategory })` -- returns CategoryChannel |
| SRV-03 | Bot can delete and rename channels | `channel.delete()` and `channel.edit({ name })` -- both require ManageChannels (included in Administrator) |
| SRV-04 | Bot can set per-channel permissions | `channel.permissionOverwrites.edit(roleOrUser, { SendMessages: true/false, ... })` |
| SRV-05 | Server management exposed via IPC `discord_manage` message type (main group only) | Extends `processTaskIpc` switch-case with `isMain` guard -- follows `register_group` pattern exactly |
| SRV-06 | Bootstrap script creates initial server structure (categories + channels from config) | JSON config + idempotent comparison against `guild.channels.cache` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | ^14.25.1 | Guild channel/category management | Already in project. `guild.channels.create()`, `channel.delete()`, `channel.edit()`, `channel.permissionOverwrites.edit()` all built-in |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^9.6.0 | Logging | Already in project -- log all server management operations |
| zod | ^4.3.6 | Config validation | Validate the bootstrap JSON config schema |

### No Additional Libraries Needed
Everything required is already in the project. discord.js provides full guild management API. No new dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/
  discord-server-manager.ts    # Server management logic (create/delete/rename/permissions/bootstrap)
  ipc.ts                       # Extended with discord_manage case
  channels/discord.ts          # Exposes client/guild for server manager
config/
  discord-server.json          # Bootstrap target structure definition
```

### Pattern 1: IPC Command Dispatch
**What:** The `discord_manage` IPC type uses an `action` field to dispatch to specific operations, keeping the IPC switch-case clean.
**When to use:** When a single IPC type has multiple sub-operations.
**Example:**
```typescript
// In ipc.ts processTaskIpc switch-case:
case 'discord_manage': {
  if (!isMain) {
    logger.warn({ sourceGroup }, 'Unauthorized discord_manage attempt blocked');
    break;
  }
  // Delegate to server manager
  const result = await discordServerManager.handleAction(data.action, data.params);
  // Write result back to IPC response file
  break;
}
```

### Pattern 2: Idempotent Bootstrap
**What:** Bootstrap fetches current guild channels, compares against config, creates only missing items.
**When to use:** For the `bootstrap` action that sets up the full server structure.
**Example:**
```typescript
async function bootstrap(guild: Guild, config: ServerConfig): Promise<BootstrapResult> {
  const existing = guild.channels.cache;
  const results: string[] = [];

  for (const cat of config.categories) {
    let category = existing.find(c => c.name === cat.name && c.type === ChannelType.GuildCategory);
    if (!category) {
      category = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory });
      results.push(`Created category: ${cat.name}`);
    }
    for (const ch of cat.channels) {
      const existingCh = existing.find(c => c.name === ch.name && c.parentId === category.id);
      if (!existingCh) {
        await guild.channels.create({ name: ch.name, type: ChannelType.GuildText, parent: category.id });
        results.push(`Created channel: #${ch.name} in ${cat.name}`);
      }
    }
  }
  return { success: true, actions: results };
}
```

### Pattern 3: IPC Response Files
**What:** Write operation results back to the IPC directory so the requesting agent gets feedback.
**When to use:** For all `discord_manage` actions per D-10.
**Example:**
```typescript
// Write response to: data/ipc/{sourceGroup}/responses/{timestamp}.json
const response = { action: data.action, success: true, result: { channelId: '123', name: '#bugs' } };
fs.writeFileSync(responsePath, JSON.stringify(response));
```

### Pattern 4: Guild Access from DiscordChannel
**What:** The server manager needs access to the Discord `Client` and the target `Guild`. The `DiscordChannel` class holds `this.client` privately.
**When to use:** To expose guild access for server management without breaking encapsulation.
**Example:**
```typescript
// Add to DiscordChannel class:
getGuild(): Guild | null {
  if (!this.client?.isReady()) return null;
  // Single-server bot -- get first guild
  return this.client.guilds.cache.first() ?? null;
}
```

### Anti-Patterns to Avoid
- **Direct client access from IPC handler:** Don't pass the raw Discord client to ipc.ts. Instead, pass a server manager interface through IpcDeps.
- **Non-idempotent bootstrap:** Don't create channels without checking if they exist first. Always compare against `guild.channels.cache`.
- **Hardcoded channel names:** Put channel names in the JSON config, not in TypeScript code.
- **Missing error boundaries:** Each channel/category creation should be wrapped individually so one failure doesn't abort the entire bootstrap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Channel type enums | String literals like 'text' | `ChannelType.GuildText`, `ChannelType.GuildCategory` from discord.js | Type-safe, matches API |
| Permission bit flags | Manual bitfield math | `PermissionFlagsBits.SendMessages` etc. from discord.js | Discord changes permission bits across API versions |
| Channel name validation | Custom regex | Discord API rejects invalid names with clear errors | Discord enforces: lowercase, no spaces (converted to hyphens), 1-100 chars |
| Rate limiting | Custom queue | discord.js built-in rate limit handling | discord.js queues requests automatically per route |

**Key insight:** discord.js handles rate limiting, permission resolution, and caching internally. The server manager should be a thin wrapper calling discord.js guild methods, not reimplementing any of that logic.

## Common Pitfalls

### Pitfall 1: Guild Cache Not Populated
**What goes wrong:** `guild.channels.cache` is empty after bot connects, so bootstrap thinks everything needs creating.
**Why it happens:** The `Guilds` intent populates the cache on `ClientReady`, but if you access the guild too early or use a partial guild object, the cache may be empty.
**How to avoid:** Always access guild via `client.guilds.cache.first()` after `ClientReady` event. The bot already waits for `ClientReady` in `connect()`. For bootstrap, fetch fresh data with `guild.channels.fetch()` instead of relying solely on cache.
**Warning signs:** Bootstrap creates duplicate channels on re-run.

### Pitfall 2: Category ID vs Category Object
**What goes wrong:** Using a category name string as `parent` instead of the category ID/object.
**Why it happens:** `guild.channels.create({ parent })` expects a Snowflake (string ID) or CategoryChannel, not a name.
**How to avoid:** Always resolve category by fetching first, then use its `.id` as the `parent` parameter.
**Warning signs:** Channels created at top level instead of inside categories.

### Pitfall 3: Channel Name Normalization
**What goes wrong:** Creating channel `#yw-tasks` but searching for `yw-tasks` (without `#`). Or config says `YW-Tasks` but Discord lowercases to `yw-tasks`.
**Why it happens:** Discord normalizes channel names to lowercase and strips `#`. Config might use different casing.
**How to avoid:** Normalize names before comparison: `name.toLowerCase().replace(/^#/, '')`. Store names in config without `#` prefix, lowercase.
**Warning signs:** Bootstrap creates duplicate channels with same apparent name.

### Pitfall 4: IPC Response Timing
**What goes wrong:** Agent writes IPC command, immediately reads response file, gets nothing.
**Why it happens:** IPC is file-based with polling interval. Response isn't written yet.
**How to avoid:** Document that IPC responses are asynchronous. Agent should poll for response file or use a timeout. Alternatively, use a convention where the response file appears in `data/ipc/{group}/responses/` with a matching request ID.
**Warning signs:** Agent reports "no response" for operations that actually succeeded.

### Pitfall 5: Partial Bootstrap Failure
**What goes wrong:** Bootstrap creates 3 of 4 categories, then fails. Re-run creates duplicates of the first 3.
**Why it happens:** No idempotency check -- creates everything without checking what exists.
**How to avoid:** Per D-05, always check `guild.channels.cache` (or `guild.channels.fetch()`) before each create. Compare by name + type + parent.
**Warning signs:** Duplicate categories or channels after a retry.

## Code Examples

### Creating a Category
```typescript
import { ChannelType, Guild } from 'discord.js';

async function createCategory(guild: Guild, name: string): Promise<string> {
  const category = await guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
  });
  return category.id;
}
```

### Creating a Text Channel in a Category
```typescript
async function createTextChannel(guild: Guild, name: string, parentId: string): Promise<string> {
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parentId,
  });
  return channel.id;
}
```

### Setting Channel Permissions
```typescript
import { PermissionFlagsBits, TextChannel } from 'discord.js';

async function setBotOnlyPosting(channel: TextChannel, everyoneRoleId: string): Promise<void> {
  await channel.permissionOverwrites.edit(everyoneRoleId, {
    SendMessages: false,
    ViewChannel: true,
  });
}
```

### Deleting a Channel
```typescript
async function deleteChannel(guild: Guild, channelId: string): Promise<void> {
  const channel = await guild.channels.fetch(channelId);
  if (channel) {
    await channel.delete();
  }
}
```

### Renaming a Channel
```typescript
async function renameChannel(guild: Guild, channelId: string, newName: string): Promise<void> {
  const channel = await guild.channels.fetch(channelId);
  if (channel) {
    await channel.edit({ name: newName });
  }
}
```

### Bootstrap Config Schema (recommended)
```typescript
import { z } from 'zod';

const ChannelConfigSchema = z.object({
  name: z.string(),
  topic: z.string().optional(),
  permissions: z.record(z.boolean()).optional(),
});

const CategoryConfigSchema = z.object({
  name: z.string(),
  channels: z.array(ChannelConfigSchema),
});

const ServerConfigSchema = z.object({
  categories: z.array(CategoryConfigSchema),
});

type ServerConfig = z.infer<typeof ServerConfigSchema>;
```

### Example discord-server.json
```json
{
  "categories": [
    {
      "name": "General",
      "channels": [
        { "name": "main", "topic": "Main conversational channel" },
        { "name": "agents", "topic": "Friday/Alfred swarm output" }
      ]
    },
    {
      "name": "YourWave",
      "channels": [
        { "name": "yw-tasks", "topic": "Notion webhook task updates" },
        { "name": "bugs", "topic": "GitHub Issues bug reports" },
        { "name": "progress", "topic": "Progress tracker output" }
      ]
    },
    {
      "name": "Dev",
      "channels": [
        { "name": "dev-alerts", "topic": "CI/build/deploy notifications" },
        { "name": "logs", "topic": "System logs, container events" }
      ]
    },
    {
      "name": "Admin",
      "channels": [
        { "name": "bot-control", "topic": "Server management commands" }
      ]
    }
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| discord.js v13 `type: 'GUILD_TEXT'` | discord.js v14 `type: ChannelType.GuildText` | v14 (2022) | Must use enum, not strings |
| `channel.overwritePermissions()` | `channel.permissionOverwrites.edit()` | v14 | Method renamed |
| `guild.channels.create(name, options)` | `guild.channels.create({ name, ...options })` | v14 | Name moved into options object |

## Open Questions

1. **IPC Response Mechanism**
   - What we know: Current IPC is fire-and-forget (agent writes file, host processes and deletes it). No response channel exists.
   - What's unclear: Should responses be written to a `responses/` subdirectory? Should agent poll for them?
   - Recommendation: Write response files to `data/ipc/{sourceGroup}/responses/{requestId}.json`. Agent can poll or simply trust the operation. Keep it simple -- the agent can check Discord state directly if needed.

2. **Guild Resolution Strategy**
   - What we know: Bot is single-server. `client.guilds.cache.first()` works.
   - What's unclear: Should we support `DISCORD_GUILD_ID` env var for explicit targeting?
   - Recommendation: Use `client.guilds.cache.first()` for simplicity. Single-server bot has exactly one guild. No env var needed.

3. **Config File Location**
   - What we know: D-04 says "discord-server.json or similar"
   - Recommendation: Place at `config/discord-server.json` alongside other config. Load with `fs.readFileSync` + zod validation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/discord-server-manager.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRV-01 | Create text channel via guild API | unit | `npx vitest run src/discord-server-manager.test.ts -t "create_channel"` | Wave 0 |
| SRV-02 | Create category channels | unit | `npx vitest run src/discord-server-manager.test.ts -t "create_category"` | Wave 0 |
| SRV-03 | Delete and rename channels | unit | `npx vitest run src/discord-server-manager.test.ts -t "delete_channel\|rename_channel"` | Wave 0 |
| SRV-04 | Set per-channel permissions | unit | `npx vitest run src/discord-server-manager.test.ts -t "set_permissions"` | Wave 0 |
| SRV-05 | IPC discord_manage main-only auth | unit | `npx vitest run src/ipc-auth.test.ts -t "discord_manage"` | Wave 0 |
| SRV-06 | Bootstrap creates structure from config | unit | `npx vitest run src/discord-server-manager.test.ts -t "bootstrap"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/discord-server-manager.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/discord-server-manager.test.ts` -- covers SRV-01 through SRV-04, SRV-06 with mocked guild
- [ ] New tests in `src/ipc-auth.test.ts` -- covers SRV-05 (discord_manage authorization)
- [ ] Mock guild/channel objects for discord.js (vi.fn() mocks for guild.channels.create/fetch/delete)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/ipc.ts` -- existing IPC patterns, processTaskIpc switch-case, isMain authorization
- Codebase analysis: `src/channels/discord.ts` -- DiscordChannel class, client instance, connect flow
- Codebase analysis: `src/ipc-auth.test.ts` -- test patterns for IPC authorization
- Codebase analysis: `src/discord-group-utils.ts` -- reusable sanitization utilities
- CLAUDE.md Technology Stack -- Guild Management API Surface table with discord.js methods

### Secondary (MEDIUM confidence)
- discord.js v14 API patterns from CLAUDE.md documentation (verified against project's installed version)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - discord.js already in project, all APIs documented in CLAUDE.md tech stack
- Architecture: HIGH - follows established IPC patterns exactly, codebase fully analyzed
- Pitfalls: HIGH - based on known discord.js v14 behavior and codebase-specific IPC patterns

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- discord.js v14 API is mature)
