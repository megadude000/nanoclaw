---
phase: 06-webhook-routing-architecture
plan: 01
subsystem: webhook-routing
tags: [routing, abstraction, zod, config, dual-send]
dependency_graph:
  requires: []
  provides: [resolveTargets, RouteTarget, RoutingConfigSchema, routing.json]
  affects: [github-issues-webhook, notion-webhook, progress-tracker, bugreport-webhook, github-webhook]
tech_stack:
  added: []
  patterns: [zod-config-validation, read-on-every-call, mainJid-fallback]
key_files:
  created:
    - src/webhook-router.ts
    - src/webhook-router.test.ts
    - config/routing.json
  modified: []
decisions:
  - "Read config fresh on every webhook call (no caching) per D-02 -- webhooks are infrequent"
  - "Zod validation with graceful fallback to mainJid on any config error per D-03/D-12"
  - "Config uses platform+jid target pairs enabling dual-send naturally per D-05/D-06"
metrics:
  duration: 125s
  completed: 2026-03-26T19:08:11Z
  tasks_completed: 2
  tasks_total: 2
  test_count: 8
  files_created: 3
  files_modified: 0
---

# Phase 6 Plan 01: Routing Abstraction Layer Summary

Webhook routing abstraction with resolveTargets() that reads config/routing.json per-call, validates with Zod, resolves JIDs against registered groups, and falls back to mainJid on any error condition.

## What Was Built

### src/webhook-router.ts
- `RoutingConfigSchema` -- Zod schema validating routing config structure (platform enum, JID strings, min 1 target per route)
- `RouteTarget` interface -- `{ jid: string, group: RegisteredGroup }` for resolved routing targets
- `resolveTargets(webhookType, groups)` -- main routing function that reads config/routing.json, validates with Zod, resolves each target JID against registered groups, falls back to mainJid on missing config/invalid JSON/unknown webhook type/no resolved targets
- `mainFallback(groups)` -- internal helper finding the first group with `isMain === true`

### src/webhook-router.test.ts
8 unit tests covering:
1. Valid config returns correct RouteTarget array
2. Unknown webhook type falls back to mainJid
3. Missing config file falls back to mainJid
4. Invalid JSON falls back to mainJid with warning log
5. Unregistered JIDs skipped with warning
6. All JIDs unregistered falls back to mainJid
7. Dual-send config returns 2 RouteTarget entries
8. Empty groups returns empty array

### config/routing.json
Template config for all 5 webhook types with placeholder JIDs:
- `github-issues` -- dual-send (Telegram + Discord #bugs)
- `github-ci` -- Telegram only
- `notion` -- dual-send (Telegram + Discord #tasks)
- `progress` -- Telegram only
- `bugreport` -- Discord only

## Decisions Made

1. **No caching**: Config read fresh via `readFileSync` on every call. Webhooks fire infrequently; this ensures config changes take effect without restart.
2. **Graceful degradation**: Every error path (missing file, bad JSON, Zod failure, unresolved JIDs) falls back to mainJid rather than throwing.
3. **Platform+JID targets**: Each target specifies both platform and JID, enabling mixed routing (some to Telegram, some to Discord).

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 (RED) | e4af25a | test(06-01): add failing tests for resolveTargets |
| 1 (GREEN) | 54d23c4 | feat(06-01): implement resolveTargets webhook routing abstraction |
| 2 | eae2b6e | feat(06-01): add default routing.json config |

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

- `config/routing.json` contains placeholder JIDs (`tg:TELEGRAM_CHAT_ID`, `dc:DISCORD_BUGS_CHANNEL_ID`, `dc:DISCORD_TASKS_CHANNEL_ID`). These are intentional template values -- resolveTargets() gracefully handles unregistered JIDs by falling back to mainJid. Real values will be configured when Discord channels are set up (Phase 5 server bootstrap or manual config).

## Verification

- All 8 vitest tests pass
- Zero TypeScript errors in new files
- routing.json validates as valid JSON with all 5 webhook types
