---
wave: 1
plan_id: "18-02"
phase: 18
title: "Create bootstrap-cortex.ts script for NanoClaw L10/L20 entry generation"
objective: "Build scripts/bootstrap-cortex.ts that extracts exports from all src/*.ts files, generates one Cortex vault entry per module, and embeds them into Qdrant via embedEntry() (POP-01, D-01, D-02)"
depends_on: []
files_modified:
  - "scripts/bootstrap-cortex.ts"
  - "cortex/Areas/Projects/NanoClaw/NanoClaw.md"
  - "cortex/Areas/Projects/NanoClaw/src/*.md"
  - "cortex/Areas/Projects/NanoClaw/src/channels/*.md"
  - "cortex/Areas/Projects/NanoClaw/src/cortex/*.md"
requirements_addressed: ["POP-01"]
autonomous: true
must_haves:
  - "scripts/bootstrap-cortex.ts exists and is executable via npx tsx"
  - "Script generates 50-100 .md entries under cortex/Areas/Projects/NanoClaw/"
  - "Each entry has valid YAML frontmatter with cortex_level, confidence, domain, scope fields"
  - "Script calls embedEntry() directly for immediate Qdrant indexing (not relying on watcher)"
  - "Script has --dry-run flag that prints count without writing or embedding"
  - "Script checks Qdrant health and OPENAI_API_KEY before proceeding"
  - "Test files (.test.ts) and re-export-only files (channels/index.ts) are skipped"
  - "A hub file NanoClaw.md (L40) is generated listing all bootstrapped entries"
  - "Cross-cutting entries env-vars.md and ipc-contracts.md are generated"
---

<objective>
Create the bootstrap script that parses NanoClaw's `src/*.ts` files via regex, generates L10/L20 Cortex vault entries (one per source module), writes them to `cortex/Areas/Projects/NanoClaw/`, and embeds them into Qdrant by calling `embedEntry()` directly.

Purpose: Populates the Cortex knowledge base with NanoClaw codebase knowledge so agents can search for relevant context when working on NanoClaw tasks.
Output: `scripts/bootstrap-cortex.ts` + ~53 generated vault entries + all entries embedded in Qdrant.
</objective>

<context>
@.planning/phases/18-knowledge-bootstrap/18-RESEARCH.md (full research: extraction patterns, vault structure, entry template, L10/L20 classification)
@.planning/phases/18-knowledge-bootstrap/18-CONTEXT.md (D-01: fully automated, D-02: NanoClaw only)
@src/cortex/embedder.ts (embedEntry signature, createOpenAIClient)
@src/cortex/qdrant-client.ts (createQdrantClient, checkQdrantHealth)
@src/cortex/schema.ts (CortexFrontmatterStrict, validateFrontmatter)
@src/cortex/parser.ts (parseCortexEntry)

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/cortex/embedder.ts:
```typescript
export interface EmbedResult {
  status: 'embedded' | 'skipped' | 'error';
  filePath: string;
  reason?: string;
}
export function createOpenAIClient(): OpenAI;
export async function embedEntry(
  filePath: string,
  openai: OpenAI,
  qdrant: QdrantClient,
  options?: { force?: boolean },
): Promise<EmbedResult>;
```

From src/cortex/qdrant-client.ts:
```typescript
export const COLLECTION_NAME = 'cortex-entries';
export function createQdrantClient(): QdrantClient;
export async function checkQdrantHealth(client: QdrantClient): Promise<boolean>;
```

From src/cortex/schema.ts:
```typescript
export const CortexFieldsStrict = z.object({
  cortex_level: z.enum(['L10', 'L20', 'L30', 'L40', 'L50']),
  confidence: z.enum(['low', 'medium', 'high']),
  domain: z.string().min(1),
  scope: z.string().min(1),
});
```
</interfaces>
</context>

<tasks>

<task id="T01" title="Create scripts/bootstrap-cortex.ts with full extraction and embedding pipeline">
<read_first>
- src/cortex/embedder.ts -- embedEntry() signature (line 137), createOpenAIClient() (line 54), EmbedResult type (line 38)
- src/cortex/qdrant-client.ts -- createQdrantClient() (line 23), checkQdrantHealth() (line 33)
- src/cortex/parser.ts -- parseCortexEntry() signature (line 22), understand gray-matter usage
- src/cortex/schema.ts -- CortexFieldsStrict (line 31), understand required frontmatter fields
- src/config.ts -- example of a source file to understand export patterns
- src/types.ts -- example of interface-heavy source file
- src/ipc.ts -- example of IPC handler file with data.type patterns
- src/env.ts -- readEnvFile function (used by embedder, bootstrap needs same import)
</read_first>
<action>
Create `scripts/bootstrap-cortex.ts` with the following structure. Run via `npx tsx scripts/bootstrap-cortex.ts` (or with `--dry-run`).

