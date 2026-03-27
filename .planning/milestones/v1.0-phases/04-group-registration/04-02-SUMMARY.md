---
phase: 04-group-registration
plan: 02
subsystem: discord-auto-registration
tags: [discord, groups, auto-registration, ipc-auth]
dependency_graph:
  requires: [04-01]
  provides: [discord-auto-registration, discord-ipc-auth]
  affects: [src/channels/discord.ts, src/index.ts]
tech_stack:
  added: []
  patterns: [auto-registration-on-first-message, env-var-main-channel-detection]
key_files:
  created: []
  modified:
    - src/channels/discord.ts
    - src/index.ts
    - src/channels/discord.test.ts
    - src/ipc-auth.test.ts
decisions:
  - Auto-registration guarded by registerGroup existence check for backward compatibility
  - DISCORD_MAIN_CHANNEL_ID env var determines main channel (warning logged if unset)
  - Non-main channels get requiresTrigger=true, main gets isMain=true and requiresTrigger=false
metrics:
  duration: 3min
  completed: 2026-03-26
---

# Phase 04 Plan 02: Discord Auto-Registration Summary

Discord channels auto-register as NanoClaw groups on first message via sanitizeWithCollisionCheck for folder naming, DISCORD_MAIN_CHANNEL_ID env var for main channel detection, and CLAUDE.md stub creation per group directory.

## What Was Done

### Task 1: Wire auto-registration in discord.ts and pass registerGroup from index.ts
**Commit:** `6e4a4dd`

- Added imports for `fs`, `path`, `sanitizeWithCollisionCheck`, `createGroupStub`, and `GROUPS_DIR` to discord.ts
- Inserted auto-registration block in messageCreate handler: checks if channel is unregistered, determines main status via DISCORD_MAIN_CHANNEL_ID, calls registerGroup with sanitized folder name
- Creates CLAUDE.md stub in group directory on registration
- Added startup warning when DISCORD_MAIN_CHANNEL_ID is not set
- Added `registerGroup` to channelOpts in index.ts (line 641)

### Task 2: Add tests for auto-registration and Discord IPC authorization
**Commit:** `97d652c`

- Added 4 auto-registration tests in discord.test.ts: first message registration, main channel detection, skip already-registered, CLAUDE.md creation
- Added 3 Discord JID IPC authorization tests in ipc-auth.test.ts: main group cross-send, non-main restricted, self-send allowed
- Added mocks for discord-group-utils, fs module, and GROUPS_DIR config
- All 64 discord tests and 36 IPC auth tests pass

## Verification Results

- `npx vitest run src/channels/discord.test.ts` -- 64 tests passed
- `npx vitest run src/ipc-auth.test.ts` -- 36 tests passed
- Pre-existing build errors in index.ts (missing modules from other branches) and whatsapp-auth.ts are unrelated to this plan's changes

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all data paths are wired to real registration logic.
