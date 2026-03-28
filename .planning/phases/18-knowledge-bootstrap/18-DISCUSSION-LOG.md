# Phase 18: Knowledge Bootstrap - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 18-knowledge-bootstrap
**Areas discussed:** Bootstrap approach, Agent auto-query wiring

---

## Bootstrap Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Fully automated | Parse src/*.ts, generate entries, write straight to vault + Qdrant | ✓ |
| Generate then review | Stage entries for manual review before promoting to vault | |
| You decide | Claude picks | |

**User's choice:** Fully automated
**Notes:** Speed over curation. Run once, entries go straight in.

---

## Agent Auto-Query Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Always before any task | Every agent invocation queries Cortex | ✓ |
| Only for code/config tasks | Skip for pure conversation tasks | |
| You decide | Claude picks when appropriate | |

**User's choice:** Always before any task
**Notes:** Maximum context coverage, small cost per invocation acceptable.

---

## Claude's Discretion

- CLAUDE.md instruction wording
- Keyword extraction strategy for search queries
- Bootstrap extraction logic details
- Entry naming and path conventions

## Deferred Ideas

- Multi-project bootstrap — Phase 22
