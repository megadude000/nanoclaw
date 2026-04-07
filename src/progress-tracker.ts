/**
 * ProgressTracker — shows real-time progress while agent works.
 * Lifecycle: onMessageSent → [typing heartbeat + JSONL poll + 30s silence → progress message] → onResponseReceived
 */
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { DATA_DIR } from './config.js';

const TYPING_INTERVAL_MS = 4_000;
const SILENCE_THRESHOLD_MS = 30_000;
const EDIT_THROTTLE_MS = 3_000;
const JSONL_POLL_MS = 2_000;
const JSONL_DISCOVER_TIMEOUT_MS = 30_000;

interface TrackerState {
  chatJid: string;
  groupFolder: string;
  startTime: number;
  lastActivityTime: number;
  lastTool: string | null;
  progressMsgId: string | number | null;
  logsMsgId: string | number | null;
  sendPending: boolean;
  editThrottle: boolean;
  typingTimer: ReturnType<typeof setInterval> | null;
  silenceTimer: ReturnType<typeof setTimeout> | null;
  pollTimer: ReturnType<typeof setInterval> | null;
  discoverTimeout: ReturnType<typeof setTimeout> | null;
  jsonlPath: string | null;
  jsonlSize: number;
  discoverAfter: number;
  loggedDiscoverWarn: boolean;
}

type MsgId = string | number;
type SendFn = (
  jid: string,
  text: string,
) => Promise<{ message_id: MsgId } | void>;
type EditFn = (jid: string, msgId: MsgId, text: string) => Promise<void>;
type DeleteFn = (jid: string, msgId: MsgId) => Promise<void>;
type TypingFn = (jid: string, typing: boolean) => Promise<void>;

export class ProgressTracker {
  private states = new Map<string, TrackerState>();
  private sendMsg: SendFn;
  private editMsg: EditFn;
  private deleteMsg: DeleteFn;
  private setTyping: TypingFn;
  private dumpJid: string | null;

  constructor(deps: {
    sendMsg: SendFn;
    editMsg: EditFn;
    deleteMsg: DeleteFn;
    setTyping: TypingFn;
    dumpJid?: string;
  }) {
    this.sendMsg = deps.sendMsg;
    this.editMsg = deps.editMsg;
    this.deleteMsg = deps.deleteMsg;
    this.setTyping = deps.setTyping;
    this.dumpJid = deps.dumpJid ?? null;
  }

  onMessageSent(chatJid: string, groupFolder: string): void {
    this._cleanup(chatJid);
    const state: TrackerState = {
      chatJid,
      groupFolder,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      lastTool: null,
      progressMsgId: null,
      logsMsgId: null,
      sendPending: false,
      editThrottle: false,
      typingTimer: null,
      silenceTimer: null,
      pollTimer: null,
      discoverTimeout: null,
      jsonlPath: null,
      jsonlSize: 0,
      discoverAfter: Date.now() - 300_000, // look back 5min — covers reused sessions from prior messages
      loggedDiscoverWarn: false,
    };
    this.states.set(chatJid, state);

    this.setTyping(chatJid, true).catch(() => {});
    state.typingTimer = setInterval(
      () => this.setTyping(chatJid, true).catch(() => {}),
      TYPING_INTERVAL_MS,
    );
    // Send initial progress message immediately
    this._onSilence(chatJid);
    state.pollTimer = setInterval(
      () => this._pollJSONL(chatJid),
      JSONL_POLL_MS,
    );
    state.discoverTimeout = setTimeout(() => {
      const s = this.states.get(chatJid);
      if (s && !s.jsonlPath && !s.loggedDiscoverWarn) {
        s.loggedDiscoverWarn = true;
        logger.warn(
          { chatJid, groupFolder },
          'ProgressTracker: JSONL not found within timeout, typing-only mode',
        );
      }
    }, JSONL_DISCOVER_TIMEOUT_MS);
  }

  onResponseReceived(chatJid: string): void {
    const state = this.states.get(chatJid);
    const msgId = state?.progressMsgId ?? null;
    const logsMsgId = state?.logsMsgId ?? null;
    const elapsed = state
      ? Math.round((Date.now() - state.startTime) / 1000)
      : 0;
    if (state) {
      state.progressMsgId = null;
      state.logsMsgId = null;
    }
    this._cleanup(chatJid);
    const doneText = `✅ Done in ${elapsed}s`;
    if (msgId) {
      this.editMsg(chatJid, msgId, doneText).catch(() => {});
    }
    if (logsMsgId && this.dumpJid) {
      const logsText = `[${state?.groupFolder ?? chatJid}] ${doneText}`;
      this.editMsg(this.dumpJid, logsMsgId, logsText).catch(() => {});
    }
  }

