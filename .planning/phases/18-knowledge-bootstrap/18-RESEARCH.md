# Phase 18: Knowledge Bootstrap - Research

**Researched:** 2026-03-31
**Domain:** TypeScript AST extraction, Cortex vault population, agent instruction wiring
**Confidence:** HIGH

## Summary

Phase 18 delivers the first real value from the Cortex knowledge layer by (1) running a bootstrap script that parses NanoClaw's `src/*.ts` files and generates 50-100 L10/L20 vault entries, and (2) updating the container CLAUDE.md so every agent auto-queries Cortex before starting work.

The bootstrap script should use regex-based extraction (not a full TypeScript AST parser) because the codebase follows consistent export patterns (`export function`, `export interface`, `export const`, `export class`) and the overhead of ts-morph or the TypeScript compiler API is not justified for this one-shot extraction. The script writes markdown files directly to the cortex vault, then calls `embedEntry()` from `src/cortex/embedder.ts` to immediately index them into Qdrant (bypassing the 10-minute fs.watch debounce).

The container CLAUDE.md lives at `groups/global/CLAUDE.md` and is the single file read by all agent invocations. Adding a Cortex auto-query instruction there ensures universal coverage per D-03.

**Primary recommendation:** Build `scripts/bootstrap-cortex.ts` as a standalone `npx tsx` script that extracts exports via regex, generates one .md file per source module (not per export), writes to `cortex/Areas/Projects/NanoClaw/`, and batch-embeds all generated entries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Fully automated -- script parses `src/*.ts`, extracts exports/interfaces/env vars/IPC contracts, generates entries with auto-inferred frontmatter, writes directly to vault + triggers embedding. Run once, no manual review step.
- **D-02:** NanoClaw codebase only (per research recommendation). Multi-project bootstrap is Phase 22.
- **D-03:** Agents query Cortex always before any task -- every agent invocation, not just code tasks. Instruction added to container CLAUDE.md.

### Claude's Discretion
- Exact wording of the CLAUDE.md auto-query instruction
- What keywords agents extract from the task prompt for the cortex_search call
- Bootstrap script's extraction logic (AST parsing vs regex vs heuristic)
- Entry naming convention and vault path structure for generated entries
- How to handle entries for files that already exist as vault entries (merge vs skip)

### Deferred Ideas (OUT OF SCOPE)
- Multi-project bootstrap (YourWave, ContentFactory, NightShift) -- Phase 22
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POP-01 | Bootstrap script extracts L10-L20 entries from NanoClaw codebase (~50-100 entries) | Regex extraction approach, vault path structure, entry generation strategy, embedding trigger mechanism |
| POP-03 | Container CLAUDE.md instructs agents to auto-query Cortex at task start | Global CLAUDE.md location identified, instruction wording recommendation, all affected files listed |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech Stack**: Node.js, TypeScript, discord.js, pino, better-sqlite3, zod
- **Architecture**: Channel registry pattern, IPC file-based messaging, container isolation
- **Platform**: Linux (systemd for service management)
- **GSD Workflow**: Required for non-trivial changes
- **Impact Analysis**: After every change, verify blast radius

## Standard Stack

### Core (already in project -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | ^4.0.3 | YAML frontmatter parse/stringify | Already used by embedder.ts and parser.ts |
| zod | ^4.3.6 | Frontmatter validation | CortexFieldsStrict schema already defined |
| openai | (in project) | Embedding generation | Already used by embedder.ts |
| @qdrant/js-client-rest | (in project) | Vector upsert | Already used by qdrant-client.ts |

### No Additional Libraries Needed
The bootstrap script reuses existing infrastructure:
- `src/cortex/embedder.ts` -- `embedEntry()`, `createOpenAIClient()`
- `src/cortex/qdrant-client.ts` -- `createQdrantClient()`, `checkQdrantHealth()`
- `src/cortex/schema.ts` -- `validateFrontmatter()`, `CortexFrontmatterStrict`

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Bootstrap Script Location
```
scripts/
  bootstrap-cortex.ts     # Main bootstrap script (run via npx tsx)
```

