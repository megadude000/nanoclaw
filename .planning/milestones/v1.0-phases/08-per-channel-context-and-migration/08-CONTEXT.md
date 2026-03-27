# Phase 8: Per-Channel Context and Migration - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Each Discord channel gets themed AI behavior via channel-specific CLAUDE.md content (not just stubs), with Cortex knowledge section references. Notifications gradually migrate from Telegram to Discord by toggling routing config targets.

Requirements: CTX-01 (themed CLAUDE.md per channel), CTX-02 (#bugs bug-triage mode), CTX-03 (#yw-tasks PM mode), CTX-04 (Cortex knowledge references), CTX-05 (channel theme applied at agent runtime), MIG-01 (dual-send enabled by default), MIG-02 (per-webhook migration toggle), MIG-03 (disable Telegram per webhook type), MIG-04 (migration verification).

</domain>

<decisions>
## Implementation Decisions

### Channel-Specific CLAUDE.md Content
- **D-01:** Replace Phase 4 generic stubs with rich themed templates per channel purpose
- **D-02:** Templates defined per target channel from PROJECT.md structure:
  - `#main` — conversational, general assistant, backup to Telegram
  - `#agents` — swarm output display, Friday/Alfred activity feed
  - `#yw-tasks` — project management mode, Notion task context
  - `#bugs` — bug triage mode, GitHub Issues context
  - `#progress` — progress tracking, build status, read-mostly
  - `#dev-alerts` — CI/CD notifications, deployment alerts
  - `#logs` — system logs, container events, minimal interaction
  - `#bot-control` — server management commands, admin mode
- **D-03:** Templates are static files in `config/channel-templates/` — copied to group folder on bootstrap or first registration

### Cortex Knowledge Integration
- **D-04:** CLAUDE.md references Cortex vault paths (e.g., `See cortex/bugs/ for known issues`) — no runtime code changes needed
- **D-05:** Agent already mounts group directory with CLAUDE.md — Cortex references work via existing mount system
- **D-06:** If Cortex vault doesn't exist yet, CLAUDE.md references are forward-compatible (agent ignores missing paths)

### Migration Toggle
- **D-07:** Extend `config/routing.json` target entries with optional `enabled` field (default: `true`)
- **D-08:** `resolveTargets()` in webhook-router.ts filters out targets where `enabled === false`
- **D-09:** Migration flow: start with both targets enabled (dual-send) → verify Discord works → set Telegram `enabled: false`

### Migration Verification
- **D-10:** Manual verification per webhook type — no automated migration, user controls the toggle
- **D-11:** Document migration checklist in project docs

### Claude's Discretion
- Exact CLAUDE.md template content per channel
- Cortex vault path conventions
- Whether to add `enabled` field to routing schema or keep it simple
- Template file naming convention

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Per-Channel Context (existing)
- `src/discord-group-utils.ts` — `createGroupStub()` creates minimal CLAUDE.md (to be replaced with rich templates)
- `src/channels/discord.ts` — Auto-registration writes CLAUDE.md stub (line 192-198)
- `src/container-runner.ts` — Mounts group directory into agent container (line 115-122)
- `groups/` — Existing group directories with CLAUDE.md files

### Routing Config (Phase 6)
- `config/routing.json` — Per-webhook routing targets
- `src/webhook-router.ts` — `resolveTargets()`, `RoutingConfigSchema` — add `enabled` field

### Server Structure (Phase 5)
- `config/discord-server.json` — Target channel names for template mapping
- `src/discord-server-manager.ts` — Bootstrap creates channels

### Project Structure
- `.planning/PROJECT.md` — Target Discord server structure (channel purposes)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createGroupStub()` already generates CLAUDE.md — enhance to use rich templates based on channel name
- `resolveTargets()` already loads routing.json — add `enabled` filter
- Container runner already mounts CLAUDE.md — no changes needed for agent to read themed instructions
- Bootstrap from Phase 5 creates channels — can also install CLAUDE.md templates

### Established Patterns
- Config files in `config/` directory
- Zod validation for config schemas
- Group directory with CLAUDE.md for agent context

### Integration Points
- `src/discord-group-utils.ts` — enhance `createGroupStub()` or add template selection logic
- `src/webhook-router.ts` — add `enabled` field to target schema
- `config/routing.json` — add `enabled: true/false` per target
- New `config/channel-templates/` directory with per-channel CLAUDE.md templates

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

*Phase: 08-per-channel-context-and-migration*
*Context gathered: 2026-03-27 via auto-mode*
