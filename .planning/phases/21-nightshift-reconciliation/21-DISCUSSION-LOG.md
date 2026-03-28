# Phase 21: Nightshift Reconciliation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 21-nightshift-reconciliation
**Areas discussed:** Scheduling & agent integration

---

## Scheduling & Agent Integration

### How reconciliation fits Night Shift

| Option | Description | Selected |
|--------|-------------|----------|
| Separate scheduled task | New Alfred cron at e.g. 04:00, independent from Night Shift | |
| Night Shift wrap-up step | Final step in existing 23:27 execution window | |
| You decide | Claude picks | |

**User's choice:** Custom — "It has to be a part of their ideas if they don't have anything else to do or planned tasks - take idea from the pool and investigate/consolidate/check Cortex alignment, whatever, but to keep the documentation and Cortex in best shape"
**Notes:** NOT a fixed cron. Cortex maintenance is a fallback activity for Night Shift agents when planned tasks and idea pool are empty. Broader than automated checks — agents should exercise judgment about what needs attention.

### Periodic guarantee

| Option | Description | Selected |
|--------|-------------|----------|
| Strict fallback | Only when nothing else to do | |
| Weekly guaranteed | Reserve one night per week | |
| You decide | Claude picks the right balance | ✓ |

**User's choice:** You decide
**Notes:** Claude decides frequency balance

---

## Claude's Discretion

- Frequency balance (fallback only vs periodic guarantee)
- How planner detects idle state and pivots to Cortex
- Reconciliation step ordering and sub-task splitting
- Staleness TTLs, CROSS_LINK thresholds, orphan criteria
- Summary report format

## Deferred Ideas

None
