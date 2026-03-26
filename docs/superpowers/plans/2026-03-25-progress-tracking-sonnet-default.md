# Progress Tracking + Sonnet Default Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real-time progress in Telegram while Claude agent works, and set Sonnet as the default model.

**Architecture:** (1) Inject `~/.claude/settings.json` in container entrypoint to default Sonnet. (2) New `ProgressTracker` class tracks per-chat message cycles: typing heartbeat + progress message after 30s silence, edited in-place, cleaned up on response.

**Tech Stack:** Node.js, TypeScript, grammy (Telegram), fs polling (no fs.watch — Docker inotify unreliable)

**Spec:** `docs/superpowers/specs/2026-03-25-progress-tracking-sonnet-default-design.md`

---

## Chunk 1: Sonnet Default + Telegram editMessage/deleteMessage

### Task 1: Set Sonnet as default model in container

**Files:**
- Modify: `container/entrypoint.sh`

- [ ] **Step 1: Add settings.json generation to entrypoint.sh**

In `container/entrypoint.sh`, insert these 2 lines before the final `cat > /tmp/input.json` line:

```bash
# Set Sonnet as default model (agent can override per-subagent via model param)
mkdir -p ~/.claude && echo '{"model":"claude-sonnet-4-6"}' > ~/.claude/settings.json
```

- [ ] **Step 2: Rebuild container**

```bash
cd /home/andrii-panasenko/nanoclaw && ./container/build.sh
```

Expected: build completes without errors.

- [ ] **Step 3: Commit**

```bash
cd /home/andrii-panasenko/nanoclaw
git add container/entrypoint.sh
git commit -m "feat: set claude-sonnet-4-6 as default model in agent container"
```

---

### Task 2: Add editMessage and deleteMessage to TelegramChannel

**Files:**
- Modify: `src/channels/telegram.ts` — add 2 methods before `setTyping`

- [ ] **Step 1: Add methods**

In `src/channels/telegram.ts`, insert before the `setTyping` method (around line 837):

```typescript
async editMessage(jid: string, messageId: number, text: string): Promise<void> {
  if (!this.bot) return;
  try {
    const numericId = jid.replace(/^tg:/, '');
    await this.bot.api.editMessageText(Number(numericId), messageId, text);
  } catch (err: any) {
    // 400 = message not found/deleted — expected, not an error
    if (err?.error_code !== 400) {
      logger.debug({ jid, messageId, err }, 'Failed to edit Telegram message');
    }
  }
}

async deleteMessage(jid: string, messageId: number): Promise<void> {
  if (!this.bot) return;
  try {
    const numericId = jid.replace(/^tg:/, '');
    await this.bot.api.deleteMessage(Number(numericId), messageId);
  } catch (err) {
    logger.debug({ jid, messageId, err }, 'Failed to delete Telegram message');
  }
}
```

- [ ] **Step 2: Build TypeScript**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/channels/telegram.ts
git commit -m "feat: add editMessage and deleteMessage to TelegramChannel"
```

---

## Chunk 2: ProgressTracker implementation

### Task 3: Create src/progress-tracker.ts

**Files:**
- Create: `src/progress-tracker.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * ProgressTracker — shows real-time progress in Telegram while agent works.
 *
 * Lifecycle: onMessageSent → [typing heartbeat + JSONL poll + 30s silence → progress message] → onResponseReceived
 * Primed by message cycle, not container lifecycle (container can idle for hours).
 */
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { DATA_DIR } from './config.js';

// --- Constants ---
const TYPING_INTERVAL_MS = 4_000;    // Telegram typing expires at ~5s
const SILENCE_THRESHOLD_MS = 30_000; // Show progress after 30s silence
const EDIT_THROTTLE_MS = 3_000;      // Max 1 edit per 3s (Telegram rate limit)
const JSONL_POLL_MS = 2_000;         // Poll for new JSONL content every 2s
const JSONL_DISCOVER_TIMEOUT_MS = 30_000; // Give up discovering JSONL after 30s

