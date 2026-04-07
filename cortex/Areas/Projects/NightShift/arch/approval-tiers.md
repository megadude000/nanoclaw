---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  Night Shift 3-tier approval system - auto-merge, flag for review, require
  approval + morning flow
project: NightShift
tags:
  - nightshift
  - approval
  - git
  - branch-isolation
  - morning-review
created: 2026-03-31T00:00:00.000Z
source_hash: 73c465df2967e132ce50ef13c0e9ac913bdbecd08d80c4529aea0ef30c11ed9c
embedding_model: text-embedding-3-small
---

# Night Shift — Approval Tiers

## Why a Tiered Approval System Exists

Not all autonomous work carries equal risk. A translated article has no structural impact; a database schema change could break production. Running all changes through manual approval would eliminate the value of autonomous overnight work — the user would spend the morning approving 40 trivial items. Running nothing through approval would mean ground-shifting architectural changes could be auto-merged without review.

The 3-tier system solves this by letting safe work merge automatically, flagging moderate changes for quick human review, and requiring explicit approval for anything that changes structure, architecture, or strategy.

## Tier Definitions

**Green — Auto-merge (safe)**
Changes that are additive, reversible, and domain-contained. Examples: new Atlas articles, translated content, Storybook stories for existing components, minor copy edits, blog posts. These merge automatically from the `nightshift/YYYY-MM-DD` branch with no user action required. The auto-merge decision was made explicitly: requiring approval for translations and articles defeats the purpose of autonomous content generation.

**Yellow — Flag for review (moderate)**
Changes that modify existing behavior or introduce new integrations, but are not ground-shifting. Examples: new UI components, updated READMEs, dependency updates, new analytics events. These appear in the 7:35 morning digest with individual approve/cherry-pick/reject buttons. The user reviews each item but the default action is approve.

**Red — Require approval (ground-shifting)**
Changes that alter architecture, data schemas, security model, or project direction. These require explicit approval before merging. Examples: new database tables, changes to auth flow, new third-party integrations, refactors that cross module boundaries. If the user does not respond to a red-tier item, it stays on the branch and does not merge.

## Git Branch Isolation

All Night Shift work happens on `nightshift/YYYY-MM-DD` branches, never on main. This creates a safe rollback: if the entire shift produces bad output, `git branch -D nightshift/YYYY-MM-DD` removes everything cleanly. Individual changes can be cherry-picked from the shift branch if only some are acceptable.

Branch naming convention is date-based (not shift-number-based) so branches are human-readable and self-documenting in the git log.

## Morning Review Flow — 7:35 Digest

The Night Shift Approval digest runs at 7:35, separate from the 7:27 news digest. It reads `/workspace/group/nightshift/reports/YYYY-MM-DD-approval.json` and presents:
- Summary: tasks completed, green/yellow/red counts
- Green items: listed but already merged
- Yellow items: each with approve/cherry-pick/reject buttons and a deep link to storybook.yourwave.uk or dev.yourwave.uk for visual review
- Red items: each with full diff summary and explicit approve/reject buttons

The approval report is written during Phase 3 wrap-up, not at morning time, so the 7:35 cron only reads and presents — no compute happens at digest time.

## Constraints

Expandable blocks (`<blockquote expandable>`) are mandatory for lists containing more than 5 items in the approval digest. This prevents the digest from being an unreadable wall of text when a shift produces many items.

The timing split (7:27 news, 7:35 approval) is intentional: mixing content discovery (news) with task management (approvals) in a single message degrades both. The user needs different focus modes for each.
