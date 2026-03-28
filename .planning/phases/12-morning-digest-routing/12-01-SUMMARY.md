---
phase: 12-morning-digest-routing
plan: 01
subsystem: routing
tags: [sqlite, routing, task-scheduler, webhook-router, discord]

# Dependency graph
requires:
  - phase: 06-webhook-routing
    provides: resolveTargets() function, routing.json config pattern
  - phase: 10-agent-status-reporting
    provides: sendToAgents wiring, DISCORD_AGENTS_CHANNEL_ID pattern
provides:
  - routing_tag column on scheduled_tasks table for config-driven task output routing
  - morning-digest routing entry in routing.json pointing to Discord #agents channel
  - isRouted guard pattern in task-scheduler.ts for suppressing original chatJid sends
affects: [13-health-monitoring, future task routing extensions]

# Tech tracking
tech-stack:
  added: []
  patterns: [routing_tag column for per-task output redirection, isRouted guard pattern in streaming callback]

key-files:
  created: []
  modified: [src/types.ts, src/db.ts, src/task-scheduler.ts, config/routing.json, src/db.test.ts, src/task-scheduler.test.ts]

key-decisions:
  - "Used broad OR matching (prompt LIKE '%morning%' OR '%digest%') for backfill instead of narrow AND to catch various prompt phrasings"
  - "Agents channel JID dc:1486971999543889972 discovered from container logs rather than .env (DISCORD_AGENTS_CHANNEL_ID not yet in .env)"
  - "resolveTargets fallback to main is filtered out via .filter(t => t.jid !== task.chat_jid) to prevent accidental double-send to Telegram"

patterns-established:
  - "routing_tag pattern: nullable TEXT column on scheduled_tasks, resolved via resolveTargets() at runTask() start, stored in isRouted boolean for consistent guard across all send sites"

requirements-completed: [DIGEST-01, DIGEST-02]

# Metrics
duration: 7min
completed: 2026-03-28
---

# Phase 12 Plan 01: Morning Digest Routing Summary

**Config-driven routing_tag column on scheduled_tasks routes morning digest output to Discord #agents via routing.json, suppressing Telegram main chat**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-28T08:11:12Z
- **Completed:** 2026-03-28T08:18:22Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Morning digest scheduled task output now routes to Discord #agents channel instead of Telegram main chat (DIGEST-01)
- Telegram main chat no longer receives morning digest output when routing targets resolve (DIGEST-02)
- Routing is fully config-driven: changing routing.json is all that is needed to reroute
- Tasks without routing_tag continue to work exactly as before (backward compatible)
- TDD approach: failing tests written first, then production code to make them pass

## Task Commits

Each task was committed atomically:

1. **Task 0: Write test stubs for DIGEST-01, DIGEST-02, and schema migration** - `e5e8662` (test - TDD RED)
2. **Task 1: Schema migration, type extension, routing.json config, and backfill** - `ac6a54a` (feat - TDD GREEN for db tests)
3. **Task 2: Route task output via routing_tag in runTask(), suppress Telegram** - `5e67102` (feat - TDD GREEN for all tests)

## Files Created/Modified
- `src/types.ts` - Added routing_tag?: string | null to ScheduledTask interface
- `src/db.ts` - ALTER TABLE migration, backfill with broad OR matching, createTask/updateTask accept routing_tag
- `src/task-scheduler.ts` - resolveTargets import, routing resolution at runTask() start, isRouted guard on streaming callback
- `config/routing.json` - morning-digest entry pointing to dc:1486971999543889972 (#agents channel)
- `src/db.test.ts` - routing_tag schema round-trip and null default tests
- `src/task-scheduler.test.ts` - DIGEST-01 routing and DIGEST-02 suppression tests with mocked resolveTargets and runContainerAgent

## Decisions Made
- Used broad OR matching (`prompt LIKE '%morning%' OR prompt LIKE '%digest%'`) for backfill instead of narrow AND pattern, to catch various prompt phrasings and avoid missing the task
- Agents channel JID `dc:1486971999543889972` was discovered from container logs in `groups/discord_agents/logs/` because `DISCORD_AGENTS_CHANNEL_ID` is not yet set in `.env`. The routing.json entry uses the actual channel snowflake directly
- Filtered resolveTargets results to exclude `task.chat_jid` to prevent accidental double-send when the fallback returns the main group (which is the same as the Telegram chat)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `DISCORD_AGENTS_CHANNEL_ID` was documented in the research as "already in .env" but was not actually present. Discovered the actual channel ID (`1486971999543889972`) from container logs in `groups/discord_agents/logs/`. The routing.json entry works regardless of the env var since it uses the direct channel snowflake.

## User Setup Required

None - no external service configuration required. The routing.json entry uses the actual Discord channel ID directly.

**Recommended:** Add `DISCORD_AGENTS_CHANNEL_ID=1486971999543889972` to `.env` to enable the `sendToAgents` embed pipeline from Phase 10.

## Next Phase Readiness
- Routing infrastructure proven for scheduled tasks - can be extended to other task types
- Phase 13 (health monitoring) can proceed independently
- The routing_tag pattern is generic and reusable for any scheduled task that needs output redirection

## Self-Check: PASSED

All 6 files verified present. All 3 task commits verified in git log.

---
*Phase: 12-morning-digest-routing*
*Completed: 2026-03-28*
