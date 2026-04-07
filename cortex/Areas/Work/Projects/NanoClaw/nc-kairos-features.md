---
cortex_level: L20
confidence: high
domain: system
scope: nanoclaw
tags:
  - nanoclaw
  - kairos
  - hooks
  - reflection
  - fingerprint
  - background-agents
  - decisions
updated: 2026-04-02T00:00:00.000Z
source_hash: b7a88ba1ec12b39e90d03d8f5f2bac7cc3c39bd967169a9f7bef259fef808e7e
embedding_model: text-embedding-3-small
---

# KAIROS-Inspired Features — IMPLEMENTED 2026-04-02

All 5 features below are live. Inspired by Claude Code KAIROS leak.

## Feature 1: Pre/PostToolUse Observation Hooks ✅
**File:** `/home/node/.claude/hooks/andy-observe.js`
**Config:** `/home/node/.claude/settings.json` — PreToolUse matcher: `Write|Edit|MultiEdit|Bash`
Logs significant tool calls to today's observation file. Never blocks — exits 0 with `{"continue":true}`.
- Write/Edit/MultiEdit → logs file path
- Bash → logs command (skips trivial: sleep, ls, echo, cat /ipc, date)

## Feature 2: Stop Hook + Auto-Compress ✅
**File:** `/home/node/.claude/hooks/andy-stop.js`
**Config:** `/home/node/.claude/settings.json` — Stop hook
Fires when Claude stops. Checks transcript file size as context usage proxy:
- >2MB → ~95%, >1.5MB → ~90%, >1MB → ~80%
- If ≥85% → blocks stop, injects reason: "Run /compress to save session"
**Loop prevention:** `stop_hook_active === true` → immediately approve (Claude Code protocol).

## Feature 3: Interrupt Priority Model P0/P1/P2 ✅
**Task:** KAIROS-lite (`task-1775141607741-l5q0h6`)
Script outputs `{wakeAgent, priority, data}`. Prompt routes by priority:
- P0 🚨 — crash/urgent labels → wake + message user immediately via tg:633706070
- P1 ⚡ — 3+ fresh issues → wake + schedule once-task for 09:00 next day
- P2 📋 — 1-2 low-priority issues → wake + append to nightshift tonight_goals
Script always posts status to Discord #logs regardless of wake decision.

## Feature 4: Reflection Loop ✅
**Task ID:** `task-1775151050526-okyljb`
**Schedule:** `45 0 * * *` (00:45 daily — runs after nightshift execution at 23:27)
**Silent:** true
Reads: `learning.json` + `observations/YYYY-MM-DD.md` + tonight's plan.
Detects recurring blockers (same issue 2+ nights = systemic).
Updates `learning.json` with: planned/completed/rate/wins/blockers/pattern/adjustment.
Posts to Discord #logs: `🔄 Reflection — planned N, completed M (X%). Adjustment: [one line]`

## Feature 6: Behavioral Fingerprint ✅
**Task ID:** `task-1775151071703-smltfx`
**Schedule:** `0 15 * * 0` (Sunday 15:00 weekly)
**Silent:** true
Reads last 7 days of conversation from messages.db.
Writes structured profile to `/workspace/group/preferences.md`:
- Active hours (peak/secondary/quiet)
- Task distribution (dev/content/planning/admin %)
- Communication style (language, terse vs detailed, voice frequency)
- Energy patterns (complex tasks best at which time)
- Nightshift adjustments (concrete suggestions)
Posts to Discord #logs: `🧬 BehaviorPrint updated — [key insight]`

## Architecture Notes
- All background tasks: `silent: 1` in DB → no ⏳/✅ Telegram noise
- All tasks post status to Discord #logs (`dc:1486972007433244742`) via DISCORD_BOT_TOKEN env
- Hook scripts location: `/home/node/.claude/hooks/`
- Container settings: `/home/node/.claude/settings.json`

## Discord Channels
- `#logs`: `dc:1486972007433244742` (DISCORD_LOGS_CHANNEL_ID env var)
- `#agents`: `dc:1486971999543889972` (DISCORD_AGENTS_CHANNEL_ID env var)

---

## Update 2026-04-02 20:05 — Hybrid Progress Notifications ✅

### Implementation: andy-observe.js (PreToolUse hook)
Routing logic based on `NANOCLAW_CHAT_JID` + `NANOCLAW_TASK_SILENT` env vars:
- `SILENT=1` (KAIROS, autoDream, reflection, fingerprint) → Discord #logs via API
- `CHAT_JID=user + SILENT=0` (user-spawned tasks) → IPC `/workspace/ipc/messages/` → Telegram
- No CHAT_JID (main direct session) → observation file only, no notification spam

### Files changed:
- `/home/node/.claude/hooks/andy-observe.js` — hybrid routing logic
- `/workspace/host/nanoclaw/src/container-runner.ts` — added `silent?: boolean` to ContainerInput
- `/workspace/host/nanoclaw/container/agent-runner/src/index.ts` — added `NANOCLAW_TASK_SILENT` env var + `silent` to ContainerInput
- `/workspace/host/nanoclaw/src/task-scheduler.ts` — passes `silent: task.silent ?? false` to ContainerInput

### Important ops that trigger notifications:
Bash: `npm run/build/test/install`, `tsc`, `git push/commit`, `curl -X POST/PUT`
Write/Edit: `*.ts`, `*.tsx`, `config.json`, `.env`, `*.mdx`, `nightshift/*`, `learning*`, cortex `*.md`
