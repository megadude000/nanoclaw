# Phase 8: Per-Channel Context and Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 08-per-channel-context-and-migration
**Mode:** Auto (recommended defaults selected)
**Areas discussed:** Channel CLAUDE.md content, Cortex integration, Migration toggle, Migration verification

---

## Channel-Specific CLAUDE.md Content

| Option | Description | Selected |
|--------|-------------|----------|
| Rich themed templates (Recommended) | Purpose-specific instructions per channel from config/channel-templates/ | ✓ |
| Enhanced stubs | Slightly richer stubs but still generic — insufficient for themed behavior | |
| Runtime prompt injection | Add channel context at message time — more complex, unnecessary | |

**User's choice:** [auto] Rich themed templates (Recommended)

---

## Cortex Knowledge Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Embed Cortex paths in CLAUDE.md (Recommended) | Static references in templates, forward-compatible | ✓ |
| Runtime Cortex lookup | Query Cortex at message time — adds complexity and latency | |

**User's choice:** [auto] Embed Cortex paths in CLAUDE.md (Recommended)

---

## Migration Toggle Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Extend routing.json (Recommended) | Add enabled field per target in existing config | ✓ |
| Separate migration config | New config file — fragmenting config unnecessarily | |
| Code-level flags | Hardcoded migration state — inflexible | |

**User's choice:** [auto] Extend routing.json (Recommended)

---

## Migration Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Manual verification (Recommended) | User verifies Discord works, then toggles Telegram off | ✓ |
| Automated health checks | Monitor Discord delivery before auto-disabling Telegram — over-engineered | |

**User's choice:** [auto] Manual verification (Recommended)

---

## Claude's Discretion

- Exact CLAUDE.md template content per channel
- Cortex vault path conventions
- Template file naming convention
- Whether enabled field defaults to true or is required