interface TrackerState {
  chatJid: string;
  groupFolder: string;
  startTime: number;
  lastActivityTime: number;
  lastTool: string | null;
  progressMsgId: number | null;
  sendPending: boolean;         // true while sendMessage is in-flight
  editThrottle: boolean;        // true means an edit is already scheduled
  typingTimer: ReturnType<typeof setInterval> | null;
  silenceTimer: ReturnType<typeof setTimeout> | null;
  pollTimer: ReturnType<typeof setInterval> | null;
  jsonlPath: string | null;
  jsonlSize: number;            // last known file size for incremental reads
  discoverAfter: number;        // mtime threshold for JSONL discovery
  discoverTimeout: ReturnType<typeof setTimeout> | null;
  loggedDiscoverWarn: boolean;
}

type SendFn = (jid: string, text: string) => Promise<{ message_id: number } | void>;
type EditFn = (jid: string, msgId: number, text: string) => Promise<void>;
type DeleteFn = (jid: string, msgId: number) => Promise<void>;
type TypingFn = (jid: string, typing: boolean) => Promise<void>;

export class ProgressTracker {
  private states = new Map<string, TrackerState>();
  private sendMsg: SendFn;
  private editMsg: EditFn;
  private deleteMsg: DeleteFn;
  private setTyping: TypingFn;

  constructor(deps: {
    sendMsg: SendFn;
    editMsg: EditFn;
    deleteMsg: DeleteFn;
    setTyping: TypingFn;
  }) {
    this.sendMsg = deps.sendMsg;
    this.editMsg = deps.editMsg;
    this.deleteMsg = deps.deleteMsg;
    this.setTyping = deps.setTyping;
  }

  /** Called when a message is piped to an active container OR a new container starts. */
  onMessageSent(chatJid: string, groupFolder: string): void {
    // Always clean up previous cycle first (handles re-entrancy)
    this._cleanup(chatJid);

    const state: TrackerState = {
      chatJid,
      groupFolder,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      lastTool: null,
      progressMsgId: null,
      sendPending: false,
      editThrottle: false,
      typingTimer: null,
      silenceTimer: null,
      pollTimer: null,
      jsonlPath: null,
      jsonlSize: 0,
      discoverAfter: Date.now() - 1000, // 1s buffer for mtime granularity
      discoverTimeout: null,
      loggedDiscoverWarn: false,
    };
    this.states.set(chatJid, state);

    // Start typing heartbeat
    state.typingTimer = setInterval(() => {
      this.setTyping(chatJid, true).catch(() => {});
    }, TYPING_INTERVAL_MS);
    this.setTyping(chatJid, true).catch(() => {}); // immediate

    // Start silence timer
    state.silenceTimer = setTimeout(() => this._onSilence(chatJid), SILENCE_THRESHOLD_MS);

    // Start JSONL discovery polling
    state.pollTimer = setInterval(() => this._pollJSONL(chatJid), JSONL_POLL_MS);

    // Give up on JSONL discovery after timeout — fall back to typing-only
    state.discoverTimeout = setTimeout(() => {
      const s = this.states.get(chatJid);
      if (s && !s.jsonlPath && !s.loggedDiscoverWarn) {
        s.loggedDiscoverWarn = true;
        logger.warn({ chatJid, groupFolder }, 'ProgressTracker: JSONL not found within timeout, running typing-only');
      }
    }, JSONL_DISCOVER_TIMEOUT_MS);
  }

  /** Called when the agent sends a response back to the user. */
  onResponseReceived(chatJid: string): void {
    const state = this.states.get(chatJid);
    const msgId = state?.progressMsgId ?? null;
    const elapsed = state ? Math.round((Date.now() - state.startTime) / 1000) : 0;

    // Mark sendPending race: if in-flight send completes after this, it's a no-op
    if (state) state.progressMsgId = null;

    this._cleanup(chatJid);

    // Edit progress message to final "done" state (leave in chat for context)
    if (msgId && state) {
      this.editMsg(state.chatJid, msgId, `✅ Done in ${elapsed}s`).catch(() => {});
    }
  }

