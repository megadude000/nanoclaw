# Phase 17: Search & MCP Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 17-search-mcp-tools
**Areas discussed:** Tool architecture, Search behavior, Confidence firewall

---

## All Areas

User was presented with three gray areas:
1. Tool architecture (direct calls vs IPC, query embedding location, tool count)
2. Search behavior (result format, hybrid routing logic, ranking)
3. Confidence firewall (strictness, gap handling)

**User's choice:** "All for Claude to decide, totally coding decisions"
**Notes:** All three areas designated as Claude's discretion. No specific user preferences — implementation decisions deferred to researcher and planner.

---

## Claude's Discretion

- Tool architecture: cortex_search/read/write implementation approach
- Search behavior: result format, hybrid routing logic, number of results
- Confidence firewall: enforcement strictness and gap handling

## Deferred Ideas

- cortex_relate tool — Phase 19
- Nightshift reconciliation — Phase 21
