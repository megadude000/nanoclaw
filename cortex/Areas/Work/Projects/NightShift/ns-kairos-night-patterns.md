---
cortex_level: L20
confidence: high
domain: nightshift
scope: operations
tags:
  - nightshift
  - kairos
  - patterns
  - lessons
  - operations
created: 2026-04-03T04:15:00.000Z
updated: 2026-04-03T04:15:00.000Z
status: live
source_hash: c652acf3f1fb5d278ac1c4c4505270c51a9aa220b08cd9e67394d9438d7441a1
embedding_model: text-embedding-3-small
---

# NightShift — KAIROS-Night Patterns & Lessons

> Operational knowledge from nightshift runs. Updated each shift.

## What Actually Works

### Batch parallel execution is the multiplier
- 4-7 parallel sub-agents = 10-16x throughput vs sequential
- April 2nd nightshift: 95% of all tasks done in 33 minutes (23:18-23:51)
- One session context-filled at ~95% → agent exited. KAIROS-night detected stall and restarted.
- **Pattern:** Plan in 5 bullets, blast-radius check, execute parallel, commit atomic.

### YAML apostrophes will break Ukrainian builds
- Single-quoted YAML strings `'...'` break if content contains `'` (apostrophe)
- Fix: escape as `''` (two single quotes) inside the YAML string
- Affected: article descriptions in Ukrainian — words like "людина's", "Ірландії's"
- The build gives: `bad indentation of a mapping entry` at the apostrophe column
- Always run `ASTRO_TELEMETRY_DISABLED=1 npm run build` after writing Ukrainian frontmatter

### ASTRO_TELEMETRY_DISABLED=1 required in container
- `npm run build` without it → `EACCES: permission denied, mkdir '/home/node/.config/astro'`
- Always prefix: `ASTRO_TELEMETRY_DISABLED=1 npm run build`

### Gemini/Imagen quota is 10 req/min
- Stop gracefully on quota; no retry loops
- gen_remaining.py referenced in plans but not present on disk — verify script existence before scheduling

### Context fills at ~95% → agent exits without marking plan complete
- KAIROS-night then reads [ ] tasks as stalled even if work was done
- Fix: write plan completion marker BEFORE context fills (write to plan file early)
- Or: use KAIROS-night P1 handler to update the plan file after detecting all tasks [x]

## KAIROS-Night Priority Routing

| Priority | Trigger | Action |
|----------|---------|--------|
| P0 | stalledMinutes > 45, remaining > 0 | Schedule restart once-task, alert Discord + Telegram |
| P1 | remaining == 0 | Align docs, lore commit, then P2 idle |
| P2 | running/idle | Test coverage → Cortex orphan linking → staleness sweep → pre-research |

## Stall Detection Edge Cases

- **False positive stall:** Agent worked hard, context filled, exited without marking plan — plan shows uncompleted tasks but work was done. KAIROS-night sees P0 stall.
  - Mitigation: check git log for commits from the stall window before scheduling restart
- **True stall:** Agent never fired, or first task blocked everything else
  - Mitigation: restart with reduced scope, skip known-blocked tasks

## Cortex Reconciliation Checklist

Run monthly or after major milestones:
1. Search all clusters: yourwave, atlas, nightshift, nanoclaw, coffee, gsd
2. Validate each entry: is status still true? are article counts correct? are blockers resolved?
3. Update stale entries, create missing ones
4. `cortex_relate` all new entries to parent hub
5. Write reconciliation log to `/workspace/group/cortex-reconciliation-YYYY-MM-DD.md`

## Article Count Reference

| Date | EN | CS | UK | Event |
|------|----|----|----|----|
| 2026-04-01 | 102 | 102 | 102 | GSD M1 complete, 5 translations |
| 2026-04-02 | 114 | 114 | 114 | Getting Started series (10 new), Physics series (13), evolution-brewing |
| 2026-04-03 | 117 | 117 | 117 | (projected) batch 2 — acidity, green-coffee-storage, tasting-glossary |