  /** Called when the container process exits (crash or clean stop). */
  onContainerStopped(chatJid: string, exitCode: number | null): void {
    const state = this.states.get(chatJid);
    if (!state) return; // onResponseReceived already ran — no-op

    const msgId = state.progressMsgId;
    this._cleanup(chatJid);

    // Only delete progress message on unexpected stop (crash)
    if (msgId && exitCode !== 0) {
      this.deleteMsg(chatJid, msgId).catch(() => {});
    }
  }

  // --- Internal ---

  private _cleanup(chatJid: string): void {
    const state = this.states.get(chatJid);
    if (!state) return;
    if (state.typingTimer) clearInterval(state.typingTimer);
    if (state.silenceTimer) clearTimeout(state.silenceTimer);
    if (state.pollTimer) clearInterval(state.pollTimer);
    if (state.discoverTimeout) clearTimeout(state.discoverTimeout);
    this.states.delete(chatJid);
  }

  private _pollJSONL(chatJid: string): void {
    const state = this.states.get(chatJid);
    if (!state) return;

    const sessionsDir = path.join(
      DATA_DIR,
      'sessions',
      state.groupFolder,
      '.claude',
      'projects',
      '-workspace-group',
    );

    try {
      // Discover JSONL file if not yet found
      if (!state.jsonlPath) {
        let files: string[];
        try {
          files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
        } catch {
          return; // directory not ready yet
        }

        let newest: { file: string; mtime: number } | null = null;
        for (const file of files) {
          try {
            const stat = fs.statSync(path.join(sessionsDir, file));
            const mtime = stat.mtimeMs;
            if (mtime >= state.discoverAfter) {
              if (!newest || mtime > newest.mtime) {
                newest = { file, mtime };
              }
            }
          } catch {
            // file disappeared between readdir and stat — ignore
          }
        }

        if (newest) {
          state.jsonlPath = path.join(sessionsDir, newest.file);
          logger.debug({ chatJid, jsonlPath: state.jsonlPath }, 'ProgressTracker: JSONL discovered');
        } else {
          return;
        }
      }

      // Read new content since last poll
      let stat: fs.Stats;
      try {
        stat = fs.statSync(state.jsonlPath);
      } catch {
        return;
      }

      if (stat.size <= state.jsonlSize) return; // no new content

      const fd = fs.openSync(state.jsonlPath, 'r');
      const readSize = Math.min(stat.size - state.jsonlSize, 4096);
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, state.jsonlSize);
      fs.closeSync(fd);
      state.jsonlSize = stat.size;

      const lines = buf.toString('utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        this._parseLine(chatJid, line);
      }
    } catch (err) {
      logger.debug({ chatJid, err }, 'ProgressTracker: poll error');
    }
  }

  private _parseLine(chatJid: string, line: string): void {
    const state = this.states.get(chatJid);
    if (!state) return;

    let obj: any;
    try { obj = JSON.parse(line); } catch { return; }

    if (obj?.type !== 'assistant') return;
    const content: any[] = obj?.message?.content ?? [];
    const toolUse = content.find((b: any) => b?.type === 'tool_use');
    if (!toolUse) return;

    const name: string = toolUse.name ?? 'Tool';
    const input = toolUse.input ?? {};
    let arg = '';

    if (name === 'Bash') arg = String(input.command ?? '').slice(0, 60);
    else if (['Read', 'Write', 'Edit'].includes(name)) arg = path.basename(String(input.file_path ?? ''));
    else if (['WebSearch', 'WebFetch'].includes(name)) {
      const raw = String(input.query ?? input.url ?? '');
      try { arg = new URL(raw).hostname; } catch { arg = raw.slice(0, 40); }
    }

    const formatted = arg ? `🔧 ${name} → ${arg}` : `🔧 ${name}`;
    state.lastTool = formatted.slice(0, 80);
    state.lastActivityTime = Date.now();

    // Reset silence timer
    if (state.silenceTimer) clearTimeout(state.silenceTimer);
    state.silenceTimer = setTimeout(() => this._onSilence(chatJid), SILENCE_THRESHOLD_MS);

    // Schedule throttled edit if progress message exists
    if (state.progressMsgId && !state.editThrottle) {
      state.editThrottle = true;
      setTimeout(() => this._flushEdit(chatJid), EDIT_THROTTLE_MS);
    }
  }

  private _onSilence(chatJid: string): void {
    const state = this.states.get(chatJid);
    if (!state) return;

    const text = this._formatProgress(state);

    if (!state.progressMsgId) {
      // First time: send new message
      state.sendPending = true;
      this.sendMsg(chatJid, text)
        .then((res: any) => {
          state.sendPending = false;
          // If onResponseReceived already ran, progressMsgId was set to null — don't overwrite
          if (state.progressMsgId === null && res?.message_id) {
            // Check state still exists (not cleaned up)
            if (this.states.has(chatJid)) {
              state.progressMsgId = res.message_id;
            }
          }
        })
        .catch(() => { state.sendPending = false; });
    } else {
      // Already sent: just update
      this._flushEdit(chatJid);
    }

    // Re-arm silence timer for ongoing updates
    state.silenceTimer = setTimeout(() => this._onSilence(chatJid), SILENCE_THRESHOLD_MS);
  }

  private _flushEdit(chatJid: string): void {
    const state = this.states.get(chatJid);
    if (!state) return;
    state.editThrottle = false;
    if (!state.progressMsgId) return;

    const text = this._formatProgress(state);
    this.editMsg(chatJid, state.progressMsgId, text)
      .catch((err: any) => {
        if (err?.error_code === 429) {
          // Rate limited — retry once after 5s
          setTimeout(() => {
            const s = this.states.get(chatJid);
            if (s?.progressMsgId) {
              this.editMsg(chatJid, s.progressMsgId, this._formatProgress(s)).catch(() => {});
            }
          }, 5000);
        } else if (err?.error_code === 400) {
          // Message deleted by user
          if (state) state.progressMsgId = null;
        }
      });
  }

  private _formatProgress(state: TrackerState): string {
    const elapsed = Math.round((Date.now() - state.startTime) / 1000);
    const tool = state.lastTool ?? '🤔 thinking...';
    return `⏳ ${elapsed}s — ${tool}`;
  }
}
```

- [ ] **Step 2: Build TypeScript**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/progress-tracker.ts
git commit -m "feat: add ProgressTracker for real-time Telegram progress updates"
```