### Generated Vault Structure
```
cortex/
  Areas/
    Projects/
      NanoClaw/
        NanoClaw.md              # Hub file (L40, already exists or create)
        src/
          config.md              # L10: config.ts exports, env vars, constants
          types.md               # L10: types.ts interfaces and type definitions
          db.md                  # L10: db.ts database schema and operations
          ipc.md                 # L20: ipc.ts message types and IPC contracts
          container-runner.md    # L20: container lifecycle, volume mounts
          container-runtime.md   # L10: runtime detection, host gateway
          router.md              # L10: message routing functions
          index.md               # L20: orchestrator main loop
          channels/
            registry.md          # L10: channel registry API
            discord.md           # L10: DiscordChannel class and interface
            telegram.md          # L10: TelegramChannel class
            whatsapp.md          # L10: WhatsAppChannel class
            gmail.md             # L10: GmailChannel class
          cortex/
            schema.md            # L10: Zod schemas and validation
            embedder.md          # L20: embedding pipeline
            watcher.md           # L20: fs.watch debounce mechanism
            parser.md            # L10: frontmatter parser
            qdrant-client.md     # L10: Qdrant client helpers
          health-monitor.md      # L20: health check system
          task-scheduler.md      # L20: cron/interval task execution
          discord-server-manager.md  # L20: Discord server management
          ... (one per non-test .ts file with exports)
```

### Pattern 1: One Entry Per Source Module (not per export)
**What:** Each `src/*.ts` file with exports becomes one vault entry containing ALL exports from that file.
**When to use:** Always for bootstrap. Individual exports are too granular (250 exports would generate too many tiny files). Grouping by module produces ~40-50 entries of meaningful size.
**Why:** A module-level entry gives agents enough context to understand what a file provides. An agent searching for "how does IPC work" should find the full `ipc.md` entry with all message types, not 15 separate tiny entries.

### Pattern 2: L10 vs L20 Classification
**What:** Files that export pure data (types, constants, schemas, simple functions) are L10. Files that describe system behavior (orchestration, pipelines, watchers, schedulers) are L20.
**L10 criteria:** Exports are self-contained facts -- interfaces, type aliases, constants, pure functions, schemas.
**L20 criteria:** Exports describe behavior patterns -- how components interact, lifecycle management, state machines, integration flows.

| Category | L10 or L20 | Examples |
|----------|-----------|----------|
| Type definitions | L10 | types.ts, cortex/types.ts |
| Configuration constants | L10 | config.ts |
| Schema/validation | L10 | cortex/schema.ts, agent-message-schema.ts |
| Database schema + CRUD | L10 | db.ts |
| Utility functions | L10 | env.ts, group-folder.ts, discord-chunker.ts |
| Channel implementations | L10 | channels/discord.ts, channels/telegram.ts |
| IPC contracts + handlers | L20 | ipc.ts |
| Container lifecycle | L20 | container-runner.ts |
| Embedding pipeline | L20 | cortex/embedder.ts, cortex/watcher.ts |
| Orchestrator | L20 | index.ts |
| Task scheduling | L20 | task-scheduler.ts |
| Health monitoring | L20 | health-monitor.ts |
| Webhook handlers | L20 | github-webhook.ts, notion-webhook.ts |

### Pattern 3: Entry Frontmatter Template
```yaml
---
cortex_level: L10  # or L20
confidence: high
domain: nanoclaw
scope: "src/{filename} exports"
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - {category}  # e.g., "ipc", "channel", "config"
created: 2026-03-31
project: nanoclaw
---
```

### Pattern 4: Entry Body Structure
```markdown
# {filename}.ts

> {One-line description from JSDoc or first comment}

## Exports

### Functions
- `functionName(params): ReturnType` -- {brief description}

### Interfaces
- `InterfaceName` -- {brief description}
  - `field: Type` -- {description if non-obvious}

### Constants
- `CONSTANT_NAME: Type = value` -- {what it controls}

### Environment Variables
- `PROCESS_ENV_VAR` -- {purpose, default value}

## IPC Contracts (if applicable)
- `type: 'message_type'` -- {fields, authorization rules}

## Integration Points
- Imported by: {files that import from this module}
- Imports from: {other src/ modules this depends on}
```