**Imports:**
```typescript
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { embedEntry, createOpenAIClient } from '../src/cortex/embedder.js';
import { createQdrantClient, checkQdrantHealth } from '../src/cortex/qdrant-client.js';
```

**Constants:**
```typescript
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const VAULT_BASE = path.join(PROJECT_ROOT, 'cortex', 'Areas', 'Projects', 'NanoClaw');
const VAULT_SRC = path.join(VAULT_BASE, 'src');
const DRY_RUN = process.argv.includes('--dry-run');
```

**Regex patterns (verified against actual codebase):**
```typescript
const EXPORT_FUNCTION = /^export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/;
const EXPORT_INTERFACE = /^export\s+interface\s+(\w+)/;
const EXPORT_TYPE = /^export\s+type\s+(\w+)/;
const EXPORT_CLASS = /^export\s+class\s+(\w+)/;
const EXPORT_CONST = /^export\s+const\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/;
const PROCESS_ENV = /process\.env\.(\w+)/g;
const JSDOC_BLOCK = /\/\*\*\s*([\s\S]*?)\*\//g;
```

**ExtractedExport interface:**
```typescript
interface ExtractedExport {
  kind: 'function' | 'interface' | 'type' | 'class' | 'const';
  name: string;
  signature?: string;
  jsdoc?: string;
}
```

**Core functions to implement:**

1. `walkSourceFiles(dir: string): string[]` -- recursively find all `.ts` files under `dir`, excluding:
   - Files ending with `.test.ts`
   - `channels/index.ts` (re-exports only)
   Sort results alphabetically for deterministic output.

2. `extractExports(content: string): ExtractedExport[]` -- line-by-line regex matching:
   - For each export line, capture the JSDoc comment immediately above it (scan backwards from the line)
   - For functions, capture `name(params): ReturnType` as signature (may need multi-line handling for long signatures -- take up to the closing paren)
   - For interfaces/types/classes, capture just the name
   - For consts, capture `name: Type = value` (just the type, not full value)

3. `extractEnvVars(content: string): string[]` -- find all `process.env.VARNAME` references, deduplicated.

4. `classifyLevel(relPath: string): 'L10' | 'L20'` -- use the classification table from research:
   - L20 files: `ipc.ts`, `index.ts`, `container-runner.ts`, `task-scheduler.ts`, `health-monitor.ts`, `watcher.ts`, `embedder.ts`, any file containing `webhook` in the name
   - L10: everything else

5. `generateEntryBody(relPath: string, exports: ExtractedExport[], envVars: string[]): string` -- generate markdown body:
   ```
   # {filename}.ts

   > {first JSDoc line from file-level comment, or "Exports from {filename}.ts"}

   ## Exports

   ### Functions
   - `functionName(params)` -- {jsdoc first line or ""}

   ### Interfaces
   - `InterfaceName` -- {jsdoc first line or ""}

   ### Types
   - `TypeName` -- {jsdoc first line or ""}

   ### Constants
   - `CONST_NAME` -- {jsdoc first line or ""}

   ### Classes
   - `ClassName` -- {jsdoc first line or ""}

   ## Environment Variables (if any)
   - `VAR_NAME` -- referenced in this module
   ```
   Omit empty subsections (e.g., if no interfaces, skip that heading).