---

## Chunk 3: Wire ProgressTracker into index.ts and container-runner.ts

### Task 4: Wire into index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import ProgressTracker and instantiate singleton**

Add import near top of `src/index.ts` (after existing imports):

```typescript
import { ProgressTracker } from './progress-tracker.js';
```

After `const queue = new GroupQueue(...)` (or wherever channels are initialized), add:

```typescript
// Initialized after channels are ready in main()
let progressTracker: ProgressTracker;
```

In `main()`, after channels are set up and before `startMessageLoop()`, add:

```typescript
// Wire ProgressTracker with Telegram send/edit/delete/typing
progressTracker = new ProgressTracker({
  sendMsg: async (jid, text) => {
    const ch = findChannel(channels, jid);
    if (!ch) return;
    // grammy sendMessage returns the Message object with message_id
    return (ch as any).sendMessageRaw?.(jid, text);
  },
  editMsg: async (jid, msgId, text) => {
    const ch = findChannel(channels, jid) as any;
    await ch?.editMessage?.(jid, msgId, text);
  },
  deleteMsg: async (jid, msgId) => {
    const ch = findChannel(channels, jid) as any;
    await ch?.deleteMessage?.(jid, msgId);
  },
  setTyping: async (jid, typing) => {
    const ch = findChannel(channels, jid);
    await ch?.setTyping?.(jid, typing);
  },
});
```

**Note:** `sendMsg` needs to return `{ message_id }`. We need `sendMessageRaw` on TelegramChannel (see Task 5).

- [ ] **Step 2: Call onMessageSent when message is piped to active container**

In `src/index.ts`, find the block after `queue.sendMessage(chatJid, formatted)` returns `true`:

