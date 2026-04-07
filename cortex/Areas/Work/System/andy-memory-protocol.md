---
cortex_level: L30
confidence: high
domain: system
scope: agent-behavior
last_updated: 2026-04-02
---

# Andy Memory Protocol

## Core Problem
Andy (and all agents) have a recurring issue: decisions made in a session are forgotten in the next one because they were never written down. This causes repeated mistakes, re-explaining of context, and drift between what was decided and what's in Cortex.

## Rule: Write Decisions Immediately

**Decisions must be written to Cortex IN THE SAME SESSION they are made.**

Not "at the end". Not "during night shift". NOW.

### What counts as a decision
- Architectural: "use Edit instead of cortex_write for entries with source_hash"
- Strategic: "Milestone 2 unblocked after Milestone 1 complete"
- Operational: "Gemini key must be replaced via aistudio.google.com, not regenerated in GCP"
- Scope: "don't write Georgia trip to Cortex — personal, not project"
- Pattern: "Planning cron skips if today's .md already exists"

### What doesn't count
- Temporary state (current build output, today's PR status) — use yw-core-status.md instead
- One-off facts with no future relevance

## Cortex Sync Trigger Points

After completing significant work, update Cortex before ending the session:

| Event | File to update |
|-------|---------------|
| GSD phase complete | `yw-core-status.md` |
| Atlas counts changed | `cf.atlas.md` |
| PR merged / milestone closed | `YourWave.md` |
| New blocker | create in `Areas/Work/Projects/YourWave/` |
| Blocker resolved | update that entry |
| Decision made | create/update relevant entry — **immediately** |

## Firewall Workaround (known issue)
Entries with `source_hash` or `embedding_model` in frontmatter block `cortex_write` even with valid cortex fields. Fix: use `Edit` tool directly on `/workspace/host/nanoclaw/cortex/` path. Do not waste time retrying cortex_write on these entries.
