# Phase 21: Nightshift Reconciliation - Research

**Researched:** 2026-03-31
**Domain:** Cortex autonomous maintenance (staleness detection, similarity discovery, orphan cleanup)
**Confidence:** HIGH

## Summary

Phase 21 implements Cortex reconciliation as a Night Shift fallback activity -- not a standalone cron job. When the Night Shift planner detects an empty idea pool during the 21:03 planning phase, it generates Cortex maintenance tasks that execute during the 23:27 execution window. The four reconciliation steps (staleness cascade, CROSS_LINK discovery, orphan cleanup, summary report) leverage existing infrastructure from Phases 14-20: STALENESS_TTLS constants from types.ts, cortex-graph.ts addEdge/saveGraph for CROSS_LINK edges, embedder.ts for re-embedding, and agent-status-embeds.ts for posting to #agents.

The core engineering work is a new `src/cortex/reconciler.ts` module exposing pure functions for each reconciliation step, plus integration with the Night Shift planner to generate these as tasks. The reconciler does NOT need to modify task-scheduler.ts or create new cron entries -- it works by influencing the Night Shift planning prompt so that Jarvis includes Cortex maintenance tasks in the nightly plan when nothing else is queued.

**Primary recommendation:** Build a standalone reconciler module with 4 exported functions (checkStaleness, discoverCrossLinks, findOrphans, generateReport), callable from a Night Shift task prompt or standalone script. Wire into Night Shift by updating the Gruppenführer's plan-exhaustion fallback to include Cortex maintenance tasks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Cortex reconciliation is a Night Shift fallback activity, NOT a separate scheduled task. When Friday/Alfred finish planned tasks and the idea pool is empty, they pick up Cortex maintenance work.
- **D-02:** The Night Shift planner generates Cortex maintenance tasks when no other work is queued -- staleness checks, CROSS_LINK discovery, orphan cleanup, documentation alignment, Cortex knowledge consolidation.
- **D-03:** This integrates into the existing Night Shift planning phase (21:03) and execution phase (23:27). No new cron entries needed.

### Claude's Discretion
- Frequency balance: whether to guarantee periodic Cortex maintenance (e.g., weekly) even when other tasks exist, or keep it strictly as fallback
- How Night Shift planner detects "nothing else to do" and pivots to Cortex maintenance
- Reconciliation step ordering (re-embed first, then staleness, then CROSS_LINK, then orphans)
- Staleness TTLs per cortex_level (Phase 14 deferred this to Claude)
- CROSS_LINK cosine similarity threshold for auto-discovery
- Orphan detection criteria (no references, no searches, missing frontmatter)
- Summary report format for #agents (embed type, fields, detail level)
- Whether reconciliation runs as a single task or split into sub-tasks per step

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NIGHT-01 | Nightshift reconciliation runs nightly via Alfred scheduled task | Integration with Night Shift planner/Gruppenführer plan-exhaustion fallback. No new cron -- existing 21:03/23:27 cycle handles it. |
| NIGHT-02 | Staleness cascade flags entries not updated in configurable N days | STALENESS_TTLS already defined in src/cortex/types.ts (L10=14d, L20=30d, L30=60d, L40=90d, L50=180d). Use `updated` frontmatter field + gray-matter parsing. |
| NIGHT-03 | CROSS_LINK auto-discovery promotes semantically similar entries (cosine > threshold) to graph edges | Qdrant scroll API retrieves all vectors. Pairwise cosine comparison or search-based approach. addEdge() from cortex-graph.ts writes CROSS_LINK edges. |
| NIGHT-04 | Orphan cleanup identifies entries with no references or searches | Cross-reference cortex-graph.json edges + vault file glob + frontmatter validation check. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @qdrant/js-client-rest | ^1.14.0 | Vector search and scroll for CROSS_LINK discovery | Already used by embedder.ts and cortex-mcp-tools.ts |
| gray-matter | ^4.0.3 | Parse frontmatter for staleness checking | Already used by parser.ts and embedder.ts |
| zod | ^4.3.6 | Validate reconciliation config and report schema | Already used throughout cortex/ modules |
| discord.js | ^14.25.1 | EmbedBuilder for #agents summary report | Already used by agent-status-embeds.ts |
| pino | ^9.6.0 | Logging | Already used project-wide |

