---
cortex_level: L20
confidence: high
domain: yourwave
scope: git_workflow
tags:
  - git
  - merging
  - safety
  - nightshift
  - rule
created: 2026-04-05T08:55:00.000Z
updated: 2026-04-05T08:55:00.000Z
status: active
source_hash: 33a085dd5823a5b7d9dd1f0289e0176b2c2ee6ac592af7bd0ceb36406d475ff1
embedding_model: text-embedding-3-small
---

# Rule: Always Check Deletions Before Merging Nightshift → Main

## The Problem

Functionality in YW_Core is spread across many places — Astro pages, CRM modules, Atlas content, GSD planning docs, nanoclaw cortex, etc. A merge that looks clean can silently delete working features or docs if no one checks the `D` lines in the diff.

## The Rule

**Before every nightshift merge into main, run:**

```bash
git diff --name-status origin/main...origin/nightshift/YYYY-MM-DD | grep "^D"
```

For each deleted file, verify:
1. Was it intentionally deleted? (check `git log --all -- <file>`)
2. Is its content preserved elsewhere (archived, renamed, merged into another file)?
3. If uncertain — restore it and ask Andrii before merging.

## Safe Deletion Criteria

A deletion is safe if **any** of these are true:
- Commit message explicitly mentions the deletion (e.g. "archive", "remove unused", "replace with")
- File was authored by nightshift AND never existed on main
- Andrii confirms it can go

## Fast-Forward Preference

Always prefer `--ff-only` merge for nightshift branches. If `--ff-only` fails, it means main has diverged → **stop and investigate** before forcing a merge.

```bash
git merge --ff-only origin/nightshift/YYYY-MM-DD
```

If ff fails: rebase nightshift on top of updated main, verify diffs again, then merge.

## Origin

2026-04-05 — Andrii flagged that merging nightshift branches risks deleting functionality that is "spread everywhere" (nanoclaw, cortex, YW_Core). This rule was written to make the pre-merge deletion check a mandatory step in the nightshift protocol.
