# Phase 5: Server Structure Management - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Bot programmatically creates and manages the Discord server structure (channels, categories, permissions) without manual Discord UI interaction. Exposed via IPC `discord_manage` message type restricted to main group only. Includes a bootstrap script that creates the full target server structure from config.

Requirements: SRV-01 (create channels), SRV-02 (create categories), SRV-03 (delete/rename), SRV-04 (set permissions), SRV-05 (IPC exposure), SRV-06 (bootstrap script).

</domain>

<decisions>
## Implementation Decisions

### IPC Command Format
- **D-01:** `discord_manage` IPC message type with typed `action` field and `params` object — matches existing IPC patterns (schedule_task, register_group)
- **D-02:** Actions: `create_channel`, `create_category`, `delete_channel`, `rename_channel`, `set_permissions`, `bootstrap`
- **D-03:** Main-group-only authorization — reuse existing `isMain` check in ipc.ts

### Bootstrap Approach
- **D-04:** JSON config file (`discord-server.json` or similar) defining target server structure — categories and channels with their properties
- **D-05:** Bootstrap reads config, compares to current server state, creates missing categories/channels (idempotent — safe to re-run)
- **D-06:** Target structure from PROJECT.md: General (#main, #agents), YourWave (#yw-tasks, #bugs, #progress), Dev (#dev-alerts, #logs), Admin (#bot-control)

### Permission Model
- **D-07:** Basic read/write/send permissions per role — sufficient for private ops server
- **D-08:** Permissions set via discord.js `channel.permissionOverwrites.edit()` — per-channel overrides
- **D-09:** No complex role hierarchy — single bot role with Administrator permission handles everything

### Error Handling
- **D-10:** Log errors via pino + return failure status in IPC response so the requesting agent knows the operation failed
- **D-11:** Non-destructive on failure — if channel creation fails, don't leave partial state

### Claude's Discretion
- Exact JSON config file schema and location
- Bootstrap idempotency strategy details
- IPC response format for success/failure
- Channel position ordering within categories

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### IPC System
- `src/ipc.ts` — IPC message handler, `isMain` authorization check (line 84), existing message types
- `src/ipc-auth.test.ts` — IPC authorization test patterns

### Discord Channel Management
- `src/channels/discord.ts` — Discord channel implementation, `client` access for guild API
- `CLAUDE.md` §Technology Stack — Guild Management API Surface table with discord.js methods

### Server Structure
- `.planning/PROJECT.md` — Target Discord server structure (General, YourWave, Dev, Admin categories)

### Group Registration (Phase 4)
- `src/discord-group-utils.ts` — Channel name sanitization utilities (reusable for bootstrap)
- `src/channels/registry.ts` — ChannelOpts with registerGroup callback

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `discord.ts` has `this.client` with full guild access — guild.channels.create(), guild.roles.create()
- IPC handler in `ipc.ts` already has switch-case pattern for message types — add `discord_manage` case
- `isMain` authorization pattern already blocks non-main groups from sensitive operations
- `sanitizeDiscordChannelName()` from Phase 4 can be reused for channel name validation

### Established Patterns
- IPC messages: `{ type: string, ...data }` format with switch-case handler
- Authorization: `isMain || (targetGroup.folder === sourceGroup)` — server management is main-only
- discord.js guild API: `guild.channels.create({ name, type, parent })` for channels/categories

### Integration Points
- `ipc.ts` switch-case: add `discord_manage` handler
- `discord.ts`: expose server management methods (createChannel, deleteChannel, etc.)
- New config file for bootstrap target structure
- `index.ts`: pass Discord client reference to IPC handler for server management

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

*Phase: 05-server-structure-management*
*Context gathered: 2026-03-26 via auto-mode*
