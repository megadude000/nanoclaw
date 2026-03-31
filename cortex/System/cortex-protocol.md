---
type: reference
cortex_level: L10
confidence: high
domain: nanoclaw
scope: cortex agent operational protocol
---

# Cortex Agent Protocol

Rules for every agent operating in this repository. These rules keep the Cortex knowledge base accurate, searchable, and self-consistent over time.

## Rule 1: Search Before Starting

Before any technical task, search Cortex for relevant prior knowledge:

1. Extract 2-3 key concepts from the task
2. Call `cortex_search` with a natural language query
3. If results score > 0.7 — call `cortex_read` on the top paths
4. Let retrieved knowledge inform your approach

Skip only for purely conversational tasks with no technical component.

## Rule 2: Write After Completing Work

After completing any task that changes code behavior, establishes a pattern, or makes an architectural decision — write a Cortex entry summarizing what was built and why.

**When to write:**
- Code task completed (new feature, bug fix, refactor)
- Architectural decision made
- Pattern established that future agents should follow
- Constraint or rejection discovered (something that won't work)

**How to write:**
```
cortex_write({
  path: "cortex/Areas/Projects/{Project}/{topic}.md",
  content: "# {Title}\n\n{What was built/decided and why}",
  frontmatter: {
    type: "reference",
    cortex_level: "L20",   // L20 for behavior/pattern, L30 for system topology
    confidence: "high",
    domain: "{project-name}",
    scope: "{what this covers}"
  }
})
```

**Level guidelines:**
- `L20` — how a component behaves, a pattern, a data flow decision
- `L30` — how subsystems compose, deployment topology, infrastructure
- `L40` — project overview, business context (use sparingly)

After writing, run `cortex_search` with the same topic to find related existing entries and link them (see Rule 4).

## Rule 3: Lore Trailers in Every Significant Commit

Every commit that makes a non-trivial decision MUST include one or more trailers in the last paragraph:

```
Constraint: {what must be done} -- {why, what happens if not}
Rejected: {alternative considered} -- {why it was rejected}
Directive: {forward mandate} -- {what future agents must do}
```

**Good example:**
```
feat(ipc): add cortex_reconcile handler

- Dynamic import of QdrantClient for graceful degradation

Constraint: dynamic import of @qdrant/js-client-rest -- avoids crash when Qdrant unavailable at startup
Rejected: static top-level import -- breaks the process if Qdrant is down
```

**Rules:**
- Trailers go in the LAST paragraph, separated from the body by a blank line
- One decision per trailer line
- Be specific: include WHAT and WHY
- Never rewrite existing commits to add trailers — forward-only

The lore mining pipeline (`mineLoreFromHistory`) will extract these trailers on every Night Shift cycle and embed them into Cortex automatically.

## Rule 4: Connect Related Knowledge

After writing a new Cortex entry, connect it to related existing entries:

```
cortex_relate(sourcePath, targetPath, edgeType)
```

**Edge types:**
- `IMPLEMENTS` — this entry implements the pattern described in target
- `EXTENDS` — this entry extends or builds on target
- `RELATES_TO` — semantic relationship, same domain/topic
- `CROSS_LINK` — auto-discovered by reconciler (score > 0.85), don't create manually
- `SUPERSEDES` — this entry replaces an outdated target

**When to relate:**
- You just wrote an entry that references another entry
- You find two entries covering the same concept from different angles
- A new entry implements a constraint found in a lore atom

## Rule 5: Reconciliation

The reconciler checks Cortex health: staleness, cross-links, orphans, and lore mining from git.

### Automated (Night Shift)

The Night Shift agent sends `cortex_reconcile` IPC when the idea pool is empty. The host runs `runReconciliation()` and posts a summary embed to #agents. No cron entry needed — it integrates into the existing 23:27 execution cycle.

### Manual trigger (via IPC file)

To run reconciliation outside of Night Shift, write an IPC file to the active group's IPC directory:

```bash
echo '{"type":"cortex_reconcile"}' > /workspace/group/{group-name}/ipc/manual-reconcile.json
```

The host IPC watcher picks it up within seconds. Check #agents for the result embed.

### What it does

- Flags entries stale past their TTL (L10=14d, L20=30d, L30=60d, L40=90d, L50=180d)
- Auto-discovers CROSS_LINKs between semantically similar entries (cosine > 0.85, max 3 per entry)
- Finds orphaned entries (no graph edges + incomplete frontmatter + short content)
- Mines git commit trailers (`Constraint/Rejected/Directive`) into `cortex/Lore/` vault files

### Known gap: health check does not validate Cortex

The daily 12:00 health check only verifies that crons are alive. It does NOT validate that Cortex entries match the current codebase. If you want to validate Cortex consistency after a large refactor, trigger reconciliation manually (above) and review the stale count in the result embed.

## Rule 6: Never Delete, Only Update

Cortex entries are never deleted — only updated or marked stale. If an entry is wrong:
- Update it with `cortex_write` using the same path
- The watcher will detect the change and re-embed it
- The old vector is replaced automatically

If an entry is superseded by a new one, add `cortex_relate(newPath, oldPath, "SUPERSEDES")`.

## Quick Reference

| Action | When | Tool |
|--------|------|------|
| Search before starting | Every technical task | `cortex_search` |
| Read relevant entries | Results score > 0.7 | `cortex_read` |
| Write after completing work | Code/architecture changed | `cortex_write` |
| Add lore trailers | Every significant commit | git trailer format |
| Connect related entries | After cortex_write | `cortex_relate` |
| Reconciliation | Automated (Night Shift) | `cortex_reconcile` IPC |
