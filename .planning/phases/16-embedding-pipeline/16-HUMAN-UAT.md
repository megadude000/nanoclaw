---
status: partial
phase: 16-embedding-pipeline
source: [16-VERIFICATION.md]
started: 2026-03-30T22:25:00Z
updated: 2026-03-30T22:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live integration test against running OpenAI + Qdrant
expected: embedEntry() successfully sends a real cortex .md file to OpenAI for embedding and stores the vector in Qdrant collection 'cortex-entries'
result: [pending]

### 2. Confirm 10-minute debounce fires in production
expected: After modifying a cortex .md file, the watcher waits 10 minutes of inactivity before calling embedEntry()
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
