---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: Cortex lore mining - git trailer format, parseLoreFromGit, writeLoreAtom, indexLoreAtoms, vault naming
project: nanoclaw
tags: [nanoclaw, cortex, lore, git-trailers, lore-atom, decisions, constraint, rejected, directive]
created: 2026-03-31
---

# Cortex — Lore Mining

## What Lore Mining Does

Lore mining extracts architectural decisions, constraints, and rejected alternatives from git commit history and stores them as searchable Cortex vault entries. The goal: decisions that were made during development (visible in commit messages) become findable via `cortex_search` rather than buried in git log output that agents rarely read.

## Git Trailer Format

Three trailer keys are recognized:
- **`Constraint:`** — a rule or limit that must always be respected
- **`Rejected:`** — an alternative approach that was considered and rejected (and why)
- **`Directive:`** — a forward-looking mandate or standard to follow going forward

Placement rules: trailers go in the last paragraph of the commit message, separated from the body by a blank line, one decision per line:
```
Fix IPC authorization for non-main groups

Non-main groups were able to send messages to any JID. Restricted to own JID only.

Constraint: Non-main groups can only send IPC messages to their own registered JID
Rejected: Token-based IPC auth -- file-path-based identity is simpler and equally secure
```

The forward-only rule: lore trailers are written in new commits, never added retroactively via `git commit --amend`. Amending would change the commit hash and could disrupt collaborators. Heuristic lore mining (Phase 20 one-time task) handled existing commits separately.

## parseLoreFromGit()

Uses native git parsing via `git log --format='%H%x00%s%x00%aI%x00%(trailers)%x00'` — no external CLI dependency. The `%(trailers)` git format specifier outputs all trailers for each commit. The null-byte `%x00` separates fields within each commit block.

Parsing: splits on `\x00\n` between commits, then splits each block on `\x00` to extract hash, subject, date, and trailer text. Runs regex `/^{Key}:\s*(.+)$/gm` for each of the three lore keys.

## writeLoreAtom()

Writes a `LoreAtom` to `{vaultDir}/Lore/` as a Cortex vault file.

**Vault naming convention**: `{7-char-hash}-{key-lowercase}.md`
- Example: `da8cd29-constraint.md`
- The 7-char hash makes the filename traceable to the specific commit
- The key suffix distinguishes multiple trailers from the same commit

**Idempotent**: if the file already exists (same hash + key), `writeLoreAtom()` returns `null` and skips. This means running lore mining multiple times on the same history is safe.

Frontmatter set automatically:
```yaml
type: lore-atom
cortex_level: L20
confidence: high  # or 'low' if options.mined = true (heuristic extraction)
domain: nanoclaw
scope: {first 60 chars of trailer value}
lore_key: Constraint  # or Rejected or Directive
lore_source: {commitHash}
lore_mined: true  # if heuristically extracted
```

The `lore_mined: true` flag distinguishes entries extracted heuristically (from existing commits without formal trailers, Phase 20 one-time task) from entries extracted from proper trailers (`lore_mined` absent or false).

## indexLoreAtoms()

After writing vault files, `indexLoreAtoms()` calls `embedEntry()` for each newly written file to immediately index the lore atoms in Qdrant. This makes them searchable via `cortex_search` without waiting for the next vault watcher cycle.

## Integration with Reconciliation (Phase 23)

`mineLoreFromHistory()` is called as Step 4 of `runReconciliation()` automatically during every Night Shift reconciliation cycle. It passes `since: lastReconciliationDate` to extract only new commits since the last run. The OpenAI client is passed in as a dependency — if unavailable, Step 4 is skipped gracefully without failing the rest of reconciliation.

## Heuristic Mining (Phase 20 One-Time Task)

For existing commits without formal trailers, `mineLoreFromHistory()` (in `src/cortex/lore-mining.ts`) uses pattern matching to identify decision-indicating language: "because", "instead of", "not using", "to avoid", "must", "chose", "rather than", etc. Extracted candidates are classified as Constraint/Rejected/Directive based on secondary pattern matching. These entries get `confidence: low` and `lore_mined: true`. Quality cap: 40 entries maximum to avoid over-extraction from large histories.
