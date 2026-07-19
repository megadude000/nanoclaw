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
source_hash: 2fe8d3758b3c60cf59d890c6a5f32e473e32a6623a9265d333bbf699598603b9
embedding_model: text-embedding-3-small
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

## Model / reasoning-effort policy (per-context)

Reasoning effort is split by execution context, threaded per-run through
`ContainerInput` (serialized to the container over stdin), not a single global
knob:

- **Interactive chat** (`index.ts` → `runContainerAgent`): default model
  (Sonnet `claude-sonnet-4-6`) at effort **`low`** — fast responses.
- **Scheduled/background tasks** (`task-scheduler.ts`): **Opus `claude-opus-4-8`**
  at effort **`max`**. Explicit `task.model` / `group.containerConfig.model`
  still override.
- The SDK (`@anthropic-ai/claude-agent-sdk` 0.2.92) `query()` accepts
  `effort: 'low'|'medium'|'high'|'max'`; `max` is Opus-only (Sonnet caps at
  `high`). agent-runner precedence: `containerInput.effort` → `NANOCLAW_EFFORT`
  env → `'high'`; model: `containerInput.model` → `NANOCLAW_MODEL` env → SDK
  default (container `~/.claude/settings.json` = sonnet-4-6).
- `.env` global fallbacks: `NANOCLAW_MODEL=claude-sonnet-4-6`,
  `NANOCLAW_EFFORT=high`. agent-runner logs `Model: X, effort: Y` per run.

## Audit items closed (second pass, same day)

All four remaining audit items were completed in a follow-up session
(commits `4f97a006`, `9fd3166b`, `f3c14d47`, and the edit-throttle refactor):

1. **Health monitor wired** (`4f97a006`) — `startHealthMonitor` is called from
   `main()` again (the Phase-13 wiring from `d9e1547e` had been lost in the
   credential-proxy merge). Embeds go to the #logs channel (`dumpJid` /
   `DISCORD_LOGS_CHANNEL_ID`); cleanup runs on SIGTERM/SIGINT. Monitored
   services come from `HEALTH_MONITOR_SERVICES` (default `nanoclaw`) plus the
   cortex Qdrant container; startup warns if no logs channel is configured.
2. **`routeOutbound` deleted, `sendOutbound` is the single fire-and-forget
   path** (`9fd3166b`) — `router.ts:sendOutbound` does ownership lookup +
   `isConnected()` gate + delivery-boolean passthrough. Scheduled-task sends
   now mark the task run as **error** when delivery fails (was: logged
   success, output lost). IPC message sends now notify the origin group's
   chat and throw on failed delivery, so the payload lands in `ipc/errors/`
   for replay instead of being deleted. The interactive path
   (`processGroupMessages`) intentionally keeps direct `channel.sendMessage`
   — it needs the channel object and already handles the boolean via cursor
   rollback.
3. **Telegram hardened** (`f3c14d47`) — `callWithFloodRetry` retries sends on
   429 using grammY's `error.parameters.retry_after` (5s fallback, 60s cap,
   max 2 retries); applied to `sendMessage` (both parse-mode attempts,
   without cross-triggering the plain-text fallback) and `sendWithButtons`.
   `isConnected()` now returns `bot !== null && bot.isRunning()` (grammY
   polling state), so `sendOutbound`'s gate is meaningful for Telegram.
4. **Shared edit-throttle module** — `src/edit-throttle.ts` now owns
   `EditThrottler` (per-key trailing-edge throttle), `isRateLimitError`,
   `isMessageGoneError`, `getRetryDelayMs`, `handleEditFailure`; both
   ProgressTracker and BotStatusPanel use it. BotStatusPanel gained 429
   retry + deleted-panel-message recreation. **Key discovery:** both
   channels' `editMessage` swallowed every error, which made ALL of the
   panels' retry/dead-message logic dead code and silently broke
   BotStatusPanel's restart reclaim; they now rethrow (Telegram swallows
   only the benign "message is not modified" 400). Telegram message-gone
   detection now requires a "message to edit/delete not found" description —
   a bare 400 is no longer treated as gone (grammY uses 400 for benign
   cases; the old check would have caused duplicate progress messages).

