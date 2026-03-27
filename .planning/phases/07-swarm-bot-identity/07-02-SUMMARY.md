---
phase: 07-swarm-bot-identity
plan: 02
subsystem: ipc-sender-routing, discord-swarm-integration
tags: [discord, webhooks, swarm-identity, ipc, sender-routing]
dependency_graph:
  requires: [SwarmWebhookManager, loadSwarmIdentities, discord-chunker]
  provides: [sender-aware-sendMessage, discord-swarm-webhook-routing, ipc-sender-threading]
  affects: [Channel-interface, IpcDeps-interface, DiscordChannel-sendMessage]
tech_stack:
  added: []
  patterns: [optional-parameter-backwards-compat, fallback-with-prefix]
key_files:
  created: []
  modified:
    - src/types.ts
    - src/ipc.ts
    - src/index.ts
    - src/channels/discord.ts
decisions:
  - Lazy webhook hydration (no hydrateCache at startup) per D-01 research recommendation
  - Fallback uses [SenderName] prefix on main bot per D-11
  - Copied Plan 01 dependencies from merge commit since worktree branch diverged
metrics:
  duration: 150s
  completed: 2026-03-27T05:31:25Z
---

# Phase 7 Plan 02: IPC Sender Threading and Discord Swarm Routing Summary

Sender field threaded from IPC JSON through Channel.sendMessage with optional parameter, DiscordChannel routes known swarm identities through SwarmWebhookManager webhooks with [SenderName] prefix fallback on failure.

## What Was Built

### IPC Sender Threading
- `src/types.ts`: Added optional `sender?: string` parameter to `Channel.sendMessage` interface -- backwards-compatible, existing implementations ignore extra args
- `src/ipc.ts`: Updated `IpcDeps.sendMessage` signature with optional `sender` parameter; `processIpcFiles` now passes `data.sender` instead of dropping it
- `src/index.ts`: IPC watcher lambda threads `sender` through to `channel.sendMessage(jid, text, sender)`

### Discord Swarm Webhook Routing
- `src/channels/discord.ts`:
  - Imports `SwarmWebhookManager` and `loadSwarmIdentities`
  - Initializes swarm manager on `ClientReady` event (lazy hydration, no startup API calls)
  - `sendMessage(jid, text, sender?)` checks sender against swarm identities before normal send
  - Known sender: routes through `swarmManager.send()` with distinct username/avatar
  - Webhook failure: falls back to main bot with `[SenderName]` prefix in message text
  - Unknown/no sender: normal bot send (unchanged behavior)

## Requirement Coverage

| Req ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| SWRM-01 | Distinct usernames via webhooks | DONE | sender-aware routing in sendMessage delegates to SwarmWebhookManager.send |
| SWRM-02 | Custom avatars per identity | DONE | SwarmWebhookManager.send passes avatarURL per identity config |
| SWRM-03 | Automated webhook creation per channel | DONE | SwarmWebhookManager creates webhooks on demand (Plan 01) |
| SWRM-04 | Fallback to main bot if webhook unavailable | DONE | Fallback path prefixes text with [SenderName] and uses normal bot send |

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 27a6bfd | feat | Thread sender field through IPC and Channel interface |
| b758c3d | feat | Wire SwarmWebhookManager into DiscordChannel sendMessage |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 01 files missing from worktree branch**
- **Found during:** Pre-task setup
- **Issue:** Worktree branch `worktree-agent-ac966aa4` diverged from `nightshift/2026-03-25` where Plan 01 merge landed; `swarm-webhook-manager.ts`, `discord-chunker.ts`, `discord-group-utils.ts`, and `config/swarm-identities.json` were not present
- **Fix:** Extracted files from merge commit `a16c8ff` and copied from main repo disk
- **Files added:** src/swarm-webhook-manager.ts, src/swarm-webhook-manager.test.ts, src/discord-chunker.ts, src/discord-group-utils.ts, config/swarm-identities.json
- **Commit:** b758c3d

**2. [Rule 3 - Blocking] discord.ts not on worktree branch**
- **Found during:** Pre-task setup
- **Issue:** `src/channels/discord.ts` exists on main repo disk but not in worktree branch (Discord channel is a skill merged separately)
- **Fix:** Copied from main repo disk
- **Files added:** src/channels/discord.ts
- **Commit:** b758c3d

**3. [Rule 3 - Blocking] discord.js not installed**
- **Found during:** Pre-task verification
- **Issue:** discord.js npm package not in worktree node_modules
- **Fix:** Ran `npm install discord.js`
- **Commit:** n/a (node_modules not committed)

## Known Stubs

None -- all functionality is fully wired and operational. Swarm identities are configured in `config/swarm-identities.json` with placeholder Dicebear avatars (intentional, user replaces with custom avatars).

## Self-Check: PASSED
