---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  GSD lore trailer convention - Constraint/Rejected/Directive keys, placement
  rules, forward-only, lore mining integration
project: nanoclaw
tags:
  - nanoclaw
  - gsd
  - lore
  - git-trailers
  - conventions
  - constraint
  - rejected
  - directive
created: 2026-03-31T00:00:00.000Z
source_hash: 267f915231508c7496580490be8358305ca293923a9861125bdcb7d1232d6397
embedding_model: text-embedding-3-small
---

# GSD — Lore Trailer Convention

## What Lore Trailers Are

Lore trailers are structured git commit metadata that capture architectural decisions, constraints, and rejected alternatives in a machine-readable format. They are the input to the lore mining pipeline, which converts them into searchable Cortex vault entries.

The convention exists because commit messages contain valuable decision context that is otherwise inaccessible — buried in git log output, unsearchable, and invisible to agents reading source code or vault entries. Lore trailers make this context extractable and indexable.

## Trailer Keys

Three keys are recognized:
- **`Constraint:`** — A rule or limit that must always be respected going forward. Example: `Constraint: Non-main groups can only send IPC messages to their own registered JID`
- **`Rejected:`** — An alternative approach that was considered and explicitly rejected, with enough context to understand why. Example: `Rejected: Token-based IPC auth -- file-path-based identity is simpler and equally secure for this threat model`
- **`Directive:`** — A forward-looking mandate or standard. Example: `Directive: All new database tables must have RLS enabled before any other policies are added`

## Placement Rules

1. Trailers must appear in the **last paragraph** of the commit message body
2. A **blank line** must separate the body from the trailer block (standard git trailer format)
3. One decision per line — each Constraint/Rejected/Directive on its own line
4. Multiple trailer keys can appear in the same commit

Correct example:
```
feat(19-01): implement cortex knowledge graph module

Bidirectional in-memory index for O(1) neighbor lookup. Atomic save
via temp+rename prevents partial writes on crash.

Constraint: Graph module has zero internal imports -- must work in both host and container contexts
Rejected: External graph database (Neo4j, etc.) -- JSON adjacency list is sufficient and eliminates infra dependency
Directive: addEdge must be idempotent -- duplicate (source, target, type) triples silently ignored
```

## Forward-Only: Never Amend

Lore trailers are ONLY written in new commits, never added to existing commits via `git commit --amend` or `git rebase -i`. Amending changes the commit hash, which:
- Disrupts any downstream reference to the original hash
- Creates confusion about when a decision was actually made
- Could break collaborators who have pulled the original hash

The heuristic mining task (Phase 20, one-time) handled extracting decisions from existing commits that predate this convention. That task is complete; going forward, all new decisions go in new commits.

## How This Feeds Lore Mining

The lore mining pipeline (`src/cortex/lore-parser.ts`) runs `git log --format='%(trailers)'` to extract these trailers from commit history. It runs automatically as Step 4 of Night Shift reconciliation. Each trailer becomes a vault file:
- Location: `cortex/Lore/{7-char-hash}-{key-lowercase}.md`
- Type: `lore-atom` with `cortex_level: L20`, `confidence: high`
- Searchable via `cortex_search` immediately after mining

This means the decision trail in git becomes part of the Cortex knowledge base without any additional manual step — writing good commit trailers is sufficient.

## What Qualifies for a Lore Trailer

Not every commit needs a lore trailer. Use trailers when:
- A non-obvious choice was made that future agents might question or change
- An alternative was explicitly evaluated and rejected
- A rule was established that should persist (constraint vs one-time decision)

Do NOT use trailers for:
- Obvious implementation details (no alternative was seriously considered)
- Temporary workarounds (use `TODO` or a comment instead)
- Changes that will be revisited soon

The goal is high signal: every lore atom should be genuinely useful context for a future agent encountering the code for the first time.
