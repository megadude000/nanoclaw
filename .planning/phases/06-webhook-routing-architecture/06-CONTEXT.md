# Phase 6: Webhook Routing Architecture - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Replace hardcoded `mainJid` routing in webhook handlers with a configurable routing layer. Each webhook type (GitHub Issues, Notion, progress tracker, GitHub CI) gets a routing config entry specifying target platform(s): Telegram, Discord, or both. Dual-send mode delivers the same notification to both platforms during migration.

Requirements: ROUT-01 (routing abstraction), ROUT-02 (GitHub Issues → #bugs), ROUT-03 (Notion → #yw-tasks), ROUT-04 (progress → #progress), ROUT-05 (per-webhook config), ROUT-06 (dual-send).

</domain>

<decisions>
## Implementation Decisions

### Routing Config Format
- **D-01:** JSON config file (`config/routing.json`) — declarative, matches Phase 5 pattern (discord-server.json), easy to edit
- **D-02:** Config read fresh on every webhook invocation — webhooks are infrequent, simplest approach, instant config changes without restart
- **D-03:** Zod validation of config at load time — same pattern as Phase 5 bootstrap

### Routing Granularity
- **D-04:** Per webhook type routing — one config entry per handler (github-issues, notion, progress, github-ci, bugreport)
- **D-05:** Each entry specifies `targets: ["telegram", "discord"]` or subset — array allows dual-send naturally
- **D-06:** Discord target includes channel JID (`dc:{channelId}`) so routing knows which Discord channel to use

### Dual-Send and Failure Handling
- **D-07:** Best-effort delivery — send to all configured targets, log errors but don't block other targets
- **D-08:** Each target send wrapped in try/catch — one platform failing doesn't prevent delivery to the other
- **D-09:** Pino logging for routing decisions and failures — matches existing error handling patterns (D-10 from Phase 5)

### Routing Abstraction
- **D-10:** Single `resolveTargets(webhookType)` function that reads config and returns array of `{ jid, group }` entries
- **D-11:** Webhook handlers call `resolveTargets()` instead of `Object.entries(groups).find(([, g]) => g.isMain)` — minimal change to existing handlers
- **D-12:** Default fallback: if no config exists or webhook type not configured, fall back to mainJid (backward compatible)

### Claude's Discretion
- Exact JSON config schema structure and field names
- Whether resolveTargets returns JIDs or full group entries
- Helper function location (new file vs added to existing router.ts)
- Order of dual-send delivery (parallel vs sequential)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Webhook Handlers (files to modify)
- `src/github-issues-webhook.ts` — GitHub Issues handler, hardcoded mainJid routing (line 44-50)
- `src/notion-webhook.ts` — Notion webhook handler, hardcoded mainJid routing (line 139-147)
- `src/github-webhook.ts` — GitHub CI/workflow handler, hardcoded mainJid routing (line 134-142)
- `src/progress-tracker.ts` — Progress tracker, already JID-agnostic via function deps (chatJid from state)
- `src/bugreport-webhook.ts` — Bug report handler, creates GitHub issues (may not need routing change)

### Existing Routing Infrastructure
- `src/router.ts` — Message formatting and outbound routing
- `src/index.ts` — Orchestrator, passes deps to webhook handlers, mainEntry lookup (line 671-680)

### Config Pattern (from Phase 5)
- `config/discord-server.json` — Existing JSON config pattern with zod validation
- `src/discord-server-manager.ts` — Zod schema + fs.readFileSync pattern for config loading

### Group System
- `src/channels/registry.ts` — Channel registry, RegisteredGroup type
- `src/types.ts` — RegisteredGroup interface with isMain field

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- All webhook handlers use identical `Object.entries(groups).find(([, g]) => g.isMain)` pattern — easy to replace with `resolveTargets()`
- `config/discord-server.json` + zod validation pattern from Phase 5 can be reused for `config/routing.json`
- `src/router.ts` already handles outbound message formatting — routing config is a natural extension

### Established Patterns
- Webhook handlers receive `registeredGroups` as a dependency and use `createTask()` to schedule agent work
- Progress tracker uses function deps (sendMsg, editMsg) — already platform-agnostic, just needs the right JID
- Error logging via pino with structured context objects

### Integration Points
- `src/index.ts` — where webhook handlers are initialized with deps (registeredGroups, createTask)
- Each webhook handler's mainEntry lookup — replace with resolveTargets() call
- New `config/routing.json` config file
- New routing resolver module (or extend existing router.ts)

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

*Phase: 06-webhook-routing-architecture*
*Context gathered: 2026-03-26 via auto-mode*
