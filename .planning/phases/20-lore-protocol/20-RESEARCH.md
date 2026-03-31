# Phase 20: Lore Protocol - Research

**Researched:** 2026-03-31
**Domain:** Git commit trailer convention, native git parsing, Cortex indexing
**Confidence:** HIGH

## Summary

Phase 20 creates a convention for capturing architectural decisions in git commit trailers (Constraint/Rejected/Directive atoms), a parser that extracts these from git history, and a pipeline that writes them as Cortex vault entries of type `lore-atom` for embedding and search. The phase also includes a one-time Night Shift mining task that heuristically extracts implicit decisions from ~936 existing commits.

The implementation is straightforward: git v2.43.0 on this system supports `%(trailers)` format in `git log`, and the existing Cortex infrastructure (schema validation, embedding pipeline, Qdrant indexing) handles the downstream indexing. The main design decisions are trailer key naming, vault file structure for lore atoms, and the mining heuristic for existing commits.

**Primary recommendation:** Use `Constraint:`, `Rejected:`, `Directive:` as trailer keys (capitalized, standard git trailer format). Parse with `child_process.execSync('git log --format=...')`. Write lore atoms as markdown files in `cortex/Lore/` with standard Cortex frontmatter. Reuse `embedEntry()` directly for indexing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Forward-only convention -- agents write lore trailers in new commits starting immediately after this phase ships. No retroactive rewriting of existing commits.
- **D-02:** One-time Night Shift mining task -- Alfred runs a scheduled one-off to heuristically parse existing commit messages (~200+ commits) for implicit decisions (constraints, rejections, directives). Results indexed as lore-atom entries with lower confidence.
- **D-03:** No CLI dependency -- native git parsing using `git log --format='%(trailers)'` (per research recommendation, ~10 lines of code).

### Claude's Discretion
- Exact trailer key format (e.g., `Constraint:` vs `Lore-Constraint:` vs `lore:constraint`)
- Git parsing implementation details
- How mined entries differ from explicit trailer entries (confidence level, metadata)
- CLAUDE.md instruction wording for agent trailer adoption
- Whether to add a `lore_source` field (commit hash + trailer key) to entry frontmatter
- Night Shift mining task prompt design and heuristic patterns

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LORE-01 | Lore Protocol convention defined -- git trailer format (Constraint/Rejected/Directive atoms) | Trailer key format, CLAUDE.md documentation examples, good/bad examples |
| LORE-02 | Native git parsing extracts lore atoms from commit trailers (~10 lines, no CLI dependency) | `child_process.execSync` + `%(trailers)` format verified on git 2.43.0 |
| LORE-03 | Lore atoms indexed into Cortex entries and searchable via cortex_search | Vault file structure, frontmatter schema, embedEntry() reuse, type: lore-atom |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Must use TypeScript, follow existing NanoClaw patterns
- Service management via systemd on Linux
- GSD workflow enforcement -- no direct repo edits outside GSD
- Run commands directly, don't tell user to run them
- API keys live in `~/nanoclaw/.env`
- Follow existing cortex module patterns (DI, pino logger, Zod validation)

## Standard Stack

### Core (already in project -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:child_process | built-in | Execute `git log` for trailer extraction | Native Node.js, no dependency needed |
| gray-matter | ^4.0.3 | Write frontmatter to lore-atom vault files | Already used by embedder, parser |
| zod | ^4.3.6 | Validate lore-atom frontmatter | Already used by schema.ts |
| vitest | ^4.0.18 | Unit tests | Already in project |

### No Additional Libraries Needed

The entire phase uses existing project dependencies plus Node.js built-ins. Git trailer parsing is string manipulation on `git log` output. Vault file writing reuses gray-matter. Embedding reuses `embedEntry()`.

## Architecture Patterns

### Recommended Project Structure

```
src/cortex/
  lore-parser.ts          # Git trailer extraction (LORE-02)
  lore-parser.test.ts     # Unit tests for parser
cortex/
  Lore/                   # Vault directory for lore-atom entries
    {commit-hash-short}-{atom-type}.md   # e.g., a215dbb-constraint.md
```

