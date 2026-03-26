---
type: project
date: YYYY-MM-DD
status: active
tags: []
---

# {{Project Name}}

## Overview


## Goals
-

## Key Files & Links


## Related Meetings
```dataview
TABLE date, attendees
FROM "Areas/Work"
WHERE project = "{{Project Name}}" AND type = "meeting"
SORT date DESC
```

## Session Logs
```dataview
TABLE date, file.link as Session
FROM "Areas/Work/Session-Logs"
WHERE project = "{{Project Name}}"
SORT date DESC
```

## Status
- [ ]
