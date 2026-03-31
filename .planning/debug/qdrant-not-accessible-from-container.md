---
status: awaiting_human_verify
trigger: "Qdrant is not accessible from within agent containers"
created: 2026-03-31T00:00:00Z
updated: 2026-03-31T00:00:00Z
---

## Current Focus

hypothesis: Qdrant URL mismatch between host and container environments
test: Read container-runner.ts, qdrant-client.ts, cortex-mcp-tools.ts to trace URL configuration
expecting: Find where container gets its Qdrant URL and whether it resolves correctly inside container network
next_action: Read all relevant source files

## Symptoms

expected: Agent containers can reach Qdrant at its configured URL and perform vector operations (search, upsert, etc.)
actual: Qdrant is unreachable from inside containers — connection refused or timeout
errors: Unknown — check logs, code, and container config for clues
reproduction: Any cortex operation (search, write, relate) inside a running agent container
started: Recent — commit "fix(qdrant): bind to 0.0.0.0 so Docker containers can reach the host" exists, may be incomplete

## Eliminated

## Evidence

## Resolution

root_cause:
fix:
verification: |
  - qdrant-client.test.ts: 7/7 tests pass (including new QDRANT_URL env var test)
  - cortex-mcp-tools.test.ts: 34/34 tests pass
  - Build succeeds (only pre-existing whatsapp/task-scheduler errors)
  - Qdrant container confirmed reachable from Docker via alpine test
  - systemd daemon-reload completed
files_changed:
  - src/cortex/qdrant-client.ts
  - src/cortex/qdrant-client.test.ts
  - src/container-runner.ts
  - ~/.config/systemd/user/nanoclaw.service