### Still open / known limitations

- Six distinct outbound send paths still exist (interactive, scheduler, IPC,
  github-webhook raw REST, swarm webhooks, pool bots); only the first three
  are on the delivery-boolean/sendOutbound discipline.
- IPC delivery failures land in `ipc/errors/` — preserved but there is no
  automatic replay yet.
- Telegram `isRunning()` stays true through transient network outages
  (grammY's long-poll self-heals), so `isConnected()` reflects "polling
  started and not stopped", not socket liveness.

## Verification

- First pass: `npm run build` clean; full `npm test` = **722 passed**.
- Second pass (audit items): build clean; **751 passed** (+29: sendOutbound,
  Telegram flood retry, edit-throttle suites).
- Service restarted via `systemctl --user restart nanoclaw`: credential proxy
  `oauth` on `172.17.0.1:3001`; Discord/Telegram/Gmail all connected.

## Appendix: what full ProgressTracker + BotStatusPanel unification would look like

Deliberately **not** done now (live service, different lifecycles). If/when
unification is attempted:

- **Shape.** A single `StatusHub` owning three concerns that are currently
  smeared across both classes: (1) *activity ingestion* — the JSONL poller
  and tool-call parser (today: ProgressTracker `_pollJSONL`/`_parseLine`);
  (2) *state* — per-conversation transient runs AND per-bot persistent
  status, today two disjoint maps keyed differently (`chatJid` vs
  `botName`, joined ad hoc via `chatToBotMap`); (3) *renderers* — sinks that
  subscribe to state changes: an ephemeral ⏳-message renderer (per run), a
  persistent panel renderer (per bot), and the #logs mirror. All renderers
  would share `EditThrottler`/`handleEditFailure` (already extracted).
- **The real duplication is ingestion, not rendering.** BotStatusPanel's
  `onGroupTool` was designed to be fed "from ProgressTracker" but nothing
  feeds it today — a unified hub would parse the JSONL once and fan out to
  every renderer, instead of each subsystem inventing its own hooks in
  index.ts/task-scheduler.ts (5 call sites each today).
- **Persistence differences.** BotStatusPanel persists message IDs via
  router_state (`bsp:` keys) and survives restarts; ProgressTracker is
  fully transient. A unified hub needs a per-renderer persistence policy,
  not a global one.
- **Timer inventory to consolidate:** typing heartbeat (4s), JSONL poll
  (2s), silence timer (30s), edit throttles (3s/4s), working refresh (30s),
  working timeout (20min). A hub could run ONE scheduler tick and derive
  all of these, removing ~6 independent timer families and their cleanup
  bugs (two of which have already been fixed this cycle).
- **Migration path:** (a) feed `botStatusPanel.onGroupTool` from
  ProgressTracker's `_parseLine` (small, immediate value — panel shows live
  tools); (b) lift `_pollJSONL`/`_parseLine` into an `ActivityFeed` emitter;
  (c) turn both classes into renderers consuming it; (d) collapse the
  index.ts/task-scheduler.ts hook pairs (`onMessageSent`+`onGroupStarted`,
  `onResponseReceived`+`onGroupDone`, …) into single hub calls. Each step is
  independently shippable and testable; stop at any point.
- **Risk note:** the panel's 20-minute auto-reset and the tracker's
  cursor-rollback interplay with `processGroupMessages` are the two places
  where a naive merge would change user-visible behavior — port them as
  explicit, tested policies.

Related: [[credential-proxy]] [[message-flow]] [[upstream-sync-findings-2026-03-31]]
[[container-isolation]] [[health-monitor]]
