---
phase: 11-blocker-handoff-reporting
plan: "02"
subsystem: ipc-blocker-handoff
tags: [discord, ipc, blocker, handoff, mcp-tools]
dependency_graph:
  requires: [buildBlockerEmbed/buildHandoffEmbed (Phase 11-01), agent_status IPC handler (Phase 10)]
  provides: [report_blocker MCP tool, report_handoff MCP tool, agent_blocker IPC handler, agent_handoff IPC handler]
  affects: [container/agent-runner/src/ipc-mcp-stdio.ts, src/ipc.ts]
tech_stack:
  added: []
  patterns: [IPC file-based messaging, sendToAgents failure-safe pattern, MCP tool registration]
key_files:
  modified:
    - container/agent-runner/src/ipc-mcp-stdio.ts
    - src/ipc.ts
decisions:
  - resource is required (not optional) in report_blocker — per CONTEXT.md decision, blockers must identify what is blocked
  - agent_blocker and agent_handoff handlers have no authorization check — status reporting is non-privileged (matching Phase 10 decision)
  - description falls back to 'No details provided' if missing on agent_blocker handler
  - why falls back to empty string if missing on agent_handoff handler
metrics:
  duration: "5 minutes"
  completed: "2026-03-28"
  tasks_completed: 2
  files_modified: 2
---

# Phase 11 Plan 02: IPC Wire-up for Blocker and Handoff Reporting Summary

**One-liner:** report_blocker and report_handoff MCP tools added to container agent-runner; agent_blocker and agent_handoff IPC handlers added to host ipc.ts completing the container-to-Discord pipeline.

## What Was Built

**Container side (`container/agent-runner/src/ipc-mcp-stdio.ts`):**

Two new `server.tool()` registrations inserted after `report_agent_status`:

- **`report_blocker`** — writes `{ type: 'agent_blocker', blockerType, resource, description, taskId?, agentName, groupFolder, timestamp }` to MESSAGES_DIR. `resource` is required. `blockerType` is `'perm' | 'service' | 'conflict'`.
- **`report_handoff`** — writes `{ type: 'agent_handoff', toAgent, what, why, taskId?, agentName, groupFolder, timestamp }` to MESSAGES_DIR.

Both use `assistantName` from env `NANOCLAW_ASSISTANT_NAME` (not a tool parameter).

**Host side (`src/ipc.ts`):**

- Import extended: `buildBlockerEmbed` and `buildHandoffEmbed` added to the existing import from `./agent-status-embeds.js`
- Two new `else if` branches in `processIpcFiles` message loop after the `agent_status` handler:
  - `agent_blocker`: guards on `blockerType && resource`, builds red embed via `buildBlockerEmbed`, sends via `deps.sendToAgents(embed).catch(() => {})`
  - `agent_handoff`: guards on `toAgent && what`, builds purple embed via `buildHandoffEmbed`, sends via `deps.sendToAgents(embed).catch(() => {})`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add report_blocker and report_handoff MCP tools | 746774a | container/agent-runner/src/ipc-mcp-stdio.ts |
| 2 | Add agent_blocker and agent_handoff IPC handlers on host | ab02f90 | src/ipc.ts |

## Verification

```
npx vitest run src/agent-status-embeds.test.ts
Test Files: 1 passed (1)
Tests: 51 passed (51)

grep -c "agent_blocker|agent_handoff" src/ipc.ts => 2
grep -c "report_blocker|report_handoff" container/agent-runner/src/ipc-mcp-stdio.ts => 2 (each)
TypeScript: no errors in modified files (ipc.ts, agent-status-embeds.ts)
```

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- container/agent-runner/src/ipc-mcp-stdio.ts: FOUND
- src/ipc.ts: FOUND
- Commit 746774a: FOUND
- Commit ab02f90: FOUND
