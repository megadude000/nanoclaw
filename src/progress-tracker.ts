/**
 * ProgressTracker — shows real-time progress while agent works.
 * Lifecycle: onMessageSent → [typing heartbeat + JSONL poll + 30s silence → progress message] → onResponseReceived
 */
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { DATA_DIR } from './config.js';
import { EditThrottler, handleEditFailure } from './edit-throttle.js';

const TYPING_INTERVAL_MS = 4_000;
const SILENCE_THRESHOLD_MS = 30_000;
const EDIT_THROTTLE_MS = 3_000;
const JSONL_POLL_MS = 2_000;
const JSONL_DISCOVER_TIMEOUT_MS = 30_000;
// Hold the first "⏳" message back this long. Quick replies (the common case
// now that chat runs at low effort) finish first and never post progress at
// all — the user just gets the answer. Only genuinely slow runs show progress.
const INITIAL_SHOW_MS = 7_000;

/**
 * Bucket a tool into a human "what was done" category, keyed by a
 * "singular|plural" noun so the done summary reads naturally ("3 edits, 1 run").
 */
function categorizeTool(name: string): string {
  switch (name) {
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
      return 'edit|edits';
    case 'Read':
      return 'file read|files read';
    case 'Bash':
      return 'command|commands';
    case 'Grep':
    case 'Glob':
      return 'search|searches';
    case 'WebSearch':
    case 'WebFetch':
      return 'web lookup|web lookups';
    case 'Skill':
      return 'skill|skills';
    default:
      return 'tool call|tool calls';
  }
}

/**
 * Extract a short "what I'm doing" phrase from the agent's narration: the first
 * sentence, stripped of markdown/internal tags, capped for a progress line.
 */