### Anti-Patterns to Avoid
- **One entry per export:** Creates 250+ tiny entries that are too granular for semantic search. Group by module.
- **Duplicating full source code:** Entries should document what a module provides, not reproduce its implementation. Keep entries concise (100-300 lines each).
- **Skipping test files:** Test files should NOT generate entries -- they don't export meaningful APIs. The `.test.ts` filter is critical.
- **Hardcoding absolute paths:** Use relative paths from project root in entry bodies. Absolute paths break portability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter generation | String concatenation | gray-matter `matter.stringify()` | Handles quoting, escaping, special characters |
| Frontmatter validation | Custom checks | `validateFrontmatter()` from schema.ts | Already implements strict + permissive modes with correct defaults |
| Embedding | Custom OpenAI calls | `embedEntry()` from embedder.ts | Handles hash-check, Qdrant upsert, frontmatter update in one call |
| TypeScript parsing | ts-morph / TypeScript compiler API | Regex on export lines | 250 exports across 40 files, simple patterns, one-shot script. AST parsing adds 50MB+ dependency for no benefit. |
| Content hash | Manual hashing | Let embedder.ts handle it | `embedEntry()` computes SHA-256 of body and writes source_hash to frontmatter |

**Key insight:** The entire embedding pipeline (parse, validate, hash-check, embed, upsert, update frontmatter) is already implemented in `src/cortex/embedder.ts`. The bootstrap script's job is only to GENERATE the markdown files, then call the existing pipeline to index them.

## Extraction Strategy

### Regex Patterns for Export Extraction

Confidence: HIGH -- verified against actual codebase patterns.

```typescript
// All export patterns found in src/*.ts:
const EXPORT_FUNCTION = /^export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/;
const EXPORT_INTERFACE = /^export\s+interface\s+(\w+)/;
const EXPORT_TYPE = /^export\s+type\s+(\w+)/;
const EXPORT_CLASS = /^export\s+class\s+(\w+)/;
const EXPORT_CONST = /^export\s+const\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/;

// For env var extraction:
const PROCESS_ENV = /process\.env\.(\w+)/g;
const READ_ENV_FILE = /readEnvFile\(\[([^\]]+)\]\)/;

// For IPC contract extraction:
const IPC_TYPE = /data\.type\s*===\s*'(\w+)'/g;           // host-side handler
const CASE_TYPE = /case\s+'(\w+)'/g;                        // switch cases
```

### Extraction Pipeline per File

1. Read file content
2. Skip if filename ends with `.test.ts`
3. Extract exports using regex patterns above
4. Extract env var references (`process.env.X`, `readEnvFile(['X', 'Y'])`)
5. Extract IPC contract types (only from `ipc.ts` and `ipc-mcp-stdio.ts`)
6. Extract JSDoc comments above exports for descriptions
7. Classify as L10 or L20 based on category rules
8. Generate markdown body from extracted data
9. Write to vault using gray-matter for frontmatter

### JSDoc Extraction
```typescript
// Pattern: capture multi-line JSDoc immediately before an export
const JSDOC_BEFORE_EXPORT = /\/\*\*\s*([\s\S]*?)\*\/\s*\n\s*export/g;
```

### Entry Count Estimate

Based on actual codebase analysis:

| Category | Source Files | Entries | Level |
|----------|-------------|---------|-------|
| Core types/config | types.ts, config.ts, env.ts | 3 | L10 |
| Database | db.ts | 1 | L10 |
| Channels | discord.ts, telegram.ts, whatsapp.ts, gmail.ts, registry.ts | 5 | L10 |
| Cortex subsystem | schema.ts, types.ts, parser.ts, embedder.ts, watcher.ts, qdrant-client.ts | 6 | L10/L20 mix |
| Container/IPC | container-runner.ts, container-runtime.ts, ipc.ts | 3 | L20 |
| Orchestrator | index.ts, router.ts | 2 | L20 |
| Discord specifics | discord-embeds.ts, discord-chunker.ts, discord-group-utils.ts, discord-server-manager.ts | 4 | L10/L20 |
| Webhooks | github-webhook.ts, github-issues-webhook.ts, notion-webhook.ts, bugreport-webhook.ts | 4 | L20 |
| Scheduling/Health | task-scheduler.ts, health-monitor.ts, health-monitor-embeds.ts | 3 | L20 |
| Agent/Status | agent-message-schema.ts, agent-status-embeds.ts, bot-status-panel.ts | 3 | L10/L20 |
| Security | mount-security.ts, sender-allowlist.ts, credential-proxy.ts | 3 | L10 |
| Utilities | group-folder.ts, group-queue.ts, image.ts, logger.ts, progress-tracker.ts, timezone.ts, transcription.ts | 7 | L10 |
| Other | remote-control.ts, tunnel-manager.ts, swarm-webhook-manager.ts, webhook-router.ts, webhook-server.ts, whatsapp-auth.ts | 6 | L10/L20 |
| **Cross-cutting: IPC contracts** | (extracted from ipc.ts) | 1 | L20 |
| **Cross-cutting: env vars** | (extracted from config.ts + others) | 1 | L10 |
| **Hub file** | NanoClaw.md | 1 | L40 |
| **TOTAL** | | **~53** | |

