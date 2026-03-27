---
phase: 06-webhook-routing-architecture
plan: 02
subsystem: webhook-routing
tags: [routing, migration, dual-send, best-effort-delivery]
dependency_graph:
  requires: [resolveTargets, RouteTarget, routing.json]
  provides: [migrated-webhook-handlers, startup-routing]
  affects: [github-issues-webhook, notion-webhook, github-webhook, index]
tech_stack:
  added: []
  patterns: [multi-target-loop, per-target-try-catch, task-id-suffix-for-dual-send]
key_files:
  created: []
  modified:
    - src/github-issues-webhook.ts
    - src/github-webhook.ts
    - src/notion-webhook.ts
    - src/index.ts
decisions:
  - "Task IDs use @jid suffix only when targets > 1 to avoid SQLite UNIQUE violations in dual-send"
  - "Startup ready message routed via resolveTargets('startup') with mainJid fallback"
  - "Progress tracker JID resolution unchanged -- webhook handlers set correct chat_jid per target via resolveTargets"
metrics:
  duration: 185s
  completed: 2026-03-26T19:14:04Z
  tasks_completed: 2
  tasks_total: 2
  test_count: 8
  files_created: 0
  files_modified: 4
---

# Phase 6 Plan 02: Migrate Webhook Handlers to resolveTargets Summary

All 4 webhook call sites migrated from hardcoded mainJid lookup to resolveTargets() with per-target try/catch for best-effort dual-send delivery.

## What Was Built

### Task 1: Webhook Handler Migration (github-issues, github-ci, notion)

All three webhook handlers received identical mechanical transformation:

**src/github-issues-webhook.ts**
- Replaced `Object.entries(groups).find(([, g]) => g.isMain)` with `resolveTargets('github-issues', groups)`
- Both code paths (bug label and no-bug-label) wrapped in `for (const target of targets)` loop
- Per-target try/catch with structured error logging
- Task ID uses `${taskId}@${target.jid}` suffix when multiple targets exist

**src/github-webhook.ts**
- `handleWorkflowRunEvent` migrated from mainEntry to `resolveTargets('github-ci', groups)`
- createTask call wrapped in multi-target loop with try/catch
- Logging updated to include target JID context

**src/notion-webhook.ts**
- `handleCommentCreated` migrated from mainEntry to `resolveTargets('notion', groups)`
- createTask call wrapped in multi-target loop with try/catch

### Task 2: index.ts Startup and Progress Tracker Routing

**src/index.ts**
- Added `import { resolveTargets } from './webhook-router.js'`
- Replaced startup ready message's `mainEntry` lookup with `resolveTargets('startup', registeredGroups)` -- sends to all configured startup targets
- Progress tracker: no changes needed. The tracker receives `chatJid` from the message context at call sites, and webhook handlers (Task 1) already set the correct `chat_jid` per target via resolveTargets

## Decisions Made

1. **Task ID uniqueness**: `@jid` suffix only added when `targets.length > 1` -- single-target mode keeps original ID for backward compatibility with existing dedup checks.
2. **Startup routing**: Uses `resolveTargets('startup', ...)` which falls back to mainJid if not configured in routing.json -- zero-config backward compatible.
3. **Progress tracker unchanged**: The tracker is already JID-agnostic. Webhook handlers set `chat_jid` per target, so progress naturally follows the routed JID.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | 9399789 | feat(06-02): migrate webhook handlers to resolveTargets routing |
| 2 | 456b459 | feat(06-02): wire resolveTargets in index.ts for startup message |

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None. All routing is fully wired through resolveTargets(). Placeholder JIDs in config/routing.json (from Plan 01) cause graceful fallback to mainJid -- this is intentional behavior, not a stub.

## Verification

- All 8 vitest routing tests pass
- Zero TypeScript errors in modified files (pre-existing errors in index.ts imports and whatsapp-auth.ts are unrelated)
- resolveTargets used in: webhook-router.ts (definition), github-issues-webhook.ts, github-webhook.ts, notion-webhook.ts, index.ts
- No remaining hardcoded mainEntry lookups in webhook handlers (only in webhook-router.ts mainFallback helper and gmail.ts which is out of scope)