function firstSentence(text: string): string {
  const cleaned = text
    .replace(/<internal>[\s\S]*?<\/internal>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const m = cleaned.match(/^.*?[.!?](\s|$)/);
  const sentence = (m ? m[0] : cleaned).trim();
  return sentence.length > 80 ? sentence.slice(0, 79) + '…' : sentence;
}

/** Render a category tally as "3 edits, 1 command, 2 searches". */
function summarizeToolCounts(counts: Map<string, number>): string {
  const parts: string[] = [];
  // Stable, sensible order: edits, reads, commands, searches, web, skills, other.
  const order = [
    'edit|edits',
    'file read|files read',
    'command|commands',
    'search|searches',
    'web lookup|web lookups',
    'skill|skills',
    'tool call|tool calls',
  ];
  for (const key of order) {
    const n = counts.get(key);
    if (!n) continue;
    const [one, many] = key.split('|');
    parts.push(`${n} ${n === 1 ? one : many}`);
  }
  return parts.join(', ');
}

interface TrackerState {
  chatJid: string;
  groupFolder: string;
  startTime: number;
  lastActivityTime: number;
  lastTool: string | null;
  // Human "what I'm doing" line derived from the agent's own thinking/narration
  // in the transcript ("💭 Thinking…" or "💬 <first sentence>").
  lastIntent: string | null;
  // Count of top-level (main-agent) tool calls — a proxy for work done.
  stepCount: number;
  // Tally of work by category (edited/ran/read/searched/…) for the done summary.
  toolCounts: Map<string, number>;
  // Total subagents spawned this run (for the "used N subagents" summary).
  subagentsSpawned: number;
  // Active subagents: Task tool_use id → short label. Added when the agent
  // spawns a Task subagent, removed when that Task's tool_result lands.
  subagents: Map<string, string>;
  progressMsgId: string | number | null;
  logsMsgId: string | number | null;
  sendPending: boolean;
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
// Fired whenever the agent's current activity changes (tool / subagent).
// Used to feed the BotStatusPanel's live-activity line.
type ActivityFn = (jid: string, activity: string) => void;

export class ProgressTracker {
  private states = new Map<string, TrackerState>();
  private editThrottler = new EditThrottler(EDIT_THROTTLE_MS);
  private sendMsg: SendFn;
  private editMsg: EditFn;
  private deleteMsg: DeleteFn;
  private setTyping: TypingFn;
  private onActivity: ActivityFn | null;
  private dumpJid: string | null;

  constructor(deps: {
    sendMsg: SendFn;
    editMsg: EditFn;
    deleteMsg: DeleteFn;
    setTyping: TypingFn;
    onActivity?: ActivityFn;
    dumpJid?: string;
  }) {
    this.sendMsg = deps.sendMsg;
    this.editMsg = deps.editMsg;
    this.deleteMsg = deps.deleteMsg;
    this.setTyping = deps.setTyping;
    this.onActivity = deps.onActivity ?? null;
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
      lastIntent: null,
      stepCount: 0,
      toolCounts: new Map(),
      subagentsSpawned: 0,
      subagents: new Map(),
      progressMsgId: null,
      logsMsgId: null,
      sendPending: false,
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
    // Hold the first progress message back so quick replies stay clean.
    // If a tool arrives before this fires, the message still appears at
    // INITIAL_SHOW_MS reflecting the accumulated activity (see _parseLine,
    // which does not reschedule this timer until the message exists).
    state.silenceTimer = setTimeout(
      () => this._onSilence(chatJid),
      INITIAL_SHOW_MS,
    );
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
    // Final flush: fast runs can finish between 2s polls, so catch up on any
    // tool lines written since the last poll before summarizing what was done.
    if (state) {
      try {
        this._pollJSONL(chatJid);
      } catch {
        /* best-effort */
      }
    }
    const msgId = state?.progressMsgId ?? null;
    const logsMsgId = state?.logsMsgId ?? null;
    const elapsed = state
      ? Math.round((Date.now() - state.startTime) / 1000)
      : 0;
    const doneText = this._formatDone(state, elapsed);
    if (state) {
      state.progressMsgId = null;
      state.logsMsgId = null;
    }
    this._cleanup(chatJid);
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

      // Read the new bytes, but only advance the cursor to the last complete
      // line. A single big tool_use (e.g. a large Write) can exceed one read;
      // capping at 4096 mid-line used to silently drop the rest of that entry.
      const MAX_READ = 262_144; // 256KB/poll ceiling
      const readSize = Math.min(stat.size - state.jsonlSize, MAX_READ);
      const buf = Buffer.alloc(readSize);
      const fd = fs.openSync(state.jsonlPath, 'r');
      fs.readSync(fd, buf, 0, readSize, state.jsonlSize);
      fs.closeSync(fd);

      const chunk = buf.toString('utf8');
      const lastNl = chunk.lastIndexOf('\n');
      if (lastNl === -1) {
        // No complete line yet; wait for more bytes unless we hit the ceiling.
        if (readSize >= MAX_READ) state.jsonlSize += readSize;
        return;
      }
      // Advance only past the last newline actually consumed.
      state.jsonlSize += Buffer.byteLength(chunk.slice(0, lastNl + 1), 'utf8');

      for (const line of chunk.slice(0, lastNl).split('\n').filter(Boolean)) {
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

    let changed = false;

    // User messages carry tool_result blocks — used to detect when a spawned
    // subagent (Task tool) has finished, so we can drop it from the live list.
    if (obj?.type === 'user' && state.subagents.size > 0) {
      const content: any[] = Array.isArray(obj?.message?.content)
        ? obj.message.content
        : [];
      for (const block of content) {
        if (
          block?.type === 'tool_result' &&
          block.tool_use_id &&
          state.subagents.delete(block.tool_use_id)
        ) {
          changed = true;
        }
      }
      if (changed) this._onActivityChanged(chatJid, state);
      return;
    }

    if (obj?.type !== 'assistant') return;
    const content: any[] = obj?.message?.content ?? [];
    // A non-null parent_tool_use_id means this assistant turn belongs to a
    // subagent, not the top-level agent — don't count it as a main step.
    const isSubagentTurn = !!obj?.parent_tool_use_id;

    for (const block of content) {
      // The agent's own reasoning/narration — the most human "what I'm doing"
      // signal. Thinking blocks → "💭 Thinking…"; text → its first sentence.
      if (block?.type === 'thinking' || block?.type === 'redacted_thinking') {
        state.lastIntent = '💭 Thinking…';
        changed = true;
        continue;
      }
      if (block?.type === 'text' && typeof block.text === 'string') {
        const intent = firstSentence(block.text);
        if (intent) {
          state.lastIntent = `💬 ${intent}`;
          changed = true;
        }
        continue;
      }
      if (block?.type !== 'tool_use') continue;
      const name: string = block.name ?? 'Tool';

      if (name === 'Task' && block.id) {
        // Spawning a subagent — track it until its tool_result lands.
        const input = block.input ?? {};
        const label = String(
          input.subagent_type || input.description || 'subagent',
        )
          .replace(/[\n\r]+/g, ' ')
          .slice(0, 32);
        state.subagents.set(block.id, label);
        state.subagentsSpawned++;
        state.lastTool = `🤖 delegating → ${label}`;
        changed = true;
        continue;
      }

      state.lastTool = this._formatToolLabel(name, block.input ?? {});
      if (!isSubagentTurn) {
        state.stepCount++;
        const cat = categorizeTool(name);
        state.toolCounts.set(cat, (state.toolCounts.get(cat) ?? 0) + 1);
      }
      changed = true;
    }

    if (!changed) return;
    state.lastActivityTime = Date.now();
    this._onActivityChanged(chatJid, state);

    // Before the first message exists, leave the INITIAL_SHOW_MS timer alone —
    // accumulated activity just updates state and appears when it fires. Once
    // the message is live, keep it fresh (throttled edit) and push the silence
    // re-show timer out so the "still working" refresh cadence applies.
    if (state.progressMsgId) {
      if (state.silenceTimer) clearTimeout(state.silenceTimer);
      state.silenceTimer = setTimeout(
        () => this._onSilence(chatJid),
        SILENCE_THRESHOLD_MS,
      );
      this.editThrottler.schedule(chatJid, () => this._flushEdit(chatJid));
    }
  }

  /** Human-readable single-line label for a tool call. */
  private _formatToolLabel(name: string, input: any): string {
    let arg = '';
    if (name === 'Bash') arg = String(input.command ?? '').slice(0, 60);
    else if (['Read', 'Write', 'Edit', 'NotebookEdit'].includes(name))
      arg = path.basename(String(input.file_path ?? input.notebook_path ?? ''));
    else if (['WebSearch', 'WebFetch'].includes(name)) {
      const raw = String(input.query ?? input.url ?? '');
      try {
        arg = new URL(raw).hostname;
      } catch {
        arg = raw.slice(0, 40);
      }
    } else if (name === 'Skill')
      arg = String(input.command ?? input.skill ?? '');
    else if (name === 'Grep' || name === 'Glob')
      arg = String(input.pattern ?? '').slice(0, 40);
    const formatted = arg ? `🔧 ${name} → ${arg}` : `🔧 ${name}`;
    return formatted.slice(0, 80);
  }

  /** Push the current activity to the status-panel bridge (if wired). */
  private _onActivityChanged(chatJid: string, state: TrackerState): void {
    if (!this.onActivity) return;
    const base = state.lastTool ?? state.lastIntent ?? '💭 Thinking…';
    const activity =
      state.subagents.size > 0
        ? `${base} · ${state.subagents.size} subagent${state.subagents.size > 1 ? 's' : ''}`
        : base;
    try {
      this.onActivity(chatJid, activity);
    } catch {
      /* best-effort */
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
    // Clear any prior silence timer before rescheduling to avoid leaking a
    // timer set by _parseLine (which would fire a duplicate _onSilence).
    if (state.silenceTimer) clearTimeout(state.silenceTimer);
    state.silenceTimer = setTimeout(
      () => this._onSilence(chatJid),
      SILENCE_THRESHOLD_MS,
    );
  }

  private _flushEdit(chatJid: string): void {
    const state = this.states.get(chatJid);
    if (!state) return;
    if (!state.progressMsgId) return;
    const text = this._formatProgress(state);
    // Edit source channel
    this.editMsg(chatJid, state.progressMsgId, text).catch((err: unknown) => {
      handleEditFailure(err, {
        context: `progress-tracker:${chatJid}`,
        onRetry: () => {
          const s = this.states.get(chatJid);
          if (s?.progressMsgId)
            this.editMsg(
              chatJid,
              s.progressMsgId,
              this._formatProgress(s),
            ).catch(() => {});
        },
        onGone: () => {
          const s = this.states.get(chatJid);
          if (s) s.progressMsgId = null;
        },
      });
    });
    // Edit logs channel
    if (state.logsMsgId && this.dumpJid && this.dumpJid !== chatJid) {
      const logsText = `[${state.groupFolder}] ${text}`;
      this.editMsg(this.dumpJid, state.logsMsgId, logsText).catch(
        (err: unknown) => {
          handleEditFailure(err, {
            context: `progress-tracker:logs:${chatJid}`,
            onGone: () => {
              state.logsMsgId = null;
            },
          });
        },
      );
    }
  }

  private _humanDuration(sec: number): string {
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  }

  private _formatProgress(state: TrackerState): string {
    const elapsed = this._humanDuration(
      Math.round((Date.now() - state.startTime) / 1000),
    );
    const steps = state.stepCount > 0 ? ` · ${state.stepCount} steps` : '';
    const head = `⏳ ${elapsed}${steps}`;
    const lines: string[] = [];
    // Lead with the agent's own words (intent/thinking) when we have them.
    if (state.lastIntent) lines.push(`└ ${state.lastIntent}`);
    if (state.lastTool) lines.push(`└ ${state.lastTool}`);
    if (lines.length === 0) lines.push('└ 💭 Thinking…');
    if (state.subagents.size > 0) {
      const names = [...state.subagents.values()];
      const shown = names.slice(0, 3).join(', ');
      const more = names.length > 3 ? ` +${names.length - 3}` : '';
      lines.push(`└ 🤖 ${shown}${more} working`);
    }
    return `${head}\n${lines.join('\n')}`;
  }

  /** Compact one-line done summary: elapsed, steps, subagents used. */
  private _formatDone(
    state: TrackerState | undefined,
    elapsedSec: number,
  ): string {
    const elapsed = this._humanDuration(elapsedSec);
    if (!state) return `✅ Done in ${elapsed}`;

    // Summarize what actually happened, not just the clock. A pure text reply
    // (no tools) stays short; a working run reads "3 edits, 1 command · 12 steps".
    const bits: string[] = [];
    const work = summarizeToolCounts(state.toolCounts);
    if (work) bits.push(work);
    if (state.subagentsSpawned > 0) {
      bits.push(
        `${state.subagentsSpawned} subagent${state.subagentsSpawned > 1 ? 's' : ''}`,
      );
    }
    if (state.stepCount > 0) bits.push(`${state.stepCount} steps`);

    const summary = bits.length ? ` · ${bits.join(' · ')}` : '';
    return `✅ Done in ${elapsed}${summary}`;
  }
}
