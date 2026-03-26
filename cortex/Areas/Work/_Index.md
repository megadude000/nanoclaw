---
type: index
---

# Work Index

## Active Projects
```dataview
TABLE status, date
FROM "Areas/Work/Projects"
WHERE type = "project" AND status = "active"
SORT date DESC
```

## Recent Meetings
```dataview
TABLE date, project, attendees
FROM "Areas/Work/Meetings"
WHERE type = "meeting"
SORT date DESC
LIMIT 10
```

## Recent Sessions
```dataview
TABLE date, file.link as Session
FROM "Areas/Work/Session-Logs"
SORT date DESC
LIMIT 5
```
