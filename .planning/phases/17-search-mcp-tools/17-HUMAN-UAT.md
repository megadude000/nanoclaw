---
status: partial
phase: 17-search-mcp-tools
source: [17-VERIFICATION.md]
started: 2026-03-30T23:00:00Z
updated: 2026-03-30T23:00:00Z
---

## Current Test
[awaiting human testing]

## Tests

### 1. cortex_search returns ranked results from live Qdrant
expected: Agent calls cortex_search("NanoClaw architecture"), gets ranked results with metadata
result: [pending]

### 2. cortex_read returns full entry content from vault mount
expected: Agent calls cortex_read with vault path, gets file content including frontmatter
result: [pending]

### 3. cortex_write creates/updates vault file and triggers re-embedding
expected: Agent calls cortex_write, file appears in cortex/, watcher picks it up and re-embeds
result: [pending]

## Summary
total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