### Pattern 1: Git Trailer Convention (LORE-01)

**What:** Three trailer keys added to commit messages to capture architectural atoms.

**Trailer key format recommendation: Standard capitalized keys**

```
Constraint: Use DI for all Qdrant/OpenAI clients to enable unit testing
Rejected: Chokidar for fs.watch -- native node:fs watch is sufficient for single-directory recursive watching
Directive: All cortex MCP handlers must use factory pattern (buildXHandler) for testability
```

**Why this format:**
- Standard git trailer format (capitalized key, colon, space, value) -- same as `Co-Authored-By:`, `Signed-off-by:`
- `%(trailers:key=Constraint)` filtering works out of the box in git 2.43.0
- No prefix needed (`Lore-Constraint:` is unnecessarily verbose for a private repo)
- Three atom types map directly to the three decision categories: what we must do, what we chose not to do, and what we mandate going forward

**CLAUDE.md documentation should include:**

Good examples:
```
feat(16-01): create embedder.ts with embedEntry() and full unit test suite

- DI pattern for OpenAI/Qdrant clients enables pure unit tests
- Content-hash skip logic avoids re-embedding unchanged entries

Constraint: DI injection for openai/qdrant in embedEntry() -- enables unit testing without live services
Rejected: Chokidar for file watching -- native fs.watch sufficient, zero new dependencies
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Bad examples (what NOT to do):
```
# BAD: trailer in commit body, not after blank line separator
feat: add feature
Constraint: something    <-- this is body text, not a trailer

# BAD: too vague to be useful
Constraint: use good patterns

# BAD: multiple atoms crammed into one trailer
Constraint: use DI and also factory pattern and also pino logger
```

### Pattern 2: Git Trailer Parser (LORE-02)

**What:** A function that shells out to `git log`, extracts Constraint/Rejected/Directive trailers, and returns structured lore atoms.

**Implementation approach:**

```typescript
import { execSync } from 'node:child_process';

interface LoreAtom {
  commitHash: string;
  commitSubject: string;
  commitDate: string;
  trailerKey: 'Constraint' | 'Rejected' | 'Directive';
  trailerValue: string;
}

const LORE_KEYS = ['Constraint', 'Rejected', 'Directive'] as const;

// Format: hash, subject, date, then all trailers
const GIT_FORMAT = '%H%x00%s%x00%aI%x00%(trailers)%x00';

function parseLoreFromGit(repoDir: string, since?: string): LoreAtom[] {
  const args = ['log', `--format=${GIT_FORMAT}`];
  if (since) args.push(`--since=${since}`);

  const raw = execSync(['git', ...args].join(' '), {
    cwd: repoDir,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10MB for large histories
  });

  const atoms: LoreAtom[] = [];
  for (const block of raw.split('\x00\n').filter(Boolean)) {
    const [hash, subject, date, ...trailerParts] = block.split('\x00');
    const trailerText = trailerParts.join('\x00');

    for (const key of LORE_KEYS) {
      const regex = new RegExp(`^${key}:\\s*(.+)$`, 'gm');
      let match;
      while ((match = regex.exec(trailerText)) !== null) {
        atoms.push({
          commitHash: hash,
          commitSubject: subject,
          commitDate: date,
          trailerKey: key,
          trailerValue: match[1].trim(),
        });
      }
    }
  }
  return atoms;
}
```

**Confidence:** HIGH -- verified that git 2.43.0 on this system supports `%(trailers)` format. The `Co-Authored-By` trailer already appears correctly in existing commits.

### Pattern 3: Vault File Generation (LORE-03)

**What:** Each lore atom becomes a markdown file in `cortex/Lore/` with Cortex frontmatter.

**File naming:** `{short-hash}-{atom-type}.md` (e.g., `a215dbb-constraint.md`)

**Frontmatter for explicit trailer entries:**

```yaml
---
type: lore-atom
cortex_level: L20
confidence: high
domain: nanoclaw
scope: "{trailerValue first 60 chars}"
lore_source: "{commitHash}"
lore_key: constraint|rejected|directive
commit_date: "2026-03-30"
created: "2026-03-31"
---

