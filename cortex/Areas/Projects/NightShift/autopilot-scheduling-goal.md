---
cortex_level: L30
confidence: high
domain: nanoclaw
scope: >-
  GOAL — rename "Night Shift" → "Autopilot" and put its scheduling on proper
  triggers (no polling hacks)
type: goal
status: open
tags:
  - autopilot
  - nightshift
  - scheduling
  - goal
  - cron
  - cost
  - rename
created: '2026-07-19'
project: nanoclaw
source_hash: 606d3d64bc079180fe43c54c4a0c4991e79846aebd95df382ae3e071bf9b596f
embedding_model: text-embedding-3-small
---
# GOAL: "Autopilot" — proper-time autonomous work, no polling hacks

**Set by:** Andrii (Fable session, 2026-07-19).

## Two intents

1. **Rename the concept.** "Night Shift" → **"Autopilot"** (neutral + helpful;
   describes autonomous scheduled work without the night/shift framing).
   Fable's pick, overridable. This is a careful, wide rename — treat as a goal,
   not a rushed edit.
2. **Proper scheduling.** Autopilot and the proactive/housekeeping tasks fire at
   **intentional times driven by real triggers**, not tight cron polling that
   fakes being event-driven. Maximize reasoning value on the work that matters;
   don't burn quota on loops.

## Done this session

- **Killed the 2-min hack:** `task-1775141595490-76ng8n` ("autoDream memory
  consolidation", cron `0 */2 10-18 * * *`) is **paused**. Its prompt claimed
  "idle time detected, no user interaction for 90+ minutes" but the cron fired
  every 2 minutes regardless — a fake idle trigger. It alone was ~270 Opus/max
  runs/day and exhausted the daily subscription quota.
- **Model/effort scales with cadence** (`task-scheduler.ts:chooseTaskModelEffort`):
  tasks ≥1h apart (Autopilot planning/execution/review, morning digest, weekly
  reviews, health checks) run **Opus/max**; anything more frequent runs
  **Sonnet/high**. Explicit per-task model still wins.
- **Rate-limit backoff:** a quota hit pushes the next fire out 30m and skips the
  #agents "Failed" embed, so a frequent task can't hammer the limit.

## Still to do (the goal)

1. **Rename "Night Shift" → "Autopilot" everywhere**, carefully: task prompts in
   the DB (`NIGHTSHIFT PLANNING/EXECUTION`), cron-registry, cortex project dirs
   (`Areas/Projects/NightShift`, `Areas/Work/Projects/NightShift`), docs/READMEs,
   observation-log paths, and any code/config strings. Keep the bot identities
   (Friday/Alfred) unless the user wants those changed too. Do it as one
   reviewed pass so nothing dangles.
2. **Real idle-triggered "autoDream", or drop it.** If idle memory
   consolidation is wanted, drive it from actual idle detection (host-side
   last-message timestamp), not a cron poll. Otherwise rely on the cortex
   watcher (real-time re-embedding) + Autopilot reconciliation and delete it.
3. **Audit the remaining poll-style tasks** — keep/retune/kill:
   - KAIROS-lite proactive pulse — `*/30 9-20 * * *` (~24/day, now Sonnet/high).
   - KAIROS-night supervisor — `15 0,1,2,3,4,5,23 * * *` (hourly overnight; lands
     on Opus/max → ~7 heavy runs/night — confirm that's wanted).
4. **Consolidate the schedule** into one source of truth (`cron-registry.md`)
   with canonical times: planning 21:03, execution 23:27 (continuous ~05:30),
   post-shift review 00:45, morning digest 07:27, health check 12:00. Remove
   duplicate/paused leftovers in the tasks DB.
5. **Prefer event/webhook triggers over cron polling** where a real event exists
   (Notion/GitHub webhooks already do this — extend the pattern).

## Guardrails now in place (so this can't regress silently)

- Frequency-aware tier + rate-limit backoff (above); `estimateTaskIntervalMs`
  is the cadence oracle, so any new sub-hourly task is auto-kept off Opus/max.

Related: [[NightShift]] [[comm-layer-stability-2026-07-19]]
