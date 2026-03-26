# Design: Progress Tracking + Sonnet Default Model

**Date:** 2026-03-25
**Status:** Approved

## Overview

Two improvements to NanoClaw:

1. **Sonnet as default model** — reduce cost while letting agent self-select Opus for heavy tasks
2. **Real-time progress visualization in Telegram** — user sees what agent is doing instead of silence

---

## Part 1: Sonnet Default Model

### Approach

At container startup, `entrypoint.sh` generates `~/.claude/settings.json` inside the container (overwriting any existing file). This is generated — not volume-mounted — so the host's personal settings never bleed in:

```bash
# In entrypoint.sh, after existing git/credential setup:
mkdir -p ~/.claude
echo '{"model":"claude-sonnet-4-6"}' > ~/.claude/settings.json
```

The agent can override model for individual subagents by passing `model: "claude-opus-4-6"` to the `Agent` tool call in its response. This works because the Claude Agent SDK's `Agent` tool accepts a `model` parameter that overrides the session default for that specific subagent invocation — it does not affect the parent session model.

### Files Changed
- `container/entrypoint.sh` — add `settings.json` generation (2 lines)
- Container rebuild required

---

## Part 2: Progress Tracker

### Problem

Users cannot tell if the agent is working or hung during long tasks. The container is long-lived (can run hours), but is idle between queries. Tracking container lifecycle would produce false "working" signals.

### Solution

Track the **message cycle** (not container lifecycle):

1. `sendChatAction("typing")` every 4s while agent is processing
   *(4s chosen because Telegram typing status expires at ~5s)*
2. After `SILENCE_THRESHOLD_MS = 30_000` ms of no new agent output → send a progress message
3. Edit same message in-place (throttled to max 1 edit per `EDIT_THROTTLE_MS = 3_000` ms)
4. When response arrives: edit progress message to `✅ Done in Xs` (leave in chat for context)
5. If container dies unexpectedly: delete progress message silently

All thresholds are named constants at top of `progress-tracker.ts`.

### Architecture

**New file: `src/progress-tracker.ts`**

Exported class `ProgressTracker` with methods:

```typescript
onMessageSent(chatJid: string): void
onResponseReceived(chatJid: string): void
onContainerStopped(chatJid: string): void
```

**State per chatJid** (`Map<string, TrackerState>`):

```typescript
interface TrackerState {
  startTime: number;            // Date.now() when onMessageSent called
  lastActivityTime: number;     // Date.now() of last JSONL line seen
  lastTool: string | null;      // formatted: "🔧 Bash → npm run build" (max 80 chars)
  progressMsgId: number | null; // Telegram message id being edited in-place
  typingInterval: NodeJS.Timeout;
  silenceTimer: NodeJS.Timeout | null;
  editThrottle: boolean;        // true = edit pending, don't schedule another
  jsonlWatcher: fs.FSWatcher | null;
  jsonlPath: string | null;
}
```

**Re-entrancy:** `onMessageSent` always runs `_cleanup(chatJid)` first — if a previous cycle's progress message exists, it is deleted before starting fresh. This handles rapid consecutive messages.

### Lifecycle Hooks

**`onMessageSent(chatJid)`** — called in `src/index.ts` after `queue.sendMessage(chatJid, formatted)`

1. Call `_cleanup(chatJid)` (stops previous cycle if any)
2. Initialize `TrackerState` with `startTime = Date.now()`
3. Start typing heartbeat: `setInterval(() => sendTypingAction(chatJid), 4000)`
4. Start JSONL discovery (see below)
5. Start silence timer: `setTimeout(onSilence, SILENCE_THRESHOLD_MS)`

**`onResponseReceived(chatJid)`** — called in `src/index.ts` agent result callback

1. Call `_cleanup(chatJid)` (stops all timers/watchers)
2. If `progressMsgId` exists: `editMessage(chatId, progressMsgId, "✅ Done in Xs")`

**`onContainerStopped(chatJid, exitCode: number)`** — called in `container-runner.ts` on container exit

- If `onResponseReceived` was already called (normal flow): `progressMsgId` is null, `_cleanup` already ran → this is a no-op
- If `progressMsgId` still exists (crash / unexpected stop, exitCode != 0):
  1. Call `_cleanup(chatJid)`
  2. `deleteMessage(progressMsgId)` — silent cleanup, no user-visible error
  3. Container auto-restarts (`Restart=on-failure` in systemd), so no error message needed

**`_cleanup(chatJid)`** — internal:

1. `clearInterval(typingInterval)`
2. `clearTimeout(silenceTimer)`
3. `jsonlWatcher?.close()`
4. Remove state from Map

### JSONL Discovery

Session ID is not available at `onMessageSent` time (it lives inside the container). Discovery approach:

1. Record `discoverAfter = Date.now() - 1000` at `onMessageSent` (1s buffer for filesystem mtime granularity)
2. Poll `data/sessions/{groupFolder}/.claude/projects/-workspace-group/*.jsonl` every 2s
   - Each poll: directory listing (`fs.readdir`) and `fs.stat` each file — both wrapped in try/catch, swallow errors, log once at warn level (handles unmounted volumes or missing directory)
