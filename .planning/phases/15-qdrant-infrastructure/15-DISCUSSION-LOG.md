# Phase 15: Qdrant Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 15-qdrant-infrastructure
**Areas discussed:** Storage & persistence

---

## Storage & Persistence

### Data location

| Option | Description | Selected |
|--------|-------------|----------|
| Bind-mount ./data/qdrant/ | Inside NanoClaw project directory, visible, easy backup, git-ignorable | ✓ |
| Bind-mount ~/data/qdrant/ | Home directory, outside project, survives project dir changes | |
| Docker named volume | Managed by Docker, invisible to file explorer, standard approach | |

**User's choice:** Bind-mount ./data/qdrant/
**Notes:** Matches project's existing data patterns, keeps everything colocated

## Claude's Discretion

- Deployment method (systemd unit vs docker-compose)
- Network access and port binding
- Qdrant collection configuration (distance metric, HNSW params, payload indexes)
- Snapshot/backup strategy

## Deferred Ideas

None — discussion stayed within phase scope
