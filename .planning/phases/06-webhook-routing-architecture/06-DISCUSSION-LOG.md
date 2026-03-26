# Phase 6: Webhook Routing Architecture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 06-webhook-routing-architecture
**Mode:** Auto (recommended defaults selected)
**Areas discussed:** Routing config format, Routing granularity, Dual-send failure handling, Config reload strategy

---

## Routing Config Format

| Option | Description | Selected |
|--------|-------------|----------|
| JSON config file (Recommended) | Declarative config matching Phase 5 discord-server.json pattern | ✓ |
| Environment variables | Per-webhook env vars — inflexible, hard to manage multiple targets | |
| Database table | SQLite routing table — overkill for ~5 webhook types | |

**User's choice:** [auto] JSON config file (Recommended)

---

## Routing Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per webhook type (Recommended) | One config entry per handler (github-issues, notion, progress, etc.) | ✓ |
| Per event subtype | Route issue.opened differently from issue.closed — complex, unnecessary | |

**User's choice:** [auto] Per webhook type (Recommended)

---

## Dual-Send Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort with logging (Recommended) | Send to all targets, log errors, don't block others | ✓ |
| All-or-nothing | If one target fails, fail the whole delivery — too strict | |
| Silent failure | Don't log errors — loses observability | |

**User's choice:** [auto] Best-effort with logging (Recommended)

---

## Config Reload Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Read on every webhook (Recommended) | Fresh read each invocation, instant changes, simple | ✓ |
| Cache with file watcher | Better performance but adds complexity — not needed for infrequent webhooks | |

**User's choice:** [auto] Read on every webhook (Recommended)

---

## Claude's Discretion

- Exact JSON config schema structure and field names
- Helper function location and return types
- Order of dual-send delivery
- Whether to extend router.ts or create new module
