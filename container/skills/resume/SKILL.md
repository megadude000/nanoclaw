---
name: resume
description: Load session context from previous session logs to restore working memory. Triggers on "/resume".
---

# /resume — Load Session Context

When the user runs `/resume` (optionally with args), load context from session logs to restore working memory.

## Arguments

- No args: load last 3 session logs
- Number (e.g. `/resume 10`): load last N sessions
- Keyword (e.g. `/resume auth`): load recent sessions + search for keyword
- Both (e.g. `/resume 5 auth`): last N sessions filtered by keyword

## Steps

### 1. Detect log location

```bash
test -d /workspace/project/cortex && echo "VAULT" || echo "GROUP"
```

- **VAULT**: session logs at `/workspace/project/cortex/Areas/Work/Session-Logs/`
- **GROUP**: session logs at `/workspace/group/Session-Logs/`

Also read CLAUDE.md:
- VAULT: `/workspace/project/cortex/CLAUDE.md`
- GROUP: `/workspace/group/CLAUDE.md`

### 2. Read CLAUDE.md

Summarise key points:
- Active projects
- Key decisions
- Pending tasks
- Relevant conventions

### 3. Load session logs

List session log files sorted by date (newest first). Take the requested number (default 3).

For each log, read the **Quick Reference** section first. If a search keyword was provided, scan the full log for mentions.

### 4. Report context

```
## Context Loaded

**CLAUDE.md:** [key points]
**Sessions loaded:** N

### What Was Being Worked On
[Summary of recent activity]

### Pending Tasks
[Open items found in logs]

### Relevant Finds
[If keyword search: matching excerpts]
```

Then ask: "What are we working on?"