  onContainerStopped(chatJid: string, exitCode: number | null): void {
    const state = this.states.get(chatJid);
    if (!state) return;
    const msgId = state.progressMsgId;
    const logsMsgId = state.logsMsgId;
    this._cleanup(chatJid);
    if (exitCode !== 0) {
      if (msgId) this.deleteMsg(chatJid, msgId).catch(() => {});
      if (logsMsgId && this.dumpJid)
        this.deleteMsg(this.dumpJid, logsMsgId).catch(() => {});
    }
  }

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
      if (!state.jsonlPath) {
        let files: string[];
        try {
          files = fs
            .readdirSync(sessionsDir)
            .filter((f) => f.endsWith('.jsonl'));
        } catch {
          return;
        }
        let newest: { file: string; mtime: number } | null = null;
        for (const file of files) {
          try {
            const stat = fs.statSync(path.join(sessionsDir, file));
            if (stat.mtimeMs >= state.discoverAfter) {
              if (!newest || stat.mtimeMs > newest.mtime)
                newest = { file, mtime: stat.mtimeMs };
            }
          } catch {
            /* file disappeared */
          }
        }
        if (!newest) return;
        state.jsonlPath = path.join(sessionsDir, newest.file);
        logger.debug(
          { chatJid, jsonlPath: state.jsonlPath },
          'ProgressTracker: JSONL discovered',
        );
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(state.jsonlPath);
      } catch {
        return;
      }
      if (stat.size <= state.jsonlSize) return;

      const readSize = Math.min(stat.size - state.jsonlSize, 4096);
      const buf = Buffer.alloc(readSize);
      const fd = fs.openSync(state.jsonlPath, 'r');
      fs.readSync(fd, buf, 0, readSize, state.jsonlSize);
      fs.closeSync(fd);
      state.jsonlSize = stat.size;

      for (const line of buf.toString('utf8').split('\n').filter(Boolean)) {
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
    try {
      obj = JSON.parse(line);
    } catch {
      return;
    }
    if (obj?.type !== 'assistant') return;
    const content: any[] = obj?.message?.content ?? [];
    const toolUse = content.find((b: any) => b?.type === 'tool_use');
    if (!toolUse) return;

    const name: string = toolUse.name ?? 'Tool';
    const input = toolUse.input ?? {};
    let arg = '';
    if (name === 'Bash') arg = String(input.command ?? '').slice(0, 60);
    else if (['Read', 'Write', 'Edit'].includes(name))
      arg = path.basename(String(input.file_path ?? ''));
    else if (['WebSearch', 'WebFetch'].includes(name)) {
      const raw = String(input.query ?? input.url ?? '');
      try {
        arg = new URL(raw).hostname;
      } catch {
        arg = raw.slice(0, 40);
      }
    }
    const formatted = arg ? `🔧 ${name} → ${arg}` : `🔧 ${name}`;
    state.lastTool = formatted.slice(0, 80);
    state.lastActivityTime = Date.now();

    if (state.silenceTimer) clearTimeout(state.silenceTimer);
    state.silenceTimer = setTimeout(
      () => this._onSilence(chatJid),
      SILENCE_THRESHOLD_MS,
    );

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
      state.sendPending = true;
      // Send to source channel
      this.sendMsg(chatJid, text)
        .then((res: any) => {
          state.sendPending = false;
          if (
            state.progressMsgId === null &&
            res?.message_id &&
            this.states.has(chatJid)
          ) {
            state.progressMsgId = res.message_id;
          }
        })
        .catch(() => {
          state.sendPending = false;
        });
      // Mirror to logs channel
      if (this.dumpJid && this.dumpJid !== chatJid) {
        const logsText = `[${state.groupFolder}] ${text}`;
        this.sendMsg(this.dumpJid, logsText)
          .then((res: any) => {
            if (
              state.logsMsgId === null &&
              res?.message_id &&
              this.states.has(chatJid)
            ) {
              state.logsMsgId = res.message_id;
            }
          })
          .catch(() => {});
      }
    } else {
      this._flushEdit(chatJid);
    }
    state.silenceTimer = setTimeout(
      () => this._onSilence(chatJid),
      SILENCE_THRESHOLD_MS,
    );
  }

  private _flushEdit(chatJid: string): void {
    const state = this.states.get(chatJid);
    if (!state) return;
    state.editThrottle = false;
    if (!state.progressMsgId) return;
    const text = this._formatProgress(state);
    // Edit source channel
    this.editMsg(chatJid, state.progressMsgId, text).catch((err: any) => {
      if (err?.error_code === 429) {
        setTimeout(() => {
          const s = this.states.get(chatJid);
          if (s?.progressMsgId)
            this.editMsg(
              chatJid,
              s.progressMsgId,
              this._formatProgress(s),
            ).catch(() => {});
        }, 5000);
      } else if (err?.error_code === 400) {
        if (state) state.progressMsgId = null;
      }
    });
    // Edit logs channel
    if (state.logsMsgId && this.dumpJid && this.dumpJid !== chatJid) {
      const logsText = `[${state.groupFolder}] ${text}`;
      this.editMsg(this.dumpJid, state.logsMsgId, logsText).catch(
        (err: any) => {
          if (err?.error_code === 400) state.logsMsgId = null;
        },
      );
    }
  }

  private _formatProgress(state: TrackerState): string {
    const elapsed = Math.round((Date.now() - state.startTime) / 1000);
    const tool = state.lastTool ?? '🤔 thinking...';
    return `⏳ ${elapsed}s — ${tool}`;
  }
}
