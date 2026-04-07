---
type: index
source_hash: 811ccf82efbed1b9de42a7ebfdd0ef1d5b389dec4a8feaf83d0f31f82e95c643
embedding_model: text-embedding-3-small
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
