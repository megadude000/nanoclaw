# Phase 4: Group Registration - Research

**Researched:** 2026-03-26
**Domain:** NanoClaw group registration system, IPC authorization, Discord channel-to-group mapping
**Confidence:** HIGH

## Summary

Phase 4 wires Discord channels into NanoClaw's existing group registration system. The codebase already has a complete group registration infrastructure: `registerGroup()` in `src/index.ts` creates filesystem directories and persists to SQLite via `setRegisteredGroup()`, the `onChatMetadata` callback discovers new chats, and `src/ipc.ts` enforces authorization via the `isMain || targetGroup.folder === sourceGroup` pattern. The IPC authorization logic requires zero changes.

The primary work is making `discord.ts` call the registration flow with properly formatted data when a new channel is encountered: deriving a human-readable folder name from the Discord channel name, comparing channel ID against `DISCORD_MAIN_CHANNEL_ID` env var, and creating the group directory with a stub CLAUDE.md. The existing `GROUP_FOLDER_PATTERN` (`/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/`) constrains folder naming -- the sanitization function must produce names matching this regex.

**Primary recommendation:** Implement a `sanitizeDiscordChannelName()` utility that converts Discord channel names to valid group folder names, then wire it into the existing `onChatMetadata` -> `registerGroup` flow with `isMain` detection via `DISCORD_MAIN_CHANNEL_ID` env var.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Human-readable folder names derived from Discord channel name -- `dc-main`, `dc-bugs`, `dc-yw-tasks`
- **D-02:** Sanitize channel names: lowercase, replace spaces/special chars with hyphens, prefix with `dc-`
- **D-03:** If collision occurs (two channels with same sanitized name), append channel ID suffix as tiebreaker
- **D-04:** Auto-register Discord channels as groups on first message via `onChatMetadata` callback -- same pattern as Telegram
- **D-05:** No explicit registration command needed -- zero friction per channel
- **D-06:** New env var `DISCORD_MAIN_CHANNEL_ID` specifies the main Discord channel
- **D-07:** Channel matching this ID gets `isMain: true`, `requiresTrigger: false`, and full IPC send privileges
- **D-08:** Non-main Discord channels get `requiresTrigger: true` and can only IPC to their own JID -- existing authorization logic applies unchanged
- **D-09:** On registration, create `groups/dc-{name}/CLAUDE.md` with minimal stub (channel name, basic instructions)
- **D-10:** Phase 8 later replaces stub with themed, Cortex-aware CLAUDE.md per channel

### Claude's Discretion
- Exact CLAUDE.md stub template wording
- Channel name sanitization edge cases (emoji, unicode)
- Logging verbosity for registration events

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRP-01 | Discord channels registered as NanoClaw groups with JID format `dc:{channelId}` | JID format already used in `discord.ts` line 58: `const chatJid = \`dc:${channelId}\``; `ownsJid` checks `jid.startsWith('dc:')`. No changes needed for JID format. |
| GRP-02 | Each registered Discord channel has its own isolated `groups/{folder}/` workspace | `registerGroup()` in `index.ts` (line 106-128) creates `groups/{folder}/logs/` directory. Need to add CLAUDE.md stub creation per D-09. Folder name derived via new sanitization function per D-01/D-02/D-03. |
| GRP-03 | Main Discord channel can send to all other groups via IPC | IPC authorization at `ipc.ts` line 97-98: `isMain || (targetGroup && targetGroup.folder === sourceGroup)`. Setting `isMain: true` on the group (D-07) enables this automatically. Zero IPC code changes needed. |
| GRP-04 | Non-main Discord channels restricted to own JID per IPC authorization | Same authorization check. Non-main groups default to `requiresTrigger: true` (D-08). Existing logic handles this. Zero IPC code changes needed. |
</phase_requirements>

## Architecture Patterns

### Current Registration Flow (Telegram reference)