Breakdown: ~30 L10 entries, ~22 L20 entries, 1 L40 hub entry. Total: **~53 entries**. This is within the 50-100 target range. Could expand to ~70 by splitting larger modules (e.g., db.ts has 32 exports -- could split into db-schema.md + db-operations.md).

### Special Entries (not per-file)

Two cross-cutting entries aggregate information spread across multiple files:

1. **`env-vars.md`** (L10): All environment variables used across the codebase, extracted from `process.env.*` and `readEnvFile()` calls. ~25 env vars found.

2. **`ipc-contracts.md`** (L20): All IPC message types and task types, their fields, and authorization rules. Extracted from `ipc.ts` handler and `ipc-mcp-stdio.ts` tool definitions.
   - Message types: `message`, `cortex_write`, `restart`, `agent_status`, `agent_blocker`, `agent_handoff`
   - Task types: `schedule_task`, `pause_task`, `resume_task`, `cancel_task`, `update_task`, `refresh_groups`, `register_group`, `discord_manage`

## Embedding Trigger Strategy

### Decision: Direct `embedEntry()` call, NOT fs.watch

**Rationale:** The fs.watch debounce in `watcher.ts` has a 10-minute delay (DEBOUNCE_MS = 600000). For a bootstrap of ~53 files, waiting 10 minutes after the last write is unacceptable for a one-shot script. Additionally, the watcher may not even be running when the script executes (it requires `startCortexWatcher()` from `index.ts`).

**Approach:**
1. Script writes all .md files to vault
2. Script imports `embedEntry`, `createOpenAIClient`, `createQdrantClient` from `src/cortex/`
3. Script calls `embedEntry(filePath, openai, qdrant)` for each generated file
4. Batch processing: sequential (not parallel) to avoid OpenAI rate limits
5. Report: print summary of embedded/skipped/error counts

**Import path:** Since the script lives in `scripts/` and imports from `src/cortex/`, it must be run with `npx tsx` which handles TypeScript imports natively. The existing `src/cortex/embedder.ts` uses `.js` extension imports which tsx resolves correctly.

```typescript
// scripts/bootstrap-cortex.ts
import { embedEntry, createOpenAIClient } from '../src/cortex/embedder.js';
import { createQdrantClient, checkQdrantHealth } from '../src/cortex/qdrant-client.js';
```

### Prerequisites
- Qdrant must be running at localhost:6333
- OPENAI_API_KEY must be set in .env
- Run `npm run build` is NOT required (tsx handles TypeScript)

### Cost Estimate
- ~53 entries, average ~200 tokens each = ~10,600 tokens
- text-embedding-3-small: $0.02/1M tokens
- Total: ~$0.0002 (negligible)

## CLAUDE.md Auto-Query Instruction

### Files to Update

Only ONE file needs updating:

| File | Purpose | Action |
|------|---------|--------|
| `groups/global/CLAUDE.md` | Global instructions for all agents | Add Cortex auto-query section |

**Why only global/CLAUDE.md:** The container runner copies this to `/workspace/global/CLAUDE.md` (read-only mount) for all non-main groups. The main group gets it via the project mount. Claude Code's `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` setting (already enabled in settings.json) ensures it loads CLAUDE.md from mounted directories.

Group-specific CLAUDE.md files (`groups/dc-main/CLAUDE.md`, `groups/dc-nightshift/CLAUDE.md`, etc.) should NOT be modified -- they contain group-specific context, not universal instructions.

### Recommended Instruction Wording

