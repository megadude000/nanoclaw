# Phase 4: Group Registration - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Each Discord channel operates as an isolated NanoClaw group with its own workspace directory (`groups/dc-{name}/`) and IPC authorization rules. Discord channels auto-register as groups when the bot receives a first message, following the same pattern as Telegram. The main Discord channel is designated via env var and gets elevated IPC privileges.

Requirements: GRP-01 (JID format), GRP-02 (isolated workspace), GRP-03 (main IPC access), GRP-04 (non-main IPC restriction).

</domain>

<decisions>
## Implementation Decisions

### Group Folder Naming
- **D-01:** Human-readable folder names derived from Discord channel name — `dc-main`, `dc-bugs`, `dc-yw-tasks`
- **D-02:** Sanitize channel names: lowercase, replace spaces/special chars with hyphens, prefix with `dc-`
- **D-03:** If collision occurs (two channels with same sanitized name), append channel ID suffix as tiebreaker

### Registration Method
- **D-04:** Auto-register Discord channels as groups on first message via `onChatMetadata` callback — same pattern as Telegram
- **D-05:** No explicit registration command needed — zero friction per channel

### Main Channel Designation
- **D-06:** New env var `DISCORD_MAIN_CHANNEL_ID` specifies the main Discord channel
- **D-07:** Channel matching this ID gets `isMain: true`, `requiresTrigger: false`, and full IPC send privileges
- **D-08:** Non-main Discord channels get `requiresTrigger: true` and can only IPC to their own JID — existing authorization logic applies unchanged

### Workspace Bootstrapping
- **D-09:** On registration, create `groups/dc-{name}/CLAUDE.md` with minimal stub (channel name, basic instructions)
- **D-10:** Phase 8 later replaces stub with themed, Cortex-aware CLAUDE.md per channel

### Claude's Discretion
- Exact CLAUDE.md stub template wording
- Channel name sanitization edge cases (emoji, unicode)
- Logging verbosity for registration events

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Group Registration System
- `src/db.ts` — `setRegisteredGroup()`, `getRegisteredGroup()`, `registered_groups` table schema
- `src/index.ts` — `onChatMetadata` callback, group folder creation, `resolveGroupFolderPath()`
- `src/types.ts` — `RegisteredGroup` interface (lines 35-43), `OnChatMetadata` type (lines 111-117)

### IPC Authorization
- `src/ipc.ts` — IPC message routing with `isMain` check (line 84), `register_group` handler (lines 430-458)
- `src/ipc-auth.test.ts` — Authorization test patterns (isMain || targetGroup.folder === sourceGroup)

### Channel Registry Pattern
- `src/channels/registry.ts` — `registerChannel()` factory pattern, `ChannelOpts` interface
- `src/channels/discord.ts` — Current Discord channel with `dc:` JID prefix, `onChatMetadata` calls
- `src/channels/telegram.ts` — Reference implementation for `onChatMetadata` usage

### Existing Group Structure
- `groups/main/` — Existing main group directory (reference for folder structure)
- `src/group-folder.ts` — `resolveGroupFolderPath()` utility

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `onChatMetadata` callback in `ChannelOpts` — already wired for chat discovery in Discord channel
- `setRegisteredGroup(jid, group)` in db.ts — persists group to SQLite, handles `isMain` flag
- `resolveGroupFolderPath(folder)` — resolves and validates group folder paths
- `isValidGroupFolder(folder)` in ipc.ts — defense-in-depth folder name validation

### Established Patterns
- Telegram uses `onChatMetadata` to register chats as they're discovered — Discord should follow same flow
- `isMain` flag stored in `registered_groups` table, checked via `group.isMain === true`
- IPC authorization: `isMain || (targetGroup && targetGroup.folder === sourceGroup)` — no changes needed
- Group folders created under `groups/` with `fs.mkdirSync(groupDir, { recursive: true })`

### Integration Points
- Discord `messageCreate` handler already calls `onChatMetadata` — needs to pass group registration data
- `src/index.ts` group registration handler creates folder and calls `setRegisteredGroup`
- `DISCORD_MAIN_CHANNEL_ID` env var needs to be read in discord.ts and compared during registration
- Existing `groups/main/` is the Telegram main group — Discord main would be `groups/dc-main/`

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

*Phase: 04-group-registration*
*Context gathered: 2026-03-26*