6. `generateFrontmatter(relPath: string, level: 'L10' | 'L20'): Record<string, unknown>` -- produce:
   ```yaml
   cortex_level: L10  # or L20
   confidence: high
   domain: nanoclaw
   scope: "src/{relPath} exports"
   type: bootstrap-extract
   tags: [nanoclaw, bootstrap, {category}]
   created: "2026-03-31"
   project: nanoclaw
   ```
   Where `{category}` is inferred: "channel" for channels/*, "cortex" for cortex/*, "webhook" for *webhook*, "ipc" for ipc.ts, etc.

7. `computeVaultPath(srcFile: string): string` -- maps `src/foo/bar.ts` to `cortex/Areas/Projects/NanoClaw/src/foo/bar.md`.

8. `generateCrossCuttingEntries(): Array<{vaultPath: string, content: string}>` -- two special entries:
   - **env-vars.md** (L10): Scan ALL source files for `process.env.*` references. Aggregate into one entry listing every env var and which file(s) reference it. Place at `cortex/Areas/Projects/NanoClaw/src/env-vars.md`.
   - **ipc-contracts.md** (L20): Extract IPC message types from `src/ipc.ts` (scan for `data.type === '...'` and `case '...'` patterns). Also extract MCP tool names from `container/agent-runner/src/ipc-mcp-stdio.ts` (scan for `server.tool('...'` patterns). Place at `cortex/Areas/Projects/NanoClaw/src/ipc-contracts.md`.

9. `generateHubFile(entries: string[]): string` -- create `cortex/Areas/Projects/NanoClaw/NanoClaw.md` (L40) with frontmatter and a listing of all generated entries:
   ```markdown
   # NanoClaw

   > Personal Claude assistant -- single Node.js process with skill-based channel system.

   ## Bootstrapped Knowledge Entries

   | Entry | Level | Scope |
   |-------|-------|-------|
   | [config.md](src/config.md) | L10 | src/config.ts exports |
   | ... | ... | ... |
   ```

10. `main()` -- orchestrates:
    a. Parse `--dry-run` flag
    b. If not dry-run: create OpenAI client, create Qdrant client, check Qdrant health (exit 1 if unhealthy)
    c. Walk source files, extract exports, skip files with zero exports
    d. Generate cross-cutting entries (env-vars.md, ipc-contracts.md)
    e. Generate per-module entries
    f. Generate hub file
    g. If dry-run: print count and list of entries, exit 0
    h. Write all entries to vault (mkdir -p for directories)
    i. Call `embedEntry(vaultPath, openai, qdrant, { force: true })` sequentially for each entry
    j. Print summary: `Bootstrap complete: {N} embedded, {N} skipped, {N} errors`
    k. Exit 0 on success, exit 1 if any errors

**Critical details:**
- Use `matter.stringify(body, frontmatter)` to write entries (not string concatenation) -- per research "Don't Hand-Roll"
- Pass `{ force: true }` to `embedEntry()` since these are new files and we want to ensure they get embedded even if a previous run left stale hashes
- Process files sequentially (not Promise.all) to avoid OpenAI rate limits per Pitfall 4
- The `import.meta.dirname` resolves to the scripts/ directory, so `..` reaches project root
- Import paths use `.js` extension (TypeScript ESM convention used by the project)
</action>
<acceptance_criteria>
- `test -f scripts/bootstrap-cortex.ts && echo "exists"` prints "exists"
- `grep -c "import.*embedEntry" scripts/bootstrap-cortex.ts` returns `1`
- `grep -c "import.*createOpenAIClient" scripts/bootstrap-cortex.ts` returns `1`
- `grep -c "import.*createQdrantClient" scripts/bootstrap-cortex.ts` returns `1`
- `grep -c "import.*checkQdrantHealth" scripts/bootstrap-cortex.ts` returns `1`
- `grep -c "import.*gray-matter" scripts/bootstrap-cortex.ts` returns `1` (or `import matter`)
- `grep -c "\-\-dry-run" scripts/bootstrap-cortex.ts` returns at least `1`
- `grep -c "EXPORT_FUNCTION\|EXPORT_INTERFACE\|EXPORT_TYPE\|EXPORT_CLASS\|EXPORT_CONST" scripts/bootstrap-cortex.ts` returns `5`
- `grep -c "process\.env\." scripts/bootstrap-cortex.ts | head -1` -- script references PROCESS_ENV regex pattern
- `grep -c "env-vars\.md\|ipc-contracts\.md" scripts/bootstrap-cortex.ts` returns at least `2` (both cross-cutting entries)
- `grep -c "NanoClaw\.md" scripts/bootstrap-cortex.ts` returns at least `1` (hub file)
- `grep -c "\.test\.ts" scripts/bootstrap-cortex.ts` returns at least `1` (skip filter)
- `grep -c "channels/index" scripts/bootstrap-cortex.ts` returns at least `1` (skip filter)
- `grep -c "force.*true\|force: true" scripts/bootstrap-cortex.ts` returns at least `1` (force embed)
- `grep -c "matter\.stringify" scripts/bootstrap-cortex.ts` returns at least `1`
- `grep "cortex_level" scripts/bootstrap-cortex.ts | head -1` -- confirms frontmatter generation
- `npx tsx scripts/bootstrap-cortex.ts --dry-run` exits 0 and prints entry count >= 50 (run this to validate extraction logic works without needing Qdrant/OpenAI)
</acceptance_criteria>
</task>

<task id="T02" title="Run bootstrap script and verify generated entries">
<read_first>
- scripts/bootstrap-cortex.ts -- the script just created in T01
- src/cortex/embedder.ts -- understand EmbedResult to interpret output
</read_first>
<action>
1. First, run the dry-run to validate extraction logic:
   ```bash
   npx tsx scripts/bootstrap-cortex.ts --dry-run
   ```
   Verify output shows >= 50 entries. If count is below 50, debug extraction patterns.

2. If dry-run shows correct count, run the actual bootstrap (requires Qdrant running + OPENAI_API_KEY in .env):
   ```bash
   npx tsx scripts/bootstrap-cortex.ts
   ```

3. Verify generated files:
   - Count files: `find cortex/Areas/Projects/NanoClaw -name '*.md' | wc -l` should be >= 50
   - Check hub file exists: `cat cortex/Areas/Projects/NanoClaw/NanoClaw.md | head -20`
   - Check a sample entry has valid frontmatter: `head -15 cortex/Areas/Projects/NanoClaw/src/config.md`
   - Check cross-cutting entries exist: `ls cortex/Areas/Projects/NanoClaw/src/env-vars.md cortex/Areas/Projects/NanoClaw/src/ipc-contracts.md`

4. Validate frontmatter on a sample of generated entries by checking that `cortex_level`, `confidence`, `domain`, `scope` are present:
   ```bash
   for f in cortex/Areas/Projects/NanoClaw/src/config.md cortex/Areas/Projects/NanoClaw/src/types.md cortex/Areas/Projects/NanoClaw/src/ipc-contracts.md; do
     echo "=== $f ==="
     grep -c "cortex_level:" "$f"
     grep -c "confidence:" "$f"
     grep -c "domain:" "$f"
     grep -c "scope:" "$f"
   done
   ```
   Each grep should return 1.

5. If the full bootstrap run succeeded, verify Qdrant has the entries:
   ```bash
   curl -s http://localhost:6333/collections/cortex-entries | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Points: {d[\"result\"][\"points_count\"]}')"
   ```
   Points count should have increased by approximately 50-55.

**If Qdrant is not running or OPENAI_API_KEY is not set:** The dry-run validation (step 1) is sufficient to verify the script logic. The actual embedding (step 2) can be run later when infrastructure is available. Document this in the summary.
</action>
<acceptance_criteria>
- `npx tsx scripts/bootstrap-cortex.ts --dry-run` exits 0 and output contains a number >= 50
- `find cortex/Areas/Projects/NanoClaw -name '*.md' | wc -l` returns >= 50 (after full run) OR dry-run count >= 50 (if Qdrant unavailable)
- `test -f cortex/Areas/Projects/NanoClaw/NanoClaw.md && echo "exists"` prints "exists" (after full run)
- `test -f cortex/Areas/Projects/NanoClaw/src/env-vars.md && echo "exists"` prints "exists" (after full run)
- `test -f cortex/Areas/Projects/NanoClaw/src/ipc-contracts.md && echo "exists"` prints "exists" (after full run)
- `grep -c "cortex_level:" cortex/Areas/Projects/NanoClaw/src/config.md` returns `1` (after full run)
- `grep -c "source_hash:" cortex/Areas/Projects/NanoClaw/src/config.md` returns `1` (after full run, proves embedding ran)
</acceptance_criteria>
</task>

</tasks>

<verification>
```bash
# Dry-run validation (always works, no dependencies)
npx tsx scripts/bootstrap-cortex.ts --dry-run

# Post-run validation (after full bootstrap with Qdrant + OpenAI)
find cortex/Areas/Projects/NanoClaw -name '*.md' | wc -l
grep "cortex_level:" cortex/Areas/Projects/NanoClaw/src/config.md
grep "source_hash:" cortex/Areas/Projects/NanoClaw/src/config.md
```
</verification>

<success_criteria>
- scripts/bootstrap-cortex.ts exists and runs without errors
- Dry-run reports 50+ entries to be generated
- Generated entries have valid YAML frontmatter (cortex_level, confidence, domain, scope)
- Hub file NanoClaw.md and cross-cutting entries (env-vars.md, ipc-contracts.md) are generated
- After full run: all entries are embedded in Qdrant (source_hash present in frontmatter)
</success_criteria>

<output>
After completion, create `.planning/phases/18-knowledge-bootstrap/18-02-SUMMARY.md`
</output>
