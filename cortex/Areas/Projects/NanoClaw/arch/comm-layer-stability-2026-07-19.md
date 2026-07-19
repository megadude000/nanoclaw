---
cortex_level: L30
confidence: high
domain: nanoclaw
scope: Comm-layer stability work + upstream v2 migration decision (2026-07-19)
type: work-log
tags:
  - nanoclaw
  - comm-layer
  - notifications
  - discord
  - telegram
  - credential-proxy
  - upstream-merge
created: '2026-07-19'
project: nanoclaw
---
# Comm-layer stability + credential restoration (2026-07-19)

Context: Anthropic re-allowed Agent SDK use on Claude subscriptions. Goal for the
session: pull upstream, review functionality (esp. agent status notifications to
Discord/Telegram that "always break and fail"), and make the comm layer stable
and architecturally correct.

## Upstream migration decision — DO NOT straight-merge origin/main

- Fork base is v1-era (`934f063`). `origin/main` is **v2.1.53**, a full rewrite
  (~1554 commits ahead, ~1021 fork commits diverged). Diff touches ~237 src files
  with 21 direct conflicts including modify/delete of `ipc.ts`, `db.ts`,
  `task-scheduler.ts`, `channels/registry.ts` (deleted upstream).
- A blind `git merge origin/main` is **rejected** — v2 deletes/renames the fork's
  core files (entity model, two-DB session split, `ncl` CLI, Chat SDK bridge,
  channels moved to `channels` branch, OneCLI SDK 2.2.1). The correct path when
  the fork wants v2 is `/migrate-nanoclaw` (intent-replay on clean base), not merge.
- Decision this session: **stay on the v1-era fork**, do NOT adopt v2 yet. Only
  cherry-picked the still-compatible `skill/native-credential-proxy` branch.
- Backup before any work: tag `pre-update-89fe8452-20260719-075318` (+ matching
  `backup/pre-update-...` branch). Roll back with `git reset --hard <tag>`.

## Credential path restored (subscription OAuth, OneCLI removed)

- Root failure in prod logs: containers died with `Not logged in · Please run /login`
  because OneCLI gateway was **not reachable** ("container will have no credentials")
  and `credential-proxy.ts` had been reduced to a 404 stub.
- Fix: merged `skill/native-credential-proxy`, removed `@onecli-sh/sdk` and the
  OneCLI wiring in `container-runner.ts`/`index.ts`, restored the local HTTP
  credential proxy. Kept BOTH the fork's webhook server + cortex watcher AND the
  proxy startup/shutdown (conflict resolved to union, not either/or).
- Proxy binds to the docker0 bridge IP on Linux (`172.17.0.1:3001`); containers
  reach it via `host.docker.internal` + `--add-host=...:host-gateway`.
- Auth mode is `oauth` (reads `CLAUDE_CODE_OAUTH_TOKEN` from `.env`). Verified
  live: a real `/v1/messages` POST through the proxy with `Bearer placeholder`
  returned **200** with a valid completion — the subscription token is injected
  correctly. NOTE: the `/api/oauth/claude_cli/create_api_key` exchange returns
  **403 org:create_api_key** for a `claude setup-token` token — that is expected
  and irrelevant; setup-tokens are used **directly as Bearer**, not exchanged.

## Comm-layer defects fixed (notifications "always break")

Root cause of silent notification loss: `Channel.sendMessage` swallowed all errors
and returned `void`, yet `index.ts` set `outputSentToUser = true` unconditionally,
then deliberately skipped cursor rollback — so a failed send lost the reply forever
with no retry and no surfaced error. Fixes:

1. `Channel.sendMessage` now returns a delivery **boolean** (Discord/Telegram/Gmail).
   `processGroupMessages` only advances the cursor on a confirmed send; a false
   flips `hadError` → cursor rolls back → turn retries.
2. Discord `sendMessage` refuses when the gateway is mid-reconnect (`isReady()`
   false) instead of throwing into a swallowed catch.
3. Added `DiscordChannel.deleteMessage` — progress-tracker cleanup of stranded
   "⏳" messages was a silent no-op on Discord (only Telegram implemented it).
4. `progress-tracker` now detects **both** grammY (`error_code`) and discord.js
   (`status`/`code` 10008) error shapes for 429 retry and dead-message reset —
   previously Discord edits leaked/looped because only the Telegram shape was checked.
5. `progress-tracker` clears the prior silence timer before rescheduling (was
   leaking a duplicate `_onSilence`).
6. `github-webhook` raw Discord REST post: checks `response.ok`, reads the bot
   token via `readEnvFile` fallback, caps content at 2000 chars, bounds the
   `postedRunIds` dedup set.
7. `swarm-webhook-manager`: on cache miss, lazily reuse an existing `NanoClaw-`
   webhook before creating one — prevents per-restart webhook accumulation up to
   Discord's ~15/channel cap (which silently broke swarm-identity sends).

## Known remaining audit items (not yet done)

- `startHealthMonitor` is dead code (never called) → service up/down alerts never
  fire. `routeOutbound` (has the connection-check + origin-error-notify logic) is
  also unused — `findChannel` doesn't check `isConnected()`.
- Telegram has no 429/flood retry; `isConnected()` only checks `bot !== null`.
- Two parallel progress subsystems (ProgressTracker + BotStatusPanel) with
  divergent throttle logic. Six distinct outbound send paths.

## Verification

- `npm run build` clean; full `npm test` = **722 passed**.
- Service restarted via `systemctl --user restart nanoclaw`: credential proxy
  `oauth` on `172.17.0.1:3001`; Discord/Telegram/Gmail all connected.

Related: [[credential-proxy]] [[message-flow]] [[upstream-sync-findings-2026-03-31]]
[[container-isolation]] [[health-monitor]]