# {Atom Type}: {trailer value}

**Commit:** {short hash} -- {subject}
**Date:** {commit date}
**Type:** {Constraint|Rejected|Directive}

{trailer value}
```

**Frontmatter for mined entries (lower confidence per D-02):**

```yaml
---
type: lore-atom
cortex_level: L20
confidence: low
domain: nanoclaw
scope: "{extracted decision first 60 chars}"
lore_source: "{commitHash}"
lore_key: constraint|rejected|directive
lore_mined: true
commit_date: "2026-03-22"
created: "2026-03-31"
---
```

**Why `confidence: low` for mined vs `confidence: high` for explicit:**
- Explicit trailers are intentional, authored by the committer -- HIGH confidence
- Mined entries are heuristically extracted from commit body text -- LOW confidence
- This matches the existing Cortex schema permissive defaults pattern (D-08 from Phase 14)
- Search results naturally rank explicit entries above mined ones via confidence filtering

### Pattern 4: Embedding Integration

**What:** After writing vault files, call `embedEntry()` to index them in Qdrant.

The fs.watch cortex watcher (watcher.ts) will auto-embed new files in `cortex/Lore/` after the 10-minute debounce. However, for the initial extraction (and the mining task), calling `embedEntry()` directly is more appropriate to get immediate indexing.

```typescript
import { embedEntry, createOpenAIClient } from './embedder.js';
import { createQdrantClient } from './qdrant-client.js';