```markdown
## Cortex Knowledge Base

Before starting any task, search the Cortex knowledge base for relevant context:

1. Extract 2-3 key concepts from the task (e.g., "IPC", "container", "Discord channel")
2. Call `cortex_search` with a natural language query combining those concepts
3. If results are relevant (score > 0.7), call `cortex_read` on the top result paths
4. Use the retrieved knowledge to inform your approach

Example:
- Task: "Fix the IPC message handler for cortex_write"
- Query: `cortex_search("IPC cortex_write message handler")`
- This returns entries about IPC contracts and the cortex write pipeline

Skip the search only if the task is purely conversational with no technical component.
```

**Key design decisions in the wording:**
- "2-3 key concepts" -- prevents agents from searching with the entire prompt (poor semantic match)
- "score > 0.7" -- gives agents a threshold to avoid reading irrelevant results
- "Skip if purely conversational" -- avoids unnecessary API calls for casual chat
- Uses concrete example -- models show better instruction following with examples

## Entry Naming Convention

### File Naming
- **Pattern:** `{source-filename-without-extension}.md`
- **Examples:** `config.md`, `types.md`, `container-runner.md`
- **Subdirectories:** Mirror source structure -- `channels/discord.md`, `cortex/schema.md`
- **Cross-cutting entries:** `env-vars.md`, `ipc-contracts.md`
- **Hub file:** `NanoClaw.md`

### Deterministic IDs
The `deterministicId()` function in `embedder.ts` already produces a stable UUID from the relative vault path. Example:
- `cortex/Areas/Projects/NanoClaw/src/config.md` always produces the same UUID
- Re-running bootstrap overwrites the same file, and `embedEntry()` skips if content hash matches

### Merge vs Skip Strategy for Existing Entries
- **No existing NanoClaw entries in vault** (verified: `cortex/Areas/Projects/NanoClaw/` does not exist)
- **Strategy:** Always overwrite. Bootstrap is idempotent -- re-running produces the same output.
- **If entries are later manually edited:** The source_hash check in `embedEntry()` will detect the content change and re-embed. Manual edits are preserved because the bootstrap writes complete files (not patches).
- **For Phase 22 (multi-project):** Same overwrite strategy applies.

## Common Pitfalls

### Pitfall 1: Embedding Self-Trigger Loop
**What goes wrong:** Bootstrap writes a file, watcher detects the change, watcher calls embedEntry, embedEntry updates frontmatter, watcher detects THAT change -- infinite loop.
**Why it happens:** `watcher.ts` watches all .md file changes in cortex/.
**How to avoid:** Bootstrap calls `embedEntry()` directly (NOT via watcher). The `inFlightFiles` set in watcher.ts prevents the re-trigger for files currently being embedded. Since bootstrap runs as a separate process, use a different approach: either (a) stop the watcher before running bootstrap, or (b) accept that the watcher will detect changes but the source_hash check will skip re-embedding (the files were already embedded by the bootstrap). Option (b) is simpler and correct.
**Warning signs:** Duplicate embedding logs after bootstrap completes.

### Pitfall 2: Gray-matter Reformatting
**What goes wrong:** `matter.stringify()` may reformat existing YAML -- changing key order, quoting style, etc.
**Why it happens:** gray-matter normalizes YAML output.
**How to avoid:** Not a problem for bootstrap-generated entries (we control the entire file). Only matters if editing existing entries. Bootstrap creates new files only.

### Pitfall 3: Regex Missing Complex Exports
**What goes wrong:** Regex misses re-exports (`export { X } from './y'`), default exports, or multi-line export signatures.
**Why it happens:** Simple line-by-line regex can't handle all TypeScript syntax.
**How to avoid:** Audit the codebase for export patterns. Verified: NanoClaw uses only `export function/const/interface/type/class` patterns. No default exports. A few re-exports in `channels/index.ts` (just re-exports from sub-modules -- skip these, the sub-module entries cover them).
**Warning signs:** Entry count significantly below 50.

### Pitfall 4: OpenAI Rate Limits on Batch Embedding
**What goes wrong:** Embedding 53 files in rapid succession triggers rate limits.
**Why it happens:** OpenAI embedding API has per-minute rate limits.
**How to avoid:** Process sequentially with no explicit delay -- text-embedding-3-small has generous rate limits (3500 RPM for most tiers). 53 requests is well within limits. If errors occur, add a 200ms delay between calls.
**Warning signs:** 429 errors in embedding results.