```
Message arrives in discord.ts
  -> onChatMetadata(chatJid, timestamp, chatName, 'discord', isGroup)  [line 146-152]
    -> storeChatMetadata() in db.ts (stores in chats table)
  -> registeredGroups()[chatJid] check [line 155]
    -> If not registered: log debug, return (message dropped)
    -> If registered: deliver via onMessage
```

**Key insight:** Currently, `onChatMetadata` only stores chat metadata. It does NOT trigger group registration. Group registration happens through IPC `register_group` messages from the main group agent. For Discord, we need auto-registration on first message (D-04/D-05).

### Proposed Registration Flow

```
Message arrives in discord.ts
  -> onChatMetadata(chatJid, timestamp, chatName, 'discord', isGroup)
  -> Check if group already registered: registeredGroups()[chatJid]
  -> If NOT registered:
    1. Sanitize channel name -> folder name (dc-{sanitized})
    2. Check DISCORD_MAIN_CHANNEL_ID match -> set isMain/requiresTrigger
    3. Call new onRegisterGroup callback OR extend onChatMetadata
    4. Create groups/dc-{name}/ directory with CLAUDE.md stub
  -> Proceed with message delivery
```

### Implementation Approach: Extend DiscordChannel Constructor

The cleanest approach is to add auto-registration logic inside `discord.ts`'s `messageCreate` handler, between the `onChatMetadata` call and the `registeredGroups` check. This keeps registration co-located with the channel that triggers it.

Two options for the registration call:
1. **Option A:** Call `registerGroup` directly via a new callback in `DiscordChannelOpts` -- mirrors how IPC calls `deps.registerGroup()`
2. **Option B:** Extend `ChannelOpts` with an optional `onGroupRegistration` callback

**Recommendation:** Option A -- add `registerGroup` callback to `DiscordChannelOpts` since auto-registration is Discord-specific behavior, not a generic channel concern.

### Recommended File Changes

```
src/channels/discord.ts    -- Add auto-registration logic, read DISCORD_MAIN_CHANNEL_ID
src/discord-group-utils.ts -- New file: sanitizeDiscordChannelName(), createGroupStub()
src/index.ts               -- Pass registerGroup callback to Discord channel factory
src/config.ts              -- (optional) Add DISCORD_MAIN_CHANNEL_ID constant
```

### Sanitization Function Pattern

```typescript
// src/discord-group-utils.ts
const GROUP_FOLDER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function sanitizeDiscordChannelName(channelName: string): string {
  let sanitized = channelName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '');        // Trim leading/trailing hyphens

  if (!sanitized || !/^[a-z0-9]/.test(sanitized)) {
    sanitized = 'channel';  // Fallback for entirely non-ascii names
  }

  // Prefix with dc-
  const folder = `dc-${sanitized}`;

  // Truncate to 64 chars (GROUP_FOLDER_PATTERN max)
  return folder.slice(0, 64);
}

export function sanitizeWithCollisionCheck(
  channelName: string,
  channelId: string,
  existingFolders: Set<string>,
): string {
  const base = sanitizeDiscordChannelName(channelName);
  if (!existingFolders.has(base)) return base;
  // Append short channel ID suffix as tiebreaker (D-03)
  const suffix = channelId.slice(-6);
  return `${base.slice(0, 57)}-${suffix}`;
}
```

### CLAUDE.md Stub Template

```typescript
export function createGroupStub(channelName: string, isMain: boolean): string {
  const lines = [
    `# ${channelName}`,
    '',
    `Discord channel group.${isMain ? ' This is the main channel.' : ''}`,
    '',
    '## Instructions',
    '',
    'Respond helpfully to messages in this channel.',
  ];
  return lines.join('\n') + '\n';
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Group folder validation | Custom regex | `isValidGroupFolder()` from `src/group-folder.ts` | Already handles path traversal, reserved names, pattern matching |
| Group persistence | Custom file storage | `setRegisteredGroup()` from `src/db.ts` | SQLite with proper schema, migration-safe |
| IPC authorization | Custom auth checks | Existing `isMain \|\| targetGroup.folder === sourceGroup` pattern in `src/ipc.ts` | Battle-tested, covers all edge cases |
| Directory creation | Custom mkdir logic | `registerGroup()` in `src/index.ts` | Creates folder + logs subdirectory, validates path |