### No Additional Libraries Needed
All reconciliation logic uses existing infrastructure:
- Qdrant client for vector similarity (scroll + search APIs)
- gray-matter for frontmatter parsing
- cortex-graph.ts for CROSS_LINK edge operations
- agent-status-embeds.ts pattern for Discord embed reports
- Node.js built-in fs/glob for file enumeration

## Architecture Patterns

### Recommended Project Structure
```
src/cortex/
  reconciler.ts          # Core reconciliation logic (4 step functions + orchestrator)
  reconciler.test.ts     # Unit tests for all 4 steps
```

### Pattern 1: Pure Function Module (like lore-mining.ts)
**What:** A module with exported async functions that accept dependencies (OpenAI, Qdrant, paths) as parameters. No class, no singleton state.
**When to use:** This is the established pattern in the cortex/ directory (embedder.ts, lore-mining.ts, cortex-mcp-tools.ts).
**Example:**
```typescript
// Follows lore-mining.ts DI pattern
export async function runReconciliation(
  cortexDir: string,
  graphPath: string,
  qdrant: QdrantClient,
  openai: OpenAI,
  options?: ReconciliationOptions,
): Promise<ReconciliationReport> {
  const staleEntries = await checkStaleness(cortexDir, options?.stalenessTTLs);
  const newLinks = await discoverCrossLinks(qdrant, graphPath, options?.cosineThreshold);
  const orphans = await findOrphans(cortexDir, graphPath, qdrant);
  return { staleEntries, newLinks, orphans, runAt: new Date().toISOString() };
}
```

### Pattern 2: Night Shift Integration via Prompt Engineering
**What:** The Gruppenführer's plan-exhaustion fallback includes Cortex maintenance as a task category. When the shared plan is done and no GSD backlog exists, it generates a task that runs the reconciler.
**When to use:** D-01/D-02/D-03 mandate no new cron entries. The existing Gruppenführer (cron `nanoclaw-gruppenfuhrer-v1`) already has a plan-exhaustion path ("asks Jarvis to expand from GSD backlog -> Notion -> cortex TODOs -> free work").
**How:** The Gruppenführer prompt and/or the Night Shift planning prompt get updated to include Cortex reconciliation as a maintenance category. The agent calls the reconciler functions via a script or via shell commands.

### Pattern 3: Script Entrypoint (like cortex-reembed was planned)
**What:** A standalone TypeScript script that can be called from a Night Shift task prompt.
**When to use:** Night Shift tasks execute as container agents with prompts. The reconciler needs to run on the host side (direct Qdrant/filesystem access), so it should be a script callable via `npx tsx src/cortex/reconciler.ts` or similar.

**Important constraint:** The reconciler MUST run on the host side, not in a container. It needs direct access to:
- The cortex/ vault directory (for reading frontmatter dates)
- Qdrant at localhost:6333 (for vector similarity)
- cortex-graph.json (for reading/writing edges)

This means it should be wired as a host-side script that Night Shift tasks invoke, similar to how lore-mining.ts is designed to be "called from a Night Shift task prompt or standalone."

### Anti-Patterns to Avoid
- **New cron entry:** D-01/D-03 explicitly forbid this. Reconciliation is a Night Shift fallback, not a separate schedule.
- **Container-side reconciler:** The reconciler needs direct Qdrant access and filesystem writes to cortex-graph.json -- container agents access Qdrant via host.docker.internal and cannot write to cortex-graph.json directly.
- **Modifying task-scheduler.ts:** The scheduler is for general tasks. Night Shift integration happens at the prompt/planning level, not scheduler code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector similarity | Custom cosine distance function | Qdrant's `search` API with score_threshold | Qdrant already does cosine similarity natively; avoids downloading all vectors to JS |
| Frontmatter parsing | Custom YAML parser | gray-matter + parseCortexEntry() from parser.ts | Already battle-tested in the codebase |
| Graph edge writes | Direct JSON manipulation | addEdge() + saveGraph() from cortex-graph.ts | Handles dedup, self-edge prevention, atomic writes |
| Discord embeds | Raw Discord API calls | EmbedBuilder from discord.js + existing embed patterns | Consistent with agent-status-embeds.ts |
| File enumeration | Manual recursive directory walk | Node.js 22 fs.glob() or glob() from node:fs/promises | Already used in cortex-reembed pattern (Phase 16 D-06) |