### Pitfall 5: CLAUDE.md Instruction Too Long
**What goes wrong:** Adding verbose Cortex instructions to global/CLAUDE.md bloats the context window for every agent invocation.
**Why it happens:** CLAUDE.md is always loaded.
**How to avoid:** Keep the instruction to ~10 lines. The example above is ~12 lines including the code block.
**Warning signs:** Agents complaining about context length.

### Pitfall 6: Container Cannot Import Host src/ Modules
**What goes wrong:** If the CLAUDE.md instruction references `cortex_search` tool, agents must use the MCP tool name, not import functions.
**Why it happens:** Container agents run inside Docker with MCP tools, not direct imports.
**How to avoid:** The instruction correctly references `cortex_search` (the MCP tool name), not any import path.

## Code Examples

### Bootstrap Script Core Structure
```typescript
// scripts/bootstrap-cortex.ts
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { embedEntry, createOpenAIClient } from '../src/cortex/embedder.js';
import { createQdrantClient, checkQdrantHealth } from '../src/cortex/qdrant-client.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const VAULT_DIR = path.join(PROJECT_ROOT, 'cortex', 'Areas', 'Projects', 'NanoClaw', 'src');

interface ExtractedExport {
  kind: 'function' | 'interface' | 'type' | 'class' | 'const';
  name: string;
  signature?: string;
  jsdoc?: string;
}

function extractExports(content: string): ExtractedExport[] {
  const lines = content.split('\n');
  const exports: ExtractedExport[] = [];
  // ... regex extraction per line
  return exports;
}

function classifyLevel(filePath: string): 'L10' | 'L20' {
  const behavioral = ['ipc.ts', 'index.ts', 'container-runner.ts', 'task-scheduler.ts',
    'health-monitor.ts', 'watcher.ts', 'embedder.ts'];
  const basename = path.basename(filePath);
  if (behavioral.includes(basename)) return 'L20';
  if (basename.includes('webhook')) return 'L20';
  return 'L10';
}

function generateEntry(filePath: string, exports: ExtractedExport[], level: 'L10' | 'L20'): string {
  const frontmatter = {
    cortex_level: level,
    confidence: 'high' as const,
    domain: 'nanoclaw',
    scope: `src/${path.relative(SRC_DIR, filePath)} exports`,
    type: 'bootstrap-extract',
    tags: ['nanoclaw', 'bootstrap'],
    created: '2026-03-31',
    project: 'nanoclaw',
  };
  const body = buildMarkdownBody(filePath, exports);
  return matter.stringify(body, frontmatter);
}

async function main() {
  const openai = createOpenAIClient();
  const qdrant = createQdrantClient();
  if (!await checkQdrantHealth(qdrant)) {
    console.error('Qdrant not reachable');
    process.exit(1);
  }

  // Walk src/*.ts (non-test files)
  const files = walkSourceFiles(SRC_DIR);
  let embedded = 0, skipped = 0, errors = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const exports = extractExports(content);
    if (exports.length === 0) continue;

    const level = classifyLevel(file);
    const entry = generateEntry(file, exports, level);
    const vaultPath = computeVaultPath(file);

    fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
    fs.writeFileSync(vaultPath, entry, 'utf-8');

    const result = await embedEntry(vaultPath, openai, qdrant, { force: true });
    if (result.status === 'embedded') embedded++;
    else if (result.status === 'skipped') skipped++;
    else errors++;
  }

  console.log(`Bootstrap complete: ${embedded} embedded, ${skipped} skipped, ${errors} errors`);
}

main();
```

