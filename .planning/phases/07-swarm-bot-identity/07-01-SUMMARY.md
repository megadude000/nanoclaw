---
phase: 07-swarm-bot-identity
plan: 01
subsystem: swarm-webhook-manager
tags: [discord, webhooks, swarm-identity, config]
dependency_graph:
  requires: [discord-chunker]
  provides: [SwarmWebhookManager, loadSwarmIdentities, SwarmIdentitySchema, swarm-identities-config]
  affects: [discord-channel-sendMessage, ipc-sender-routing]
tech_stack:
  added: []
  patterns: [zod-config-validation, webhook-lifecycle-management, in-memory-cache]
key_files:
  created:
    - src/swarm-webhook-manager.ts
    - src/swarm-webhook-manager.test.ts
    - config/swarm-identities.json
  modified: []
decisions:
  - Used NanoClaw-{senderName} webhook naming convention for clear identification
  - Dicebear API for placeholder avatars (free, no account needed)
  - Copied discord-chunker.ts from main branch as dependency (not on worktree branch)
metrics:
  duration: 190s
  completed: 2026-03-27T05:25:18Z
---

# Phase 7 Plan 01: SwarmWebhookManager Class and Config Summary

SwarmWebhookManager with on-demand webhook creation, in-memory caching by channelId:identityName, per-message username/avatar override via discord.js, and graceful fallback on failure. Zod-validated config with Friday and Alfred identities using Dicebear placeholder avatars.

## What Was Built

### SwarmWebhookManager class (`src/swarm-webhook-manager.ts`)
- `hasIdentity(senderName)` -- case-insensitive identity lookup
- `send(channel, text, senderName)` -- creates webhook on demand, caches it, sends with username+avatarURL overrides, chunks long messages, returns false on failure with stale cache cleanup
- `hydrateCache(channels)` -- populates cache from existing Discord webhooks matching NanoClaw- prefix with valid token (startup recovery)
- `loadSwarmIdentities(configPath?)` -- reads JSON config, validates with Zod, returns empty array if file missing
- `SwarmIdentitySchema` / `SwarmIdentitiesConfigSchema` -- Zod schemas for validation

### Config (`config/swarm-identities.json`)
- Friday and Alfred identities with Dicebear placeholder avatar URLs
- User can replace URLs with custom avatars later

### Tests (`src/swarm-webhook-manager.test.ts`)
- 17 unit tests covering all SWRM requirements
- loadSwarmIdentities: valid config, invalid config (missing name, bad URL), missing file
- SwarmIdentitySchema: validation and rejection
- hasIdentity: case-insensitive matching, unknown rejection
- send: webhook creation, caching, username+avatar passthrough, message chunking, unknown sender, createWebhook failure, send failure with cache cleanup
- hydrateCache: NanoClaw- prefix matching with token check, skip non-matching/tokenless webhooks

## Requirement Coverage

| Req ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| SWRM-01 | Distinct usernames via webhooks | DONE | `webhook.send({ username })` in send method, tested |
| SWRM-02 | Custom avatars per identity | DONE | `webhook.send({ avatarURL })` in send method, tested |
| SWRM-03 | Automated webhook creation per channel | DONE | `channel.createWebhook()` on demand in send, tested |
| SWRM-04 | Fallback to main bot if webhook unavailable | DONE | Returns false on failure, caller handles fallback, tested |

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 9206c99 | test | Add failing tests for SwarmWebhookManager (TDD RED) |
| 9faf596 | feat | Implement SwarmWebhookManager with config loader (TDD GREEN) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] discord-chunker.ts missing from worktree branch**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Worktree is on `nightshift/2026-03-25` branch which doesn't have `src/discord-chunker.ts` from Phase 3
- **Fix:** Copied file from main repo to worktree
- **Files modified:** src/discord-chunker.ts (copied)
- **Commit:** 9faf596

## Known Stubs

None -- all functionality is fully implemented and tested.

## Self-Check: PASSED