**Key insight:** Every building block already exists in the codebase from Phases 14-20. Phase 21 is an orchestration/integration phase, not a new-infrastructure phase.

## Common Pitfalls

### Pitfall 1: CROSS_LINK Discovery Performance
**What goes wrong:** Naive approach downloads all vectors from Qdrant, computes pairwise cosine similarity in JS. For N entries, this is O(N^2) comparisons and requires holding all vectors in memory.
**Why it happens:** Tempting to treat Qdrant as a dumb store and do similarity in application code.
**How to avoid:** Use Qdrant's `search` API: for each entry, search for similar entries with score_threshold. This leverages HNSW index for O(N * log(N)) total complexity. Limit to top-K matches per entry (e.g., 5). Filter out entries that already have a CROSS_LINK edge.
**Warning signs:** Memory usage spikes, slow execution time on even modest collections.

### Pitfall 2: Staleness Detection Using Wrong Date Field
**What goes wrong:** Using file mtime instead of frontmatter `updated` field. File mtime changes when the embedder writes source_hash back to frontmatter, resetting the staleness clock.
**Why it happens:** The embedder's updateFrontmatter() modifies files after embedding, changing mtime.
**How to avoid:** Always use the `updated` or `last_updated` frontmatter field for staleness calculation. If neither exists, use `created`. If none exist, flag as stale immediately.
**Warning signs:** Entries never become stale despite not being meaningfully updated.

### Pitfall 3: Reconciler Runs in Container Instead of Host
**What goes wrong:** Night Shift agents run in containers. If reconciliation runs inside a container, it cannot write to cortex-graph.json or access Qdrant at localhost:6333 directly.
**Why it happens:** Natural assumption that agent tasks = container tasks.
**How to avoid:** Make the reconciler a host-side script. Night Shift task prompts should instruct the agent to run it via bash: `npx tsx scripts/cortex-reconcile.ts`. The agent runs in a container but shells out to the host? No -- the script should be registered as a Night Shift task with `script` field pointing to a host-side executable.

**Better approach:** The reconciler runs as a **host-side scheduled function** called before or after Night Shift execution, OR the task-scheduler's runTask() is enhanced to support host-side scripts. Given D-01 ("no new cron"), the cleanest approach is to have the Night Shift planning prompt include reconciliation as a task, and the agent uses IPC to trigger a host-side reconciliation command.

**Simplest approach:** Add a new IPC command `cortex_reconcile` that the container agent can call via the MCP server. The host-side handler runs the reconciler and returns the report. This follows the exact pattern of cortex_write (agent triggers via IPC, host does the work).

### Pitfall 4: Overloading #agents with Verbose Reports
**What goes wrong:** Posting detailed per-entry staleness reports to #agents creates noise.
**Why it happens:** Being too thorough in reporting.
**How to avoid:** Summary report should be 3-5 lines with counts: "Flagged X stale entries, discovered Y new CROSS_LINKs, found Z orphans." Detailed data goes to a log file or cortex entry, not Discord.
**Warning signs:** Reports longer than a single Discord embed field.

### Pitfall 5: CROSS_LINK Threshold Too Low/High
**What goes wrong:** Threshold too low (0.7) creates noisy false-positive links. Threshold too high (0.95) finds almost nothing.
**Why it happens:** No empirical testing of the collection's similarity distribution.
**How to avoid:** Start with 0.85 as a threshold. The reconciler should log the similarity scores of proposed links so the threshold can be tuned. Make it configurable via ReconciliationOptions.
**Warning signs:** Either zero links discovered or dozens of irrelevant links per run.

### Pitfall 6: Self-linking in CROSS_LINK Discovery
**What goes wrong:** An entry's most similar match is itself (score 1.0), creating a self-edge attempt.
**Why it happens:** Entry is obviously most similar to its own vector.
**How to avoid:** addEdge() already rejects self-edges (returns false when source === target). Additionally, filter out the source entry from search results before processing.
**Warning signs:** Lots of "addEdge returned false" in logs.