```typescript
if (queue.sendMessage(chatJid, formatted)) {
  // ... existing code ...
  // ADD THIS:
  progressTracker?.onMessageSent(chatJid, group.folder);
}
```

- [ ] **Step 3: Call onResponseReceived in agent result callback**

In `src/index.ts`, in the `runAgent` callback (the `async (result) => {` block), find where `result.result` is processed and `channel.sendMessage` is called. After the `if (text) { await channel.sendMessage(...) }` block:

```typescript
if (result.status === 'success') {
  queue.notifyIdle(chatJid);
  progressTracker?.onResponseReceived(chatJid); // ADD THIS
}
```

- [ ] **Step 4: Build**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire ProgressTracker into message loop (onMessageSent + onResponseReceived)"
```

---

### Task 5: Add sendMessageRaw to TelegramChannel + wire onContainerStopped

**Files:**
- Modify: `src/channels/telegram.ts`
- Modify: `src/container-runner.ts`

- [ ] **Step 1: Add sendMessageRaw to TelegramChannel**

In `src/channels/telegram.ts`, add a method that returns the raw grammy Message (with `message_id`), near the other send methods:

```typescript
async sendMessageRaw(jid: string, text: string): Promise<{ message_id: number } | undefined> {
  if (!this.bot) return undefined;
  try {
    const numericId = Number(jid.replace(/^tg:/, ''));
    const MAX_LENGTH = 4096;
    if (text.length <= MAX_LENGTH) {
      const msg = await this.bot.api.sendMessage(numericId, text);
      return { message_id: msg.message_id };
    }
    // Long message: send first chunk only for progress tracker purposes
    const msg = await this.bot.api.sendMessage(numericId, text.slice(0, MAX_LENGTH));
    return { message_id: msg.message_id };
  } catch (err) {
    logger.debug({ jid, err }, 'sendMessageRaw failed');
    return undefined;
  }
}
```

- [ ] **Step 2: Wire onContainerStopped in container-runner.ts**

In `src/container-runner.ts`, the `container.on('close', (code) => { ... })` handler resolves the promise. We need to call `onContainerStopped` there.

Add a callback parameter to `runContainer`:

```typescript
export async function runContainer(
  group: RegisteredGroup,
  input: ContainerInput,
  onProcess: (proc: ChildProcess, containerName: string) => void,
  onOutput?: (output: ContainerOutput) => Promise<void>,
  onStopped?: (chatJid: string, exitCode: number | null) => void, // ADD
): Promise<ContainerOutput>
```

Inside `container.on('close', (code) => { ... })`, before `resolve(...)` calls, add:

```typescript
onStopped?.(input.chatJid, code);
```

Then in `src/index.ts`, update the `runContainer` call to pass `onStopped`:

```typescript
await runContainer(
  group,
  input,
  onProcess,
  wrappedOnOutput,
  (chatJid, exitCode) => progressTracker?.onContainerStopped(chatJid, exitCode),
);
```

- [ ] **Step 3: Build**

```bash
cd /home/andrii-panasenko/nanoclaw && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/channels/telegram.ts src/container-runner.ts src/index.ts
git commit -m "feat: wire onContainerStopped and add sendMessageRaw for progress tracking"
```

---

## Chunk 4: Final integration

### Task 6: Restart and verify

- [ ] **Step 1: Restart nanoclaw**

```bash
systemctl --user restart nanoclaw && sleep 2 && systemctl --user status nanoclaw
```

Expected: `active (running)`

- [ ] **Step 2: Tail logs**

```bash
journalctl --user -u nanoclaw -f
```

- [ ] **Step 3: Manual Telegram test**

Send a message to the bot. Within 4s you should see "typing..." indicator in Telegram.
If the agent takes >30s, you should see a progress message appear and update.

- [ ] **Step 4: Rebuild container and verify Sonnet**

Send a task to the bot. Check logs:

```bash
journalctl --user -u nanoclaw --no-pager -n 30 | grep -i "model\|sonnet"
```

Or inside a new container session check `~/.claude/settings.json` was created.

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -p && git commit -m "fix: progress tracker integration adjustments"
```
