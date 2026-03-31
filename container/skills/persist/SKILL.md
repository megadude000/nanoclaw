---
name: persist
description: Save current session context to a session log so it can be resumed later. Triggers on "/persist".
---

# /persist — Save Session Context

When the user runs `/persist`, snapshot the current conversation into a dated session log file.

## Steps

### 1. Detect log location

Check if `/workspace/project/cortex` exists:
```bash
test -d /workspace/project/cortex && echo "VAULT" || echo "GROUP"
```

- **VAULT**: write to `/workspace/project/cortex/Areas/Work/Session-Logs/`
- **GROUP**: write to `/workspace/group/Session-Logs/`

Create the directory if it doesn't exist.

### 2. Generate session summary

Summarise the current conversation into this structure:

```markdown
# Session Log — YYYY-MM-DD HH:MM

## Quick Reference
- **Date:** YYYY-MM-DD HH:MM
- **Channel:** [channel name / JID]

## What Was Worked On
[2-5 bullet points of main activities this session]

## Key Decisions
[Any architectural, product, or ops decisions made]

## Files Changed
[List of files created or modified, with brief description]

## Pending Tasks
[Open items, unresolved bugs, things to pick up next session]

## Context Notes
[Anything important to carry forward]
```

### 3. Write to disk

Save as: `Session-YYYY-MM-DD-HHMM.md` in the detected log directory.

### 4. Confirm

Reply: `✅ Session persisted → \`[path]\`. Resume anytime with \`/resume\`.`