async function indexLoreAtoms(filePaths: string[]): Promise<void> {
  const openai = createOpenAIClient();
  const qdrant = createQdrantClient();

  for (const fp of filePaths) {
    await embedEntry(fp, openai, qdrant, { force: true });
  }
}
```

### Pattern 5: Night Shift Mining Task (D-02)

**What:** A one-time scheduled task for Alfred to heuristically extract decisions from ~936 existing commits.

**Mining heuristics for commit bodies:**
1. Lines starting with `- ` that contain decision language: "because", "instead of", "not using", "to avoid", "must", "never"
2. Bullet points from commit bodies that describe WHY something was done (not WHAT)
3. STATE.md accumulated decisions (already partially captured there)

**Task creation pattern** (matches existing `createTask` from db.ts):

```typescript
createTask({
  id: 'lore-mining-one-off',
  group_folder: 'nightshift',
  chat_jid: 'dc:{agents-channel-id}',
  prompt: '...mining prompt...',
  script: null,
  schedule_type: 'once',
  schedule_value: '',
  context_mode: 'isolated',
  model: null,
  routing_tag: null,
  next_run: new Date().toISOString(),
  status: 'active',
  created_at: new Date().toISOString(),
});
```

**Important:** The mining task prompt should instruct Alfred to:
1. Run `git log --format='%H%x00%s%x00%B' --all` to get full commit history
2. Scan commit bodies for decision-indicating language
3. Extract candidate decisions and classify as constraint/rejected/directive
4. Write vault files with `lore_mined: true` and `confidence: low`
5. Call embedEntry for each new file
6. Report summary to #agents

### Anti-Patterns to Avoid

- **Don't rewrite git history:** D-01 explicitly forbids retroactive commit rewriting. Mining uses a separate extraction pass.
- **Don't use external CLI tools:** D-03 requires native git parsing only. No `git-interpret-trailers`, no `git-trailers` npm package.
- **Don't embed during extraction:** Write all vault files first, then batch-embed. Avoids partial state if embedding fails.
- **Don't mine trivial commits:** Skip merge commits, docs-only commits with no decision content.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter serialization | Custom YAML writer | gray-matter.stringify() | Already in project, handles edge cases |
| Vector embedding | Custom API calls | embedEntry() from embedder.ts | Full pipeline with hash-skip, validation, upsert |
| Qdrant client management | New client factory | createQdrantClient() + createOpenAIClient() | DI pattern already established |
| Schema validation | Custom frontmatter checks | validateFrontmatter() from schema.ts | Zod schema handles permissive mode with defaults |
| Deterministic file IDs | Custom hash function | deterministicId() from embedder.ts | Consistent UUID format for Qdrant points |

## Common Pitfalls

### Pitfall 1: Git Trailer Format Requirements

**What goes wrong:** Trailers that aren't preceded by a blank line are treated as commit body text, not trailers.
**Why it happens:** Git requires trailers to be in the last paragraph of the commit message, separated from the body by an empty line.
**How to avoid:** Document in CLAUDE.md with explicit examples. The `Co-Authored-By` trailer already works correctly in existing commits -- same pattern applies.
**Warning signs:** `%(trailers)` returns empty for commits where the trailer appears to be present in `%B`.

### Pitfall 2: execSync Buffer Overflow

**What goes wrong:** `execSync` defaults to 1MB buffer. With 936 commits, full `%B` output could exceed this.
**Why it happens:** Default `maxBuffer` is 1024 * 1024 bytes.
**How to avoid:** Set `maxBuffer: 10 * 1024 * 1024` (10MB) explicitly. For trailer-only extraction, output is small (~50 bytes per trailer), so this is mainly relevant for the mining task which reads full commit bodies.
**Warning signs:** `Error: stdout maxBuffer length exceeded`.

### Pitfall 3: Duplicate Lore Atoms on Re-Run

**What goes wrong:** Running the extractor twice creates duplicate vault files.
**Why it happens:** No idempotency check.
**How to avoid:** Use `{commit-hash-short}-{atom-type}-{index}.md` naming with existence check before writing. Or use the commit hash + trailer key as a dedup key.
**Warning signs:** Duplicate search results from cortex_search.

### Pitfall 4: Mining Heuristic Over-Extraction

**What goes wrong:** Mining produces hundreds of low-quality "decisions" from ordinary commit messages.
**Why it happens:** Too-broad pattern matching (e.g., every "because" clause isn't a decision).
**How to avoid:** Focus mining on commits with bullet-point bodies that explain WHY. Skip single-line commit messages. Set aggressive quality threshold -- better to miss some than pollute Cortex.
**Warning signs:** Large number of mined entries (>50) suggests over-extraction.

### Pitfall 5: Frontmatter Type Collision

**What goes wrong:** Existing Cortex entries use `type: project`, `type: session`, etc. Adding `type: lore-atom` needs to be compatible.
**Why it happens:** The `type` field is passthrough in the Zod schema (ExistingFields).
**How to avoid:** `lore-atom` is a new type value that doesn't conflict with existing types. The permissive schema accepts any string for `type`. No schema changes needed.
**Warning signs:** None expected -- verified ExistingFields schema accepts arbitrary type strings.

## Code Examples

### Verified: Git Trailer Extraction (git 2.43.0)

```bash
# Basic trailer extraction -- works on this system
git log --format='%(trailers)' -5
# Output: Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

# Key-filtered extraction -- works
git log --format='%(trailers:key=Co-Authored-By,valueonly)' -3
# Output: Claude Sonnet 4.6 <noreply@anthropic.com>