## Common Pitfalls

### Pitfall 1: GROUP_FOLDER_PATTERN Mismatch
**What goes wrong:** Sanitized Discord channel names fail `isValidGroupFolder()` validation.
**Why it happens:** `GROUP_FOLDER_PATTERN` requires `^[A-Za-z0-9]` as first character. If sanitization produces a leading hyphen or the `dc-` prefix somehow gets mangled, registration silently fails.
**How to avoid:** Unit test sanitization output against `isValidGroupFolder()` for edge cases: empty names, all-emoji names, names starting with special characters.
**Warning signs:** "Rejecting group registration with invalid folder" log messages.

### Pitfall 2: Race Condition on First Message
**What goes wrong:** Multiple messages arrive simultaneously for an unregistered channel, triggering multiple registration attempts.
**Why it happens:** `messageCreate` fires per message; if two arrive before the first registration completes, both attempt to register.
**How to avoid:** Check `registeredGroups()` cache AND use `setRegisteredGroup()` with `INSERT OR REPLACE` (already handles this). Add a local Set of "registration in progress" JIDs.
**Warning signs:** Duplicate "Group registered" log entries for the same JID.

### Pitfall 3: Missing DISCORD_MAIN_CHANNEL_ID
**What goes wrong:** No Discord channel gets `isMain: true`, so no Discord group can cross-send IPC messages.
**Why it happens:** Env var not set or set incorrectly.
**How to avoid:** Log a warning at startup if `DISCORD_MAIN_CHANNEL_ID` is not set. All Discord channels register as non-main (safe default).
**Warning signs:** All Discord channels require trigger pattern, none have elevated IPC privileges.

### Pitfall 4: Folder Collision Without Detection
**What goes wrong:** Two Discord channels with similar names (e.g., "bugs" and "bugs!") get the same sanitized folder name, causing data mixing.
**Why it happens:** Different channel names sanitize to identical strings.
**How to avoid:** Check existing registered group folders before registering; append channel ID suffix on collision (D-03).
**Warning signs:** `INSERT OR REPLACE` on `registered_groups` overwrites a different channel's registration.

### Pitfall 5: Existing Group Folder Check
**What goes wrong:** The `registered_groups` table `folder` column has a UNIQUE constraint (line 79 in db.ts schema). If two JIDs map to the same folder, the second registration will overwrite the first.
**How to avoid:** Before calling `setRegisteredGroup()`, query existing groups to check for folder collision. The collision-check in `sanitizeWithCollisionCheck` must check the DB, not just an in-memory set.
**Warning signs:** SQLite `UNIQUE constraint failed` or silent overwrites.

## Code Examples

### Auto-Registration in messageCreate Handler

```typescript
// In discord.ts messageCreate handler, after onChatMetadata call:

// Auto-register Discord channel as group on first message
if (!this.opts.registeredGroups()[chatJid]) {
  const mainChannelId = process.env.DISCORD_MAIN_CHANNEL_ID || '';
  const isMain = channelId === mainChannelId;

  const existingFolders = new Set(
    Object.values(this.opts.registeredGroups()).map(g => g.folder)
  );
  const textChannel = message.channel as TextChannel;
  const folder = sanitizeWithCollisionCheck(
    textChannel.name,
    channelId,
    existingFolders,
  );

  this.opts.registerGroup(chatJid, {
    name: chatName,
    folder,
    trigger: `@${ASSISTANT_NAME}`,
    added_at: new Date().toISOString(),
    requiresTrigger: !isMain,
    isMain: isMain || undefined,
  });

  // Create CLAUDE.md stub
  const groupDir = path.join(GROUPS_DIR, folder);
  const claudePath = path.join(groupDir, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) {
    fs.writeFileSync(claudePath, createGroupStub(chatName, isMain));
  }
}
```