### Global CLAUDE.md Addition
```markdown
## Cortex Knowledge Base

Before starting any task, search the Cortex knowledge base for relevant context:

1. Extract 2-3 key concepts from the task (e.g., "IPC", "container", "Discord channel")
2. Call `cortex_search` with a natural language query combining those concepts
3. If results are relevant (score > 0.7), call `cortex_read` on the top result paths
4. Use the retrieved knowledge to inform your approach

Example:
- Task: "Fix the IPC message handler for cortex_write"
- Query: `cortex_search("IPC cortex_write message handler")`
- This returns entries about IPC contracts and the cortex write pipeline

Skip the search only if the task is purely conversational with no technical component.
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (in project) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/cortex/` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POP-01 | Bootstrap extracts 50-100 L10/L20 entries | integration | `npx tsx scripts/bootstrap-cortex.ts --dry-run` (prints count) | Wave 0 |
| POP-01 | Generated entries have valid frontmatter | unit | `npx vitest run src/cortex/schema.test.ts -x` | Exists |
| POP-03 | CLAUDE.md contains Cortex auto-query instruction | smoke | `grep "cortex_search" groups/global/CLAUDE.md` | Wave 0 |
| E2E | Agent calls cortex_search and gets bootstrapped entry | manual | Run test agent in container, verify search returns results | Manual |

### Sampling Rate
- **Per task commit:** `npx vitest run src/cortex/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual E2E smoke test

### Wave 0 Gaps
- [ ] `scripts/bootstrap-cortex.ts` -- the bootstrap script itself (core deliverable)
- [ ] Dry-run mode for bootstrap (outputs entry count without writing/embedding)
- [ ] E2E test: spin up container, verify `cortex_search` returns bootstrapped entry

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Script execution | Assumed (project runs) | -- | -- |
| npx tsx | TypeScript execution | Assumed (used by project) | -- | `npm run build` + node |
| Qdrant | Vector embedding | Must be running at localhost:6333 | -- | Script exits with error |
| OPENAI_API_KEY | Embedding generation | In .env | -- | Script exits with error |

**Missing dependencies with no fallback:**
- Qdrant must be running (bootstrap cannot proceed without it)
- OPENAI_API_KEY must be set (embedding requires it)

## Open Questions

1. **Should the hub file NanoClaw.md be auto-generated or manually created?**
   - What we know: No existing NanoClaw directory in cortex/Areas/Projects/
   - What's unclear: Whether a meaningful L40 project summary can be auto-generated
   - Recommendation: Auto-generate a basic hub file listing all bootstrapped entries. Can be manually enhanced later.

2. **Should bootstrap extract from `container/agent-runner/src/` too?**
   - What we know: `ipc-mcp-stdio.ts` contains MCP tool definitions and inlined cortex schemas
   - What's unclear: Whether container-side code should be part of NanoClaw bootstrap
   - Recommendation: Include `ipc-mcp-stdio.ts` as a single entry documenting all MCP tools available to agents. This is valuable context for agents.

3. **Exact score threshold for "relevant" results**
   - What we know: Qdrant returns cosine similarity scores 0-1
   - What's unclear: What threshold produces good results for NanoClaw-specific queries
   - Recommendation: Start with 0.7, adjust based on E2E testing. The threshold is in the CLAUDE.md instruction text, easy to update.

## Sources

### Primary (HIGH confidence)
- `src/cortex/embedder.ts` -- embedding pipeline, `embedEntry()` function signature and behavior
- `src/cortex/watcher.ts` -- fs.watch debounce (DEBOUNCE_MS = 600000), inFlightFiles loop prevention
- `src/cortex/schema.ts` -- Zod schemas, `validateFrontmatter()`, `inferDefaults()`
- `src/cortex/parser.ts` -- `parseCortexEntry()` for gray-matter parsing
- `src/ipc.ts` -- all IPC message types and task types
- `container/agent-runner/src/ipc-mcp-stdio.ts` -- cortex_search/read/write MCP tool signatures
- `src/container-runner.ts` -- volume mounts including cortex read-only mount, CLAUDE.md sync logic
- `groups/global/CLAUDE.md` -- current global agent instructions

### Secondary (MEDIUM confidence)
- Export count analysis via grep (250 total exports, 61 interfaces/types/classes, 137 functions, 50 constants)
- Directory structure analysis of cortex/Areas/Projects/

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all imports verified in codebase
- Architecture: HIGH -- vault structure, extraction strategy, embedding trigger all verified against existing code
- Pitfalls: HIGH -- all pitfalls derived from reading actual implementation (watcher debounce, inFlightFiles, gray-matter behavior)
- Entry count estimate: MEDIUM -- based on grep analysis, actual extraction may vary +/- 10

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no external dependencies likely to change)
