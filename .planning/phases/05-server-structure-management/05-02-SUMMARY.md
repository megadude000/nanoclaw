---
phase: 05-server-structure-management
plan: 02
subsystem: discord-server-management
tags: [discord, bootstrap, idempotent, server-structure]
dependency_graph:
  requires: [05-01]
  provides: [bootstrap-action, server-config]
  affects: [discord-server-manager]
tech_stack:
  added: [zod-validation]
  patterns: [idempotent-bootstrap, partial-failure-handling, config-driven-structure]
key_files:
  created:
    - config/discord-server.json
  modified:
    - src/discord-server-manager.ts
    - src/discord-server-manager.test.ts
decisions:
  - "Used Array.from() on channel map values for iteration compatibility with both discord.js Collection and plain Map in tests"
  - "Zod v4 requires explicit key schema for z.record() -- used z.record(z.string(), z.boolean())"
  - "Config path resolved relative to project root via import.meta.url / fileURLToPath"
metrics:
  duration: 4m
  completed: 2026-03-26
  tasks: 1
  files: 3
---

# Phase 05 Plan 02: Bootstrap Config and Idempotent Server Structure Creation Summary

Idempotent bootstrap action that reads config/discord-server.json, validates with zod, fetches current guild state, and creates only missing categories/channels with partial failure handling.

## What Was Done

### Task 1: Create bootstrap config and implement idempotent bootstrap action

**Config file** (`config/discord-server.json`): Defines 4 categories (General, YourWave, Dev, Admin) with 8 text channels total, each with topic descriptions.

**Zod schemas** added to `src/discord-server-manager.ts`: `ChannelConfigSchema`, `CategoryConfigSchema`, `ServerConfigSchema` with proper Zod v4 syntax.

**Bootstrap action** added to `handleAction` dispatch:
- Reads and validates config via `loadConfig()` with zod
- Fetches ALL guild channels fresh from API (not cache) for accurate state
- Case-insensitive category name matching
- Channel matching by name + parentId
- Each create wrapped in try/catch for partial failure resilience
- Returns `{ success, created, skipped, errors, total_created, total_skipped }`

**Tests added** (5 new, 15 total):
1. Empty guild: creates all 12 items (4 categories + 8 channels)
2. Full guild (idempotent): creates nothing, skips all 12
3. Partial structure: creates only missing items
4. Invalid config: returns validation error
5. Partial failure: continues after one create fails, reports errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 z.record() requires two arguments**
- **Found during:** Task 1 build verification
- **Issue:** `z.record(z.boolean())` fails in Zod v4 which requires explicit key schema
- **Fix:** Changed to `z.record(z.string(), z.boolean())`
- **Files modified:** src/discord-server-manager.ts

**2. [Rule 3 - Blocking] Collection.find() not available on plain Map in tests**
- **Found during:** Task 1 test execution
- **Issue:** `guild.channels.fetch()` returns Collection (extends Map) with `.find()`, but test mocks use plain Map
- **Fix:** Convert fetched channels to array via `Array.from(channelMap.values())` then use standard `.find()`
- **Files modified:** src/discord-server-manager.ts

## Verification

- `npx vitest run src/discord-server-manager.test.ts` -- 15/15 tests pass
- `npm run build` -- discord-server-manager.ts compiles clean (pre-existing errors in other files unrelated)
- `config/discord-server.json` -- valid JSON with 4 categories, 8 channels

## Known Stubs

None -- all functionality is fully wired.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 77955cc | feat(05-02): add bootstrap action with idempotent server structure creation |

## Self-Check: PASSED