## Code Examples

### Staleness Check (using existing infrastructure)
```typescript
// Source: src/cortex/types.ts (STALENESS_TTLS), src/cortex/parser.ts (parseCortexEntry)
import { STALENESS_TTLS } from './types.js';
import { parseCortexEntry } from './parser.js';

interface StaleEntry {
  filePath: string;
  cortexLevel: string;
  daysSinceUpdate: number;
  ttlDays: number;
}

function checkStaleness(cortexDir: string): StaleEntry[] {
  const now = Date.now();
  const stale: StaleEntry[] = [];
  // glob all .md files in cortex/
  for (const filePath of globSync(cortexDir + '/**/*.md')) {
    const entry = parseCortexEntry(filePath, 'permissive');
    if (!entry.validation.valid) continue;

    const level = entry.validation.data.cortex_level;
    const ttl = STALENESS_TTLS[level];

    // Use updated/last_updated from frontmatter, not file mtime
    const updated = entry.frontmatter.updated || entry.frontmatter.last_updated || entry.frontmatter.created;
    if (!updated) { stale.push({ filePath, cortexLevel: level, daysSinceUpdate: Infinity, ttlDays: ttl }); continue; }

    const updatedMs = new Date(String(updated)).getTime();
    const daysSince = Math.floor((now - updatedMs) / 86400000);

    if (daysSince > ttl) {
      stale.push({ filePath, cortexLevel: level, daysSinceUpdate: daysSince, ttlDays: ttl });
    }
  }
  return stale;
}
```

### CROSS_LINK Discovery (using Qdrant search)
```typescript
// Source: src/cortex/cortex-graph.ts (addEdge, saveGraph, loadGraph, hasEdge)
import { loadGraph, saveGraph, addEdge, hasEdge } from './cortex-graph.js';
import type { QdrantClient } from '@qdrant/js-client-rest';

const DEFAULT_COSINE_THRESHOLD = 0.85;
const MAX_LINKS_PER_ENTRY = 3;

async function discoverCrossLinks(
  qdrant: QdrantClient,
  graphPath: string,
  threshold = DEFAULT_COSINE_THRESHOLD,
): Promise<{ source: string; target: string; score: number }[]> {
  const graph = loadGraph(graphPath);
  const discovered: { source: string; target: string; score: number }[] = [];

  // Scroll all entries with vectors
  let offset: string | number | undefined;
  const allPoints: { id: string; vector: number[]; payload: Record<string, unknown> }[] = [];
  do {
    const page = await qdrant.scroll('cortex-entries', {
      limit: 100,
      with_vector: true,
      with_payload: true,
      offset,
    });
    allPoints.push(...(page.points as any[]));
    offset = page.next_page_offset ?? undefined;
  } while (offset);

  // For each entry, search for similar entries above threshold
  for (const point of allPoints) {
    const filePath = point.payload.file_path as string;
    const results = await qdrant.search('cortex-entries', {
      vector: point.vector,
      limit: MAX_LINKS_PER_ENTRY + 1, // +1 for self
      score_threshold: threshold,
    });

    for (const match of results) {
      const targetPath = (match.payload as any)?.file_path as string;
      if (targetPath === filePath) continue; // skip self
      if (hasEdge(graph, filePath, targetPath, 'CROSS_LINK')) continue;

      const added = addEdge(graph, {
        source: filePath,
        target: targetPath,
        type: 'CROSS_LINK',
        created: new Date().toISOString(),
      });
      if (added) {
        discovered.push({ source: filePath, target: targetPath, score: match.score });
      }
    }
  }

  if (discovered.length > 0) saveGraph(graphPath, graph);
  return discovered;
}
```