3. Select the file with `mtime >= discoverAfter` — this is the active session file
4. If multiple files match: take the most recently modified
5. Timeout: if no file found after 30s, log warning and run typing-only mode
6. On file found: continue polling every 2s for new content (do NOT use `fs.watch` — Docker bind-mount volumes may not deliver inotify events reliably on all configurations; polling is the safe fallback)

Note: The sessions directory is a host path (`~/nanoclaw/data/sessions/`), bind-mounted into containers. The progress tracker runs on the host and reads host paths directly.

**`onJSONLChange`:**
1. Read last 4KB of file
2. Parse each line as JSON
3. Find `assistant` messages with `tool_use` blocks
4. Extract `name` and first argument value:
   - `Bash` → `input.command` (truncated to 60 chars)
   - `Read`/`Write`/`Edit` → `input.file_path` (basename only)
   - `WebSearch`/`WebFetch` → `input.query` or domain only
   - Other → tool name only
5. Format: `"🔧 {name} → {arg}"` (total max 80 chars, truncate arg with `…`)
6. Update `lastTool` and `lastActivityTime = Date.now()`
7. Reset silence timer
8. If `progressMsgId` exists: schedule throttled edit

### Progress Message

**Format:** `⏳ {elapsed}s — 🔧 {lastTool}`

**Silence timer fires:**
- If `progressMsgId == null`: `sendMessage(chatJid, format())` → store `progressMsgId`
- If `progressMsgId != null`: attempt edit (see throttle)

**Throttle logic:**
- At most 1 `editMessageText` per `EDIT_THROTTLE_MS` (3s)
- If `editThrottle == true`: skip scheduling — when the pending edit fires, it re-reads current state (`lastTool`, `startTime`) at flush time to always emit the latest value
- On Telegram 429 response: back off 5s, retry once. Do NOT reset `progressMsgId` (prevents message spam)
- On 400 "message not found" (deleted by user): set `progressMsgId = null`, log info

**In-flight race (response arrives while sendMessage is pending):**
- Track `sendPending: boolean` flag — set `true` before `sendMessage()`, set `false` after send settles (resolve or reject), unconditionally
- If `onResponseReceived` fires while `sendPending == true`: set `progressMsgId = null` immediately (so the callback's store is skipped), and proceed with cleanup — the in-flight message will be orphaned but this is acceptable (one stray message max)

### Telegram Channel Changes

Add to `TelegramChannel` class in `src/channels/telegram.ts`:

```typescript
async editMessage(chatId: string, messageId: number, text: string): Promise<void>
async deleteMessage(chatId: string, messageId: number): Promise<void>
```

Both wrapped in try/catch — failures logged, not thrown (tracker failure must never affect message delivery).

### Integration Points in `src/index.ts`

```typescript
// After: queue.sendMessage(chatJid, formatted)
progressTracker.onMessageSent(chatJid);

// In agent result callback (where runAgent result is processed):
progressTracker.onResponseReceived(chatJid);
```

### Integration Point in `src/container-runner.ts`

```typescript
// In container exit handler (after exec callback or process 'close' event):
progressTracker.onContainerStopped(chatJid);
```

`ProgressTracker` is a singleton instantiated in `src/index.ts` and passed to container-runner as a callback or imported directly.

### JSONL Schema Reference

Claude agent SDK emits JSONL where each line is a JSON object with `type` field:

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "tool_use", "name": "Bash", "input": { "command": "npm run build" } }
    ]
  }
}
```

Tracker listens for `type === "assistant"` lines containing `content` blocks with `type === "tool_use"`.

### Edge Cases

| Case | Handling |
|------|----------|
| Multiple chats in parallel | `Map<chatJid, TrackerState>` — fully isolated |
| JSONL not found within 30s | Log warning, typing-only mode |
| `editMessage` 429 (rate limit) | Back off 5s, retry once. Don't reset `progressMsgId` |
| `editMessage` 400 (message deleted) | Set `progressMsgId = null`, log |
| Fast response (< 30s) | Only typing shown, no progress message ever sent |
| Container crashes | `onContainerStopped` → delete progress message |
| Consecutive messages (re-entrancy) | `_cleanup` at start of `onMessageSent` handles it |
| Tool argument contains sensitive data | Truncate at 80 chars; never log tool results, only names |

---

## Implementation Order

1. `container/entrypoint.sh` — add `settings.json` (2 lines) + rebuild container
2. `src/channels/telegram.ts` — add `editMessage` + `deleteMessage`
3. `src/progress-tracker.ts` — full implementation with all constants
4. `src/index.ts` — wire `onMessageSent` + `onResponseReceived`
5. `src/container-runner.ts` — wire `onContainerStopped`
6. Rebuild nanoclaw TypeScript (`npm run build`)
7. Restart nanoclaw service (`systemctl --user restart nanoclaw`)
8. Manual verification via Telegram: send message, observe typing + progress after 30s
