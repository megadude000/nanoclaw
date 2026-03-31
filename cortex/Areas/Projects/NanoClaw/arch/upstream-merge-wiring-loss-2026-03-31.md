---
type: findings
cortex_level: L30
confidence: high
domain: nanoclaw
project: NanoClaw
scope: internal
date: 2026-03-31T00:00:00.000Z
topics:
  - upstream-sync
  - progress-tracker
  - bot-status-panel
  - discord
  - index.ts
---

# Curious Findings: Upstream Merge Wiring Loss (2026-03-31)

## Context
After merging 52 upstream commits (`d63800a5 Merge remote-tracking branch 'origin/main'`),
two major subsystems were silently dropped from `src/index.ts`:
the ProgressTracker piped-message path and the entire Phase 10 BotStatusPanel wiring.
Both compiled without errors — nothing in the build indicated the loss.

---

## Finding 1: Progress Tracker Doesn't Fire on Piped Messages

When a user sends a second message while the container is still running, NanoClaw pipes
it directly into the active query (`queue.sendMessage`) instead of spawning a new container.
The piped path had this code:

```ts
channel.setTyping?.(chatJid, true)?.catch(...);
```

This calls typing ONCE (Discord typing lasts ~10s then expires). No `progressTracker?.onMessageSent`
call → no typing heartbeat, no progress message, no JSONL poll.

**Why curious:** The first message worked perfectly. Only message 2+ were broken. The debug logs
confirmed `this.client` was valid and `sendTyping sent` appeared — the channel was fine.
The real issue was one level higher: the state machine was never started for piped messages.

**Fix:** Replace the single `channel.setTyping` call with `progressTracker?.onMessageSent(chatJid, group.folder)`.
ProgressTracker internally calls setTyping, starts the heartbeat interval, sends the progress message, and starts JSONL polling.

---

## Finding 2: BotStatusPanel and sendToAgents Dropped by Upstream Merge

The upstream merge silently reverted `index.ts` to a version before Phase 10 (agent status reporting).
All of this was lost:

- Import: `BotStatusPanel`, `EmbedBuilder`, `loadSwarmIdentities`, `readEnvFile`
- Module vars: `botStatusPanel`, `sendToAgents`
- `processGroupMessages`: `onGroupStarted`, `onGroupDone`, `onGroupError` hooks
- Startup: `dumpJid`/`sendToAgents` wiring from env, `BotStatusPanel` init block
- `startSchedulerLoop`: `progressTracker`, `botStatusPanel`, `sendToAgents` params
- `startIpcWatcher`: `reactToMessage`, `sendWithButtons`, `sendPhoto`, `sender`→`onBotSeen`, `sendToAgents`

**Symptom:** `#bot-control` channel went silent. No bot status updates. Buttons in Discord
stopped routing correctly. Agent status embeds stopped posting to `#agents`.

**Why curious:** The files themselves were intact (`bot-status-panel.ts`, `ipc.ts`, `task-scheduler.ts`
all had the right interfaces). TypeScript compiled cleanly. The omission was purely in the wiring
layer — `index.ts` just never passed these deps to the subsystems.

**Fix:** Re-add all imports, module vars, hooks, and dep passing. After restart:
`BotStatusPanel initialized — botNames: ["Jarvis","Friday","Alfred"]`
and all three bots reclaimed their existing messages in `#bot-control`.

---

## Finding 3: Upstream Merges Can Silently Revert Index.ts Wiring

`src/index.ts` is the main orchestrator. When upstream rewrites it, all local wiring additions
(new module vars, new subsystem calls, new deps) are at risk of being dropped by the merge strategy.

**Lesson:** After any upstream merge, specifically audit these in `index.ts`:
1. All `let` module-level vars (especially optional subsystems like `botStatusPanel`, `sendToAgents`)
2. All calls inside `processGroupMessages` — hooks are easy to lose
3. All deps passed to `startSchedulerLoop` and `startIpcWatcher` — both accept more than they get used
4. The ProgressTracker init — especially `deleteMsg` (was emptied to `async () => {}`) and `dumpJid`

Run `git diff origin/main src/index.ts` before merging to preview collision points.