### Summary Report Embed (using existing embed pattern)
```typescript
// Source: src/agent-status-embeds.ts pattern
import { EmbedBuilder } from 'discord.js';
import { AGENT_COLORS, withAgentMeta } from './agent-message-schema.js';

interface ReconciliationReport {
  staleCount: number;
  newLinksCount: number;
  orphanCount: number;
  runAt: string;
  durationMs: number;
}

function buildReconciliationEmbed(report: ReconciliationReport): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6) // purple for maintenance
    .setTitle('Cortex Reconciliation')
    .setDescription(
      [
        `Stale entries flagged: **${report.staleCount}**`,
        `New CROSS_LINKs: **${report.newLinksCount}**`,
        `Orphans found: **${report.orphanCount}**`,
        `Duration: ${Math.round(report.durationMs / 1000)}s`,
      ].join('\n'),
    )
    .setTimestamp(new Date(report.runAt));

  return withAgentMeta(embed, {
    agentName: 'Cortex',
    messageType: 'progress',
  });
}
```

## Recommendations (Claude's Discretion Areas)

### Frequency: Weekly Guarantee
**Recommendation:** Guarantee reconciliation runs at least weekly, even when other tasks exist. The Night Shift planner should check when reconciliation last ran (stored in a simple file like `cortex/reconciliation-last-run.txt` or a frontmatter field) and include it if it has been 7+ days.
**Rationale:** Staleness TTLs are 14-180 days. A weekly check ensures entries are caught within one TTL period of their expiry. Strictly-fallback-only risks weeks without maintenance during busy periods.

### Detection of "Nothing Else to Do"
**Recommendation:** The Gruppenführer already handles plan exhaustion ("On plan exhaustion: asks Jarvis to expand from GSD backlog -> Notion -> cortex TODOs -> free work"). Add "Cortex reconciliation" as a category in this fallback chain, before "free work". Check last-run timestamp to decide if it is due.

### Step Ordering
**Recommendation:**
1. Staleness check (fast, read-only, gives overview)
2. CROSS_LINK discovery (slower, writes to graph)
3. Orphan detection (read-only, uses graph from step 2)
4. Summary report (aggregates all steps)

Re-embedding is NOT part of reconciliation -- that is the watcher's job (Phase 16). If staleness flagging changes frontmatter, the watcher handles re-embed automatically.

### Staleness TTLs
**Already defined:** STALENESS_TTLS in src/cortex/types.ts: L10=14d, L20=30d, L30=60d, L40=90d, L50=180d. Use as-is.

### CROSS_LINK Cosine Threshold
**Recommendation:** 0.85 initial threshold, configurable. This is high enough to avoid noise but low enough to discover meaningful connections. Log all discovered scores so the threshold can be empirically tuned.

### Orphan Detection Criteria
**Recommendation:** An entry is an orphan if ALL of these are true:
1. No edges in cortex-graph.json (neither source nor target of any edge)
2. Missing required frontmatter fields (cortex_level, confidence, domain, scope)
3. Content body < 50 characters (too short to be useful)

Note: "no searches" is hard to track without search logging infrastructure (not built). Defer search-count tracking. Focus on graph isolation + frontmatter completeness.

### Summary Report Format
**Recommendation:** Single EmbedBuilder with 3 fields (stale count, new links count, orphan count) + timestamp + duration. Detailed entries go to a log file at `cortex/reconciliation-log/YYYY-MM-DD.md` for human review in Obsidian.

