---
phase: 08-per-channel-context-and-migration
plan: 02
subsystem: webhook-routing
tags: [migration, routing, toggle, config]
dependency_graph:
  requires: [06-01]
  provides: [enabled-toggle, migration-docs]
  affects: [webhook-router, routing-config]
tech_stack:
  added: []
  patterns: [zod-default-field, config-toggle]
key_files:
  created:
    - docs/migration-checklist.md
  modified:
    - src/webhook-router.ts
    - src/webhook-router.test.ts
    - config/routing.json
decisions:
  - "D-07: enabled field defaults to true via z.boolean().default(true) for backward compatibility"
  - "D-08: Filter check uses target.enabled === false (strict) before group lookup"
  - "D-09: Migration is per-webhook-type, documented in checklist with rollback"
metrics:
  duration: 153s
  completed: 2026-03-27T05:49:00Z
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 8 Plan 02: Routing Enabled Toggle + Migration Checklist Summary

Enabled toggle on routing targets with Zod default(true) for zero-breakage backward compatibility, plus step-by-step migration checklist with rollback procedure.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add enabled toggle to TargetSchema and resolveTargets filter | af87ef9 (RED), ebe6ba0 (GREEN) | TargetSchema + enabled field, resolveTargets filter, 6 new tests |
| 2 | Update routing.json and create migration checklist | e8445e3 | 7 targets with explicit enabled:true, migration docs |

## Implementation Details

### TargetSchema Enhancement

Added `enabled: z.boolean().default(true)` to TargetSchema. The `.default(true)` means existing routing.json entries without the field parse as enabled -- zero breakage.

### resolveTargets Filter

Added `if (target.enabled === false)` check before the group lookup in the routing loop. Disabled targets are logged at info level and skipped. When all targets are disabled, the existing mainJid fallback activates.

### routing.json Update

All 7 existing targets now have explicit `"enabled": true`. This makes the dual-send state visible in config rather than implicit.

### Migration Checklist

Created `docs/migration-checklist.md` covering:
- Prerequisites (bot running, channels created, dual-send confirmed)
- 5-step per-webhook migration flow (verify, test, disable Telegram, verify Discord-only, monitor)
- Rollback procedure (flip enabled flags, no restart needed)
- Status tracking table for all webhook types

## Decisions Made

1. **Strict false check:** Using `target.enabled === false` rather than `!target.enabled` to be explicit about the disabled state
2. **Info-level logging:** Disabled targets logged at info (not warn) since it is intentional configuration
3. **No restart needed:** Documented that NanoClaw reads routing.json fresh per webhook call

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all functionality is fully wired.

## Verification Results

- All 14 tests pass (8 existing + 6 new enabled-related tests)
- routing.json has 7 enabled fields confirmed
- Migration checklist contains rollback instructions, dual-send references, enabled:false examples
- Build errors are pre-existing (whatsapp-auth.ts missing baileys, index.ts IPC changes) -- unrelated to this plan's changes

## Self-Check: PASSED

- All 4 created/modified files exist on disk
- All 3 commit hashes (af87ef9, ebe6ba0, e8445e3) found in git log
