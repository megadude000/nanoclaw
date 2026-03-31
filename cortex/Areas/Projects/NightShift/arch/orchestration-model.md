---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: Night Shift orchestration model - Jarvis as active orchestrator, 3-phase shift, two bots, circuit breakers
project: NightShift
tags: [nightshift, orchestration, automation, wind-rose, circuit-breaker]
created: 2026-03-31
---

# Night Shift — Orchestration Model

## Why Jarvis is Active Orchestrator, Not Passive Cron

The central design decision in Night Shift v2.1 is that Jarvis acts as an active orchestrator — a dispatcher, monitor, and archivist — rather than a passive cron that fires and forgets. A passive cron has no visibility into whether work is progressing well, cannot regroup when a bot stalls, and cannot adapt task priorities mid-shift. The active model gives Jarvis the ability to detect failing bots early, halt them before they exhaust the shift budget, reassign work, and ensure the morning report is coherent rather than fragmented.

This was a deliberate rejection of the supervisor+workers model (see Rejected Alternatives below), in favor of a self-scheduling loop where Jarvis directly reads state files and makes dispatch decisions.

## 3-Phase Shift Structure

**Phase 1: Planned Work (23:27 → plan complete)**
Cron triggers execution at 23:27. Task 0 is always a warm-up — build check and lint. If the environment is broken, halt immediately rather than waste the entire shift attempting real tasks. Friday and Alfred work in parallel on plan.json, batching 4–7 agents. Quality gates validate each task before it is marked done. Priority order: critical → high → normal.

**Phase 2: Autonomous Improvement — Wind Rose (plan complete → 06:00)**
The shift continues after all planned tasks are done — bots do not exit when the plan is exhausted. Jarvis runs a Wind Rose scan that scores 8 project axes: content, code, design, SEO, infra, funding, marketing, docs. Each bot picks the weakest axis in their domain and self-generates tasks. Friday handles code review, bug hunting, docs stewardship, and content quality. Alfred handles research, competitor analysis, ideas, and briefs for future shifts. Both bots independently write Atlas articles and Storybook prototypes. This phase recycles until the 06:00 hard deadline.

**Phase 3: Wrap-up (before 06:00 deadline)**
Final build and test verification. All changes committed to the `nightshift/YYYY-MM-DD` branch. Cloudflare Tunnels rebuilt for `storybook.yourwave.uk` and `dev.yourwave.uk`. Shift summary written to `/workspace/group/nightshift/logs/YYYY-MM-DD.md`. learning.json updated with actual vs estimated time for future estimation accuracy.

## Two Bots — Division of Labour

**Friday** — code and docs. Sender field: `"Friday"`. Primary responsibilities: executing planned code/content tasks, documentation stewardship, code review, lint fixes, type errors, and new Atlas articles in Phase 2.

**Alfred** — research and ideas. Sender field: `"Alfred"`. Primary responsibilities: executing planned research/analysis tasks, competitor analysis, technology scouting, new ideas, and preparing briefs for future shifts.

Both bots write Atlas articles and Storybook prototypes during Phase 2 — parallel generation is intentional to maximize content volume.

## Circuit Breakers

To prevent a failing bot from consuming the entire shift budget:
- Maximum 2 retries per task before marking as failed and moving to the next
- 3 consecutive failures across any tasks = halt the shift entirely and write a failure summary
- Manual STOP file override: placing a file at `/workspace/group/nightshift/STOP` halts execution

These limits exist because AI agents can loop indefinitely on broken environments without explicit bounds. The threshold of 3 consecutive failures was chosen to balance resilience against runaway cascades — a single failure is noise, three in a row signals a systemic problem.

## Morning Review Flow

Two separate digests run each morning:
1. **7:27** — Jarvis news digest (isolated channel, no Night Shift content)
2. **7:35** — Night Shift Approval (group context, structured per-category with merge/cherry-pick/reject buttons)

The two-digest split exists because mixing world news with approval decisions in one message creates cognitive overhead. The user needs different attention modes for each.

## Rejected Alternatives

**Supervisor + workers model** — rejected in favor of self-scheduling loop (Variant 1). A supervisor process adds an extra boundary and coordination overhead without meaningful gain when Jarvis can directly inspect state files. The loop model is simpler to debug and reason about.

**Friday-only schedule (original name confusion)** — "Friday" is the bot's name, not the day of the week. Night Shift runs daily. This distinction was explicitly captured in the decisions log after early confusion.