### Single Task vs Sub-Tasks
**Recommendation:** Single task. All 4 steps are fast (estimated < 60s for 100-200 entries) and logically coupled. Splitting into sub-tasks adds scheduling complexity for no benefit.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | vitest.config.ts (inferred from package.json) |
| Quick run command | `npx vitest run src/cortex/reconciler.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NIGHT-01 | Reconciliation callable from Night Shift (exports runReconciliation) | unit | `npx vitest run src/cortex/reconciler.test.ts -t "runReconciliation"` | Wave 0 |
| NIGHT-02 | checkStaleness flags entries past TTL | unit | `npx vitest run src/cortex/reconciler.test.ts -t "staleness"` | Wave 0 |
| NIGHT-03 | discoverCrossLinks adds CROSS_LINK edges above threshold | unit | `npx vitest run src/cortex/reconciler.test.ts -t "CROSS_LINK"` | Wave 0 |
| NIGHT-04 | findOrphans identifies entries with no edges + bad frontmatter | unit | `npx vitest run src/cortex/reconciler.test.ts -t "orphan"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/cortex/reconciler.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/cortex/reconciler.test.ts` -- covers NIGHT-01 through NIGHT-04
- [ ] No new framework install needed -- vitest already configured

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Qdrant | CROSS_LINK discovery, orphan detection | Requires check | localhost:6333 | Skip CROSS_LINK step if unavailable |
| OpenAI API | Not directly needed (reconciler reads existing vectors) | N/A | N/A | N/A |
| Node.js | Script execution | Available | 22.x | -- |
| cortex-graph.json | CROSS_LINK writes, orphan detection | Available | At cortex/cortex-graph.json | Created empty if missing (loadGraph handles this) |

**Missing dependencies with no fallback:** None -- Qdrant is the only external dependency and it degrades gracefully.

**Missing dependencies with fallback:**
- If Qdrant is unreachable, CROSS_LINK discovery is skipped. Staleness check and orphan detection (graph-based) still work.

## Open Questions

1. **Host-side execution mechanism**
   - What we know: The reconciler needs host-side access (filesystem, Qdrant, cortex-graph.json). Container agents communicate with the host via IPC.
   - What's unclear: Whether to add a new IPC command (`cortex_reconcile`) or make it a standalone script that runs outside the container agent flow.
   - Recommendation: Add an IPC command. This follows the established pattern (cortex_write, cortex_relate) and lets Night Shift agents trigger reconciliation naturally. The host-side handler runs all 4 steps and returns the report.

2. **Night Shift planner integration specifics**
   - What we know: The Gruppenführer has a plan-exhaustion fallback chain. The planner runs at 21:03 as a scheduled task with a prompt.
   - What's unclear: The exact prompt text and how it decides what to generate. The Gruppenführer is a DB-stored task prompt, not code.
   - Recommendation: The planner prompt and/or Gruppenführer prompt need text additions mentioning Cortex reconciliation as a maintenance category. This is a prompt edit, not code.

## Sources

### Primary (HIGH confidence)
- `src/cortex/types.ts` -- STALENESS_TTLS constants (L10=14d through L50=180d)
- `src/cortex/cortex-graph.ts` -- loadGraph, saveGraph, addEdge, hasEdge, buildIndex APIs
- `src/cortex/embedder.ts` -- DI pattern (openai, qdrant as params), embedEntry pipeline
- `src/cortex/parser.ts` -- parseCortexEntry with permissive mode
- `src/cortex/lore-mining.ts` -- Night Shift script pattern (standalone module, DI, MiningSummary return)
- `src/task-scheduler.ts` -- runTask flow, SchedulerDependencies.sendToAgents for #agents reporting
- `src/agent-status-embeds.ts` -- EmbedBuilder patterns for #agents
- `cortex/Areas/Projects/NightShift/cron-registry.md` -- Night Shift cron schedule and Gruppenführer behavior
- `cortex/Areas/Projects/NightShift/nightshift.architecture.md` -- 3-phase Night Shift architecture

### Secondary (MEDIUM confidence)
- Qdrant scroll API with `with_vector: true` for retrieving vectors -- used in cortex-mcp-tools.ts scroll pattern
- Node.js 22 fs.glob for file enumeration -- referenced in Phase 16 decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- follows established cortex/ module patterns (lore-mining.ts, embedder.ts)
- Pitfalls: HIGH -- derived from direct codebase analysis (updateFrontmatter mtime issue, container vs host execution)
- Night Shift integration: MEDIUM -- Gruppenführer is a DB prompt, not inspectable code; integration is prompt-level

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no external library changes expected)

## Project Constraints (from CLAUDE.md)

- **Tech Stack**: discord.js, Node.js, TypeScript -- reconciler follows same stack
- **Architecture**: Must follow channel registry pattern -- N/A for this phase (no new channel)
- **IPC Compatibility**: If adding cortex_reconcile IPC command, must follow existing IPC file-based pattern
- **Platform**: Linux (systemd for service management)
- **GSD Workflow**: All changes through GSD workflow
- **Impact Analysis**: After each change, verify blast radius -- reconciler writing to cortex-graph.json must not corrupt existing edges
