---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: src/task-scheduler.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - scheduler
created: '2026-03-31'
project: nanoclaw
source_hash: 5ac38168612fd42588e387254f0634d695fe3ab57bf61df8686d0a1312fea5db
embedding_model: text-embedding-3-small
---
# task-scheduler.ts

> Exports from task-scheduler.ts

## Exports

### Functions

- `computeNextRun(task: ScheduledTask)` -- Compute the next run time for a recurring task, anchored to the
- `startSchedulerLoop(deps: SchedulerDependencies)`
- `_resetSchedulerLoopForTests()` -- @internal - for tests only.

### Interfaces

- `SchedulerDependencies`
