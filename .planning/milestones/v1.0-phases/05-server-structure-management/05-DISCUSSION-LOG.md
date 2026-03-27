# Phase 5: Server Structure Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 05-server-structure-management
**Mode:** Auto (recommended defaults selected)
**Areas discussed:** IPC command format, Bootstrap approach, Permission model, Error handling

---

## IPC Command Format

| Option | Description | Selected |
|--------|-------------|----------|
| Typed action + params (Recommended) | discord_manage with action field and params object, matching existing IPC patterns | ✓ |
| Freeform string commands | Parse natural language commands — flexible but error-prone | |
| Separate message types per action | discord_create_channel, discord_delete_channel — granular but verbose | |

**User's choice:** [auto] Typed action + params (Recommended)

---

## Bootstrap Approach

| Option | Description | Selected |
|--------|-------------|----------|
| JSON config file (Recommended) | Declarative config defining target structure, idempotent bootstrap script | ✓ |
| Hardcoded in code | Target structure defined in TypeScript — less flexible | |
| IPC command sequence | Send individual create commands — more complex, not atomic | |

**User's choice:** [auto] JSON config file (Recommended)

---

## Permission Model

| Option | Description | Selected |
|--------|-------------|----------|
| Basic read/write/send (Recommended) | Simple per-channel overrides, sufficient for private server | ✓ |
| Role-based hierarchy | Multiple custom roles with inheritance — overkill for single user | |

**User's choice:** [auto] Basic read/write/send (Recommended)

---

## Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Log + return failure (Recommended) | Pino logging plus IPC response status, matches existing patterns | ✓ |
| Silent failure with retry | Auto-retry on failure — adds complexity without clear benefit | |

**User's choice:** [auto] Log + return failure (Recommended)

---

## Claude's Discretion

- Exact JSON config schema and location
- Bootstrap idempotency strategy details
- IPC response format
- Channel position ordering

## Deferred Ideas

None — discussion stayed within phase scope
