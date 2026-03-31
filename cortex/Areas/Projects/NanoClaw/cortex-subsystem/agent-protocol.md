---
type: reference
cortex_level: L20
confidence: high
domain: nanoclaw
scope: cortex agent operational protocol — rules for all agents
created: '2026-03-31'
updated: '2026-03-31'
---

# Cortex Agent Protocol

Six rules every agent must follow to keep Cortex accurate and self-consistent.
Full canonical doc: `cortex/System/cortex-protocol.md`

## Rule 1: Search Before Starting

Before any technical task — `cortex_search` with 2-3 key concepts, `cortex_read` on results > 0.7.
Skip only for purely conversational tasks.

## Rule 2: Write After Completing Work

After any code task, architectural decision, or established pattern — `cortex_write` a summary entry.
- L20 for behavior/pattern decisions
- L30 for system topology changes
- Then search for related entries and connect them (Rule 4)

## Rule 3: Lore Trailers in Commits

Every commit with a non-trivial decision MUST include trailers in the last paragraph:

```
Constraint: {what must be done} -- {why}
Rejected: {alternative} -- {why rejected}
Directive: {forward mandate} -- {what future agents must do}
```

These are automatically mined into `cortex/Lore/` on every Night Shift reconciliation cycle.

## Rule 4: Connect Related Knowledge

After `cortex_write`, connect to related entries via `cortex_relate`.
Edge types: IMPLEMENTS, EXTENDS, RELATES_TO, SUPERSEDES.

## Rule 5: Reconciliation Is Automated

Runs during Night Shift via `cortex_reconcile` IPC. Does: staleness check + stale marking,
cross-link discovery (cosine > 0.85), orphan detection, lore mining from git.
Manual trigger: write `{"type":"cortex_reconcile"}` to group IPC directory.

Known gap: daily health check (12:00) does NOT validate Cortex vs codebase.

## Rule 6: Never Delete, Only Update

Update via `cortex_write` on the same path. If superseded — `cortex_relate(new, old, "SUPERSEDES")`.
Watcher detects file change and re-embeds automatically.

## Why These Rules Exist

Without them: agents make decisions in a vacuum, repeat past mistakes, and Cortex becomes
a write-only archive nobody reads. The rules create a read-write loop:
search before → write after → connect → mine from git → reconcile → search before.
