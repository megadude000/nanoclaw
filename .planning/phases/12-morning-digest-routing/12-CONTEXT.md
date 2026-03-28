# Phase 12: Morning Digest Routing - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (full autonomous approval — all decisions at Claude's discretion)

<domain>
## Phase Boundary

Route the morning digest (daily briefing scheduled task) to Discord #agents channel instead of
Telegram main chat. No behavior change — only routing change. The digest content stays the same.
Uses the existing `config/routing.json` webhook routing system.

</domain>

<decisions>
## Implementation Decisions

### Routing Mechanism
- Add `"morning-digest"` entry to `config/routing.json` pointing to Discord #agents JID
- The routing.json pattern is already used for github-issues, github-ci, notion, bugreport
- Morning digest task identified by its `group_folder` being the main group and `prompt` containing "digest" or "morning" (or a dedicated IPC type)

### How the morning digest currently works
- A scheduled task in SQLite with a cron schedule runs the digest prompt via runContainerAgent
- The agent output is sent back to the originating chatJid (the main group)
- To route to #agents: intercept the output in task-scheduler.ts and send to agentsJid
- Alternative: agent uses `send_message` tool with `target_jid` pointing to #agents

### Best approach: Agent-side routing via send_message
- Update the morning digest scheduled task's PROMPT to explicitly include:
  `"After generating the digest, call send_message with target_jid set to the DISCORD_AGENTS_JID env var to post to #agents. Do not output the digest to the main chat."`
- Pass `NANOCLAW_AGENTS_JID` env var into containers (new, set from DISCORD_AGENTS_CHANNEL_ID)
- This is zero-code-change — pure config change to the task prompt

### Alternative for robustness: Host-side suppression
- Tag morning digest tasks with a flag in SQLite (e.g., `routing_tag: 'morning-digest'`)
- In task-scheduler.ts, check routing.json for the tag and redirect output
- More reliable than prompt engineering

### Decision: Use routing.json + task metadata tag
- Add `routing_tag` column to scheduled_tasks table (nullable, defaults null)
- In task-scheduler, if `task.routing_tag` is set, resolve targets via webhook-router.ts
- Morning digest task gets `routing_tag: 'morning-digest'`
- config/routing.json gets `"morning-digest"` entry → discord #agents JID
- Telegram main chat no longer receives the digest output

### DIGEST-02: Remove from Telegram
- When routing_tag is set and targets found, suppress output to the original chatJid
- Original chatJid only receives output when no routing_tag or routing fails

### Claude's Discretion
- Whether to add the routing_tag column via migration or alter-table guard
- Whether to make Telegram suppression configurable or always suppress when routed

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `config/routing.json` — add "morning-digest" route here
- `src/webhook-router.ts` `resolveTargets()` — already handles JID resolution, use for task routing
- `src/db.ts` — SQLite schema, has existing ALTER TABLE guards for migrations
- `ScheduledTask` type in `src/types.ts` — extend with `routing_tag?`
- `src/task-scheduler.ts` `runTask()` — where to intercept and redirect output

### Established Patterns
- Nullable column migrations in src/db.ts use try/catch ALTER TABLE pattern
- `resolveTargets(type, registeredGroups)` returns `RouteTarget[]` array
- `sendMessage` dep in SchedulerDependencies — use for redirected output

### Integration Points
- `src/db.ts` — add routing_tag column with migration guard
- `src/types.ts` `ScheduledTask` interface — add routing_tag field
- `src/task-scheduler.ts` `runTask()` — check routing_tag after task completes, route output
- `config/routing.json` — add morning-digest entry
- The morning digest task row in SQLite needs updating (docs/instructions for user, or auto-update via migration)

</code_context>

<specifics>
## Specific Ideas

- Keep the change surgical — only task-scheduler.ts and db.ts need code changes
- The routing.json entry needs the actual Discord #agents channel JID
- Document env var `DISCORD_AGENTS_CHANNEL_ID` in README or env.example

</specifics>

<deferred>
## Deferred Ideas

- Per-task routing config UI — defer to v2.1
- Multiple routing targets (both Telegram AND Discord) for digests — defer to v2.1

</deferred>