# Multi-field format with null separator -- works
git log --format='%H%x00%s%x00%aI%x00%(trailers)%x00' -3
```

### Verified: Existing embedEntry() Pipeline

Source: `/home/andrii-panasenko/nanoclaw/src/cortex/embedder.ts`

```typescript
// embedEntry accepts filePath + DI clients, returns EmbedResult
const result = await embedEntry(filePath, openai, qdrant, { force: true });
// result.status: 'embedded' | 'skipped' | 'error'
```

### Verified: deterministicId for Vault Files

Source: `/home/andrii-panasenko/nanoclaw/src/cortex/embedder.ts`

```typescript
// Strips prefix before cortex/, produces UUID from MD5
deterministicId('/path/to/cortex/Lore/a215dbb-constraint.md')
// Returns: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
```

### Verified: updateFrontmatter for Source Hash

Source: `/home/andrii-panasenko/nanoclaw/src/cortex/embedder.ts`

```typescript
// Writes key-value pairs into YAML frontmatter
updateFrontmatter(filePath, {
  source_hash: entry.sourceHash,
  embedding_model: EMBEDDING_MODEL,
});
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npx vitest run src/cortex/lore-parser.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LORE-01 | Convention documented in CLAUDE.md | manual | Visual inspection | N/A |
| LORE-02 | parseLoreFromGit extracts trailers | unit | `npx vitest run src/cortex/lore-parser.test.ts -x` | Wave 0 |
| LORE-02 | parseLoreFromGit handles empty trailers | unit | `npx vitest run src/cortex/lore-parser.test.ts -x` | Wave 0 |
| LORE-02 | parseLoreFromGit filters by key type | unit | `npx vitest run src/cortex/lore-parser.test.ts -x` | Wave 0 |
| LORE-03 | writeLoreAtom creates vault file with valid frontmatter | unit | `npx vitest run src/cortex/lore-parser.test.ts -x` | Wave 0 |
| LORE-03 | Lore atom embeds via embedEntry() | integration | `npx vitest run src/cortex/lore-parser.test.ts -x` | Wave 0 |
| LORE-03 | Duplicate detection prevents re-creation | unit | `npx vitest run src/cortex/lore-parser.test.ts -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/cortex/lore-parser.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/cortex/lore-parser.test.ts` -- covers LORE-02, LORE-03
- [ ] `src/cortex/lore-parser.ts` -- module under test (does not exist yet)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | Trailer extraction | Yes | 2.43.0 | -- |
| Node.js | Runtime | Yes | 22.22.2 | -- |
| Qdrant | Vector indexing | Yes | running (localhost:6333) | -- |
| OpenAI API | Embeddings | Yes | via .env OPENAI_API_KEY | -- |

No missing dependencies.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ADR files in docs/ | Git commit trailers | This phase | Decisions captured at commit time, not after the fact |
| Manual STATE.md decisions | Searchable Cortex lore-atom entries | This phase | Agents can find decisions via cortex_search |

**Key insight:** Git trailers are superior to ADR files because they are captured at the moment of the decision (commit time), co-located with the code change that implements the decision. No separate file to maintain, no drift between decision and implementation.

## Open Questions

1. **Vault directory: `cortex/Lore/` vs `cortex/Areas/Projects/NanoClaw/Lore/`**
   - What we know: Lore atoms are project-scoped (domain: nanoclaw). Other projects may have lore later.
   - What's unclear: Whether to namespace under NanoClaw or keep top-level.
   - Recommendation: Use `cortex/Lore/` (top-level) since lore may span multiple projects. The `domain` frontmatter field provides project scoping.

2. **Mining task granularity: how many entries to extract**
   - What we know: 936 commits exist. STATE.md already has ~20 accumulated decisions.
   - What's unclear: How many implicit decisions exist in commit bodies.
   - Recommendation: Target 20-40 high-quality mined entries. Quality over quantity. The STATE.md decisions are a good starting seed.

## Sources

### Primary (HIGH confidence)
- Git 2.43.0 man pages -- `%(trailers)` format verified on this system
- `/home/andrii-panasenko/nanoclaw/src/cortex/embedder.ts` -- embedEntry() API confirmed
- `/home/andrii-panasenko/nanoclaw/src/cortex/schema.ts` -- Zod schema supports arbitrary `type` field values
- `/home/andrii-panasenko/nanoclaw/src/cortex/parser.ts` -- parseCortexEntry() API confirmed
- `/home/andrii-panasenko/nanoclaw/src/task-scheduler.ts` -- Task scheduling pattern confirmed

### Secondary (MEDIUM confidence)
- Mining heuristic patterns -- based on analysis of existing commit messages in this repo

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing
- Architecture: HIGH -- git trailer format verified, Cortex pipeline proven in phases 14-19
- Pitfalls: HIGH -- based on direct testing of git trailer parsing on this system

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no fast-moving dependencies)
