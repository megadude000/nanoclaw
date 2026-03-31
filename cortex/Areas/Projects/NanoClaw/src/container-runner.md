---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: src/container-runner.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - container
created: '2026-03-31'
project: nanoclaw
---
# container-runner.ts

> Container Runner for NanoClaw

## Exports

### Functions

- `runContainerAgent(group: RegisteredGroup, input: ContainerInput, onProcess: (proc: ChildProcess, containerName: string)`
- `writeTasksSnapshot(groupFolder: string, isMain: boolean, tasks: Array<{ id: string; groupFolder: string; prompt: string; script?: string | null; schedule_type: string; schedule_value: string;)`
- `writeGroupsSnapshot(groupFolder: string, isMain: boolean, groups: AvailableGroup[], registeredJids: Set<string>,)` -- Write available groups snapshot for the container to read.

### Interfaces

- `ContainerInput`
- `ContainerOutput`
- `AvailableGroup`

## Environment Variables

- `ANTHROPIC_API_KEY` -- referenced in this module
- `CLAUDE_CODE_OAUTH_TOKEN` -- referenced in this module
- `HOME` -- referenced in this module
- `LOG_LEVEL` -- referenced in this module
- `XDG_RUNTIME_DIR` -- referenced in this module