### Wiring registerGroup in index.ts

```typescript
// In main() channelOpts, the existing ChannelOpts does NOT include registerGroup.
// Option: Discord channel factory receives it separately.

// In the channel creation loop or via a Discord-specific wrapper:
const discordChannel = factory({
  ...channelOpts,
  // Discord-specific: pass registerGroup for auto-registration
}) as DiscordChannel;

// Alternative: Expand ChannelOpts interface (affects all channels)
// Or: Pass registerGroup through DiscordChannelOpts constructor
```

### Existing registerGroup Function (index.ts line 106-128)

```typescript
function registerGroup(jid: string, group: RegisteredGroup): void {
  let groupDir: string;
  try {
    groupDir = resolveGroupFolderPath(group.folder);
  } catch (err) {
    logger.warn({ jid, folder: group.folder, err }, 'Rejecting group registration');
    return;
  }
  registeredGroups[jid] = group;
  setRegisteredGroup(jid, group);
  fs.mkdirSync(path.join(groupDir, 'logs'), { recursive: true });
  logger.info({ jid, name: group.name, folder: group.folder }, 'Group registered');
}
```

Note: The CLAUDE.md stub creation (D-09) should be added to this function or done by the caller. Adding it to `registerGroup()` would apply to all channels; doing it in the Discord handler keeps it Discord-specific for now (Phase 8 will customize stubs).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | vitest.config.ts (or package.json) |
| Quick run command | `npx vitest run src/discord-group-utils.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRP-01 | Discord JID format `dc:{channelId}` used consistently | unit | `npx vitest run src/channels/discord.test.ts -t "jid format"` | Partial (discord.test.ts exists) |
| GRP-02 | Group folder created with CLAUDE.md stub | unit | `npx vitest run src/discord-group-utils.test.ts -x` | No - Wave 0 |
| GRP-03 | Main Discord channel has isMain=true, full IPC | unit | `npx vitest run src/ipc-auth.test.ts -t "main group can send"` | Yes (existing covers pattern) |
| GRP-04 | Non-main restricted to own JID | unit | `npx vitest run src/ipc-auth.test.ts -t "non-main group cannot send"` | Yes (existing covers pattern) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/discord-group-utils.test.ts src/ipc-auth.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/discord-group-utils.test.ts` -- covers GRP-02: sanitization function, collision handling, stub creation, GROUP_FOLDER_PATTERN compliance
- [ ] Update `src/channels/discord.test.ts` -- covers GRP-01: auto-registration on first message, isMain detection
- [ ] Update `src/ipc-auth.test.ts` -- add Discord-specific JID tests (`dc:123456`) to existing authorization tests for GRP-03/GRP-04

## Sources

### Primary (HIGH confidence)
- `src/index.ts` lines 106-128 -- registerGroup() implementation
- `src/ipc.ts` lines 94-111 -- IPC message authorization (isMain || folder match)
- `src/db.ts` lines 76-84 -- registered_groups schema with UNIQUE folder constraint
- `src/group-folder.ts` lines 5-16 -- GROUP_FOLDER_PATTERN and isValidGroupFolder()
- `src/channels/discord.ts` lines 53-178 -- messageCreate handler with onChatMetadata
- `src/types.ts` lines 35-43 -- RegisteredGroup interface
- `src/ipc-auth.test.ts` -- existing authorization test patterns

### Secondary (MEDIUM confidence)
- Discord channel names are already URL-safe slugs (lowercase, hyphens) per Discord's own rules -- simplifies sanitization

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all infrastructure exists
- Architecture: HIGH -- clear pattern from Telegram, direct code references
- Pitfalls: HIGH -- identified from direct code analysis (UNIQUE constraint, race conditions, validation regex)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable internal codebase, no external dependencies)
