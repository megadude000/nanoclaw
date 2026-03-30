# Phase 14: Cortex Schema Standard - Research

**Researched:** 2026-03-30
**Domain:** YAML frontmatter schema definition, Zod validation, knowledge pyramid specification
**Confidence:** HIGH

## Summary

Phase 14 is a convention + validation phase with no infrastructure dependencies. The deliverables are: (1) a YAML frontmatter specification that extends the existing Obsidian vault frontmatter, (2) a Zod validation module reusable by downstream phases, and (3) documentation of the L10-L50 knowledge pyramid with staleness TTLs.

The existing vault (108 markdown files) has inconsistent frontmatter -- 12 distinct `type` values, varying field sets across files. The schema must coexist with existing fields (`type`, `status`, `tags`, `created`, `updated`, `project`, `last_updated`, `date`, `topics`, `domain`, `day`) while adding new Cortex fields. The user explicitly decided on permissive validation with defaults (D-08) -- entries are indexed with warnings, not rejected.

**Primary recommendation:** Define the schema as a single `src/cortex/schema.ts` module exporting Zod schemas and a `validateFrontmatter()` function. Use `gray-matter` ^4.0.3 for parsing. Document the knowledge pyramid in `cortex/System/cortex-schema.md` (visible in Obsidian).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Extend existing frontmatter, don't break it. Current fields (type, status, tags, created, updated, project, last_updated) remain valid. New Cortex fields are ADDED alongside them.
- **D-02:** All four new Cortex fields are REQUIRED on entries that get indexed into Qdrant: `cortex_level` (L10-L50), `confidence` (low/medium/high), `domain` (project scope identifier), `scope` (what the entry covers).
- **D-03:** Embedding metadata fields (`source_hash`, `embedding_model`) are stored IN frontmatter, not Qdrant-only. This makes them visible in Obsidian and git-tracked.
- **D-04:** All 5 levels (L10-L50) defined with clear examples. L10 = file facts, L20 = behavior patterns, L30 = system topology, L40 = project domains, L50 = user journeys/experiential.
- **D-05:** Session logs and daily notes ARE indexed into Cortex -- everything in the vault is searchable. Session logs get L50 (experiential knowledge), daily notes get L40.
- **D-06:** Existing vault files (~80+) will all be indexed. The existing project summaries (YourWave.md, NightShift.md, etc.) are L40-level entries.
- **D-07:** Zod runtime schema validates frontmatter at write time. Reusable across host (embedding pipeline) and container (cortex_write MCP tool).
- **D-08:** Permissive with defaults -- existing vault files with incomplete frontmatter get sensible defaults (confidence: low, cortex_level inferred from path/content). Entries are indexed with warnings, not rejected. Everything searchable from day one.

### Claude's Discretion
- Staleness TTLs per level -- Claude picks reasonable defaults, configurable later
- Exact Zod schema field types and validation rules
- Default inference logic for cortex_level based on file path patterns
- Schema documentation format and location

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | Cortex YAML frontmatter standard defined with cortex_level (L10-L50), confidence, domain, scope fields | Zod schema in `src/cortex/schema.ts`, gray-matter for parsing, knowledge pyramid docs in vault, path-based inference for defaults |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6 | Schema validation | Already in project. Zod v4 supports `z.infer<>` for type derivation. Existing pattern in `src/agent-message-schema.ts`. |
| gray-matter | ^4.0.3 | YAML frontmatter parsing | De facto standard (5M+ weekly downloads). Extracts YAML metadata + body from markdown. Used by Obsidian ecosystem, Hugo, Astro. v4.0.3 is latest. |
| yaml | ^2.8.2 | YAML serialization (write path) | Already in project. gray-matter handles read, yaml handles structured write-back when updating frontmatter. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | built-in | SHA-256 content hashing for source_hash | Hash markdown body (excluding frontmatter) to detect content changes for re-embedding |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gray-matter | Manual regex + yaml parse | gray-matter handles edge cases (empty files, TOML frontmatter, excerpt extraction). One dependency vs brittle custom code. |
| Zod | TypeScript interfaces only | Lose runtime validation. Agents could write invalid frontmatter with no error feedback. |

**Installation:**
```bash
npm install gray-matter
```

**Version verification:** gray-matter 4.0.3 confirmed via `npm view` on 2026-03-30. Zod 4.3.6 already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/cortex/
  schema.ts          # Zod schemas + validateFrontmatter() + inferDefaults()
  parser.ts          # gray-matter wrapper: parseCortexEntry(filePath) -> { data, content }
  types.ts           # TypeScript types derived from Zod (z.infer<>)

cortex/System/
  cortex-schema.md   # Human-readable schema docs (visible in Obsidian)
```

### Pattern 1: Layered Schema Validation (Strict + Permissive)
**What:** Two Zod schemas -- `CortexFrontmatterStrict` for new writes (all fields required), `CortexFrontmatterPermissive` for existing files (applies defaults to missing fields).
**When to use:** Strict for `cortex_write` MCP tool (Phase 17). Permissive for indexing existing vault files (Phase 16 bootstrap).
**Example:**
```typescript
import { z } from 'zod';

// Knowledge pyramid levels
export const CortexLevel = z.enum(['L10', 'L20', 'L30', 'L40', 'L50']);
export type CortexLevel = z.infer<typeof CortexLevel>;

// Confidence levels
export const Confidence = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof Confidence>;

// Core Cortex fields (strict -- all required for new writes)
export const CortexFieldsStrict = z.object({
  cortex_level: CortexLevel,
  confidence: Confidence,
  domain: z.string().min(1),
  scope: z.string().min(1),
});

// Embedding metadata (optional until embedding pipeline runs)
export const EmbeddingMeta = z.object({
  source_hash: z.string().optional(),
  embedding_model: z.string().optional(),
});

// Existing vault fields (all optional, preserved as-is)
export const ExistingFields = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  date: z.string().optional(),
  project: z.string().optional(),
  last_updated: z.string().optional(),
  topics: z.array(z.string()).optional(),
  domain: z.string().optional(), // legacy overlap -- Cortex domain takes precedence
  day: z.string().optional(),
}).passthrough(); // allow unknown existing fields

// Full strict schema (new writes via cortex_write)
export const CortexFrontmatterStrict = ExistingFields
  .merge(CortexFieldsStrict)
  .merge(EmbeddingMeta);

// Permissive schema (existing files -- applies defaults)
export const CortexFrontmatterPermissive = ExistingFields
  .merge(CortexFieldsStrict.partial()) // all Cortex fields optional
  .merge(EmbeddingMeta);
```

### Pattern 2: Path-Based Default Inference
**What:** Infer `cortex_level` and `domain` from file path when frontmatter is incomplete.
**When to use:** When indexing existing 108 vault files that lack Cortex fields (D-08).
**Example:**
```typescript
interface InferredDefaults {
  cortex_level: CortexLevel;
  confidence: Confidence;
  domain: string;
  scope: string;
}

export function inferDefaults(filePath: string, existingMeta: Record<string, unknown>): InferredDefaults {
  // Path-based cortex_level inference
  const cortex_level = inferLevelFromPath(filePath);

  // Domain from existing 'project' field or path
  const domain = (existingMeta.project as string) ?? inferDomainFromPath(filePath);

  // Scope from existing 'type' field or filename
  const scope = inferScopeFromMeta(existingMeta, filePath);

  return { cortex_level, confidence: 'low', domain, scope };
}

function inferLevelFromPath(filePath: string): CortexLevel {
  if (filePath.includes('Session-Logs/')) return 'L50';
  if (filePath.includes('Calendar/Daily/')) return 'L40';
  if (filePath.includes('Research/')) return 'L20';
  if (filePath.includes('Projects/') && filePath.endsWith('.md')) {
    // Hub files (YourWave.md, NightShift.md) are L40
    // Sub-files (yw.branding.md) are L20
    const basename = filePath.split('/').pop() ?? '';
    if (basename.includes('.') && !basename.startsWith('20')) return 'L20';
    return 'L40';
  }
  if (filePath.includes('System/')) return 'L10';
  return 'L20'; // safe default
}
```

### Pattern 3: Validation Result with Warnings
**What:** Return structured result with warnings (not throw) so permissive mode can report issues without blocking indexing.
**When to use:** Always -- callers decide whether to treat warnings as errors.
**Example:**
```typescript
export interface ValidationResult {
  valid: boolean;
  data: CortexFrontmatter;       // parsed + defaults applied
  warnings: string[];             // missing fields that got defaults
  errors: string[];               // truly invalid data (wrong types, etc.)
}

export function validateFrontmatter(
  raw: Record<string, unknown>,
  filePath: string,
  mode: 'strict' | 'permissive' = 'permissive',
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (mode === 'strict') {
    const result = CortexFrontmatterStrict.safeParse(raw);
    if (!result.success) {
      return {
        valid: false,
        data: raw as CortexFrontmatter,
        warnings: [],
        errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      };
    }
    return { valid: true, data: result.data, warnings: [], errors: [] };
  }

  // Permissive: apply defaults for missing Cortex fields
  const defaults = inferDefaults(filePath, raw);
  const merged = { ...defaults, ...raw }; // existing values override defaults

  // Track which fields were defaulted
  if (!raw.cortex_level) warnings.push('cortex_level defaulted to ' + defaults.cortex_level);
  if (!raw.confidence) warnings.push('confidence defaulted to low');
  if (!raw.domain) warnings.push('domain inferred as ' + defaults.domain);
  if (!raw.scope) warnings.push('scope inferred as ' + defaults.scope);

  const result = CortexFrontmatterPermissive.safeParse(merged);
  if (!result.success) {
    return { valid: false, data: merged as CortexFrontmatter, warnings, errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) };
  }

  return { valid: true, data: result.data, warnings, errors: [] };
}
```

### Anti-Patterns to Avoid
- **Rejecting existing files:** Never throw on missing Cortex fields for existing vault files. D-08 is explicit: permissive with defaults.
- **Breaking Obsidian wiki-links:** Schema must not modify markdown body content. Only frontmatter is validated/modified.
- **Duplicating 'domain' semantics:** Existing vault files use `domain` for different purposes (e.g., `yw.branding.md` has `domain: branding`). The Cortex `domain` field means "project scope identifier" (e.g., "nanoclaw", "yourwave"). Use the existing `project` field value when available; only fall back to path inference.
- **Hardcoding embedding model:** `embedding_model` must be a string field, not an enum. New models can appear without schema changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Regex-based `---` splitter | gray-matter ^4.0.3 | Handles edge cases: empty frontmatter, no closing `---`, TOML/JSON variants, empty files |
| Content hashing | Custom hash function | `node:crypto` createHash('sha256') | Standard, no dependencies, deterministic |
| Schema validation | TypeScript type guards | Zod safeParse() | Runtime validation with structured error messages. Type guards cannot report WHY validation failed. |
| YAML serialization | String concatenation | yaml ^2.8.2 stringify() | Handles quoting, multi-line strings, array formatting correctly |

**Key insight:** This phase produces a validation library consumed by 3+ downstream phases. Correctness and clear error messages matter more than performance.

## Common Pitfalls

### Pitfall 1: Schema Changes After First Vector Stored
**What goes wrong:** Schema is defined in Phase 14, vectors are stored in Phase 16. If the schema changes after vectors exist, all embeddings are invalidated and must be regenerated.
**Why it happens:** Schema feels "soft" (just YAML fields) but downstream phases depend on exact field names and types for Qdrant payload filters.
**How to avoid:** Lock the schema completely in this phase. The `cortex_level`, `confidence`, `domain`, `scope`, `source_hash`, `embedding_model` field names and types must not change after Phase 14 is marked complete.
**Warning signs:** "Let's add one more field" requests during Phase 16+.

### Pitfall 2: Existing Frontmatter Field Conflicts
**What goes wrong:** The vault already uses `domain` in `yw.branding.md` (value: "branding") with a different meaning than Cortex `domain` (value: "yourwave"). Naive merge overwrites the existing value.
**Why it happens:** No audit of existing field usage before schema design.
**How to avoid:** The path-based inference should prefer the existing `project` field for Cortex domain. The existing `domain` field keeps its original meaning. If both `project` and `domain` exist in legacy frontmatter, use `project` for Cortex domain. Document this mapping clearly.
**Warning signs:** Existing sub-file entries get wrong domain values after indexing.

### Pitfall 3: Inconsistent Type Values Across Vault
**What goes wrong:** The vault has 12 different `type` values: session (32), project-note (18), project (7), daily (3), spec (2), reference (2), project-hub (2), architecture-spec (2), research (1), meeting (1), index (1), daily-note (1). Some are synonyms (daily vs daily-note). Schema validation must handle all of them.
**Why it happens:** Vault grew organically without strict conventions.
**How to avoid:** Do NOT try to normalize existing types. The `type` field is NOT a Cortex field -- it is an existing Obsidian convention. Cortex schema validates only the new Cortex fields. Existing fields pass through with `.passthrough()`.
**Warning signs:** Validation errors on files that were perfectly valid before Cortex.

### Pitfall 4: source_hash Computed at Wrong Boundary
**What goes wrong:** If source_hash includes frontmatter, then any frontmatter update (e.g., changing `confidence`) triggers re-embedding even though content has not changed. If source_hash excludes frontmatter but includes wiki-links markup, formatting changes trigger re-embedding.
**Why it happens:** Unclear specification of what "content" means for hashing.
**How to avoid:** Define source_hash as SHA-256 of the markdown body AFTER frontmatter stripping (i.e., `gray-matter(file).content`). This is the text that gets embedded. Frontmatter changes do NOT trigger re-embedding. Document this explicitly in the schema spec.
**Warning signs:** Re-embedding runs keep finding "changed" entries that have not actually changed.

### Pitfall 5: Zod v4 Import/API Differences
**What goes wrong:** Zod v4 has some API changes from v3. Using v3 patterns may cause subtle issues.
**Why it happens:** Most online examples target Zod v3.
**How to avoid:** The project already uses Zod v4 (^4.3.6) with `import { z } from 'zod'`. Follow the existing pattern in `src/agent-message-schema.ts`. Key v4 patterns: `z.enum()`, `z.object()`, `.merge()`, `.partial()`, `.passthrough()`, `safeParse()` all work the same. `z.infer<typeof Schema>` for type derivation.
**Warning signs:** TypeScript compilation errors on schema definitions.

## Code Examples

### Parsing a Cortex Entry
```typescript
// src/cortex/parser.ts
import matter from 'gray-matter';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateFrontmatter, type ValidationResult } from './schema.js';

export interface ParsedCortexEntry {
  filePath: string;
  frontmatter: Record<string, unknown>;
  content: string;
  sourceHash: string;
  validation: ValidationResult;
}

export function parseCortexEntry(filePath: string, mode: 'strict' | 'permissive' = 'permissive'): ParsedCortexEntry {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const sourceHash = createHash('sha256').update(content).digest('hex');
  const validation = validateFrontmatter(data, filePath, mode);

  return { filePath, frontmatter: data, content, sourceHash, validation };
}
```

### Writing Updated Frontmatter
```typescript
// src/cortex/writer.ts (preview -- actual implementation in later phases)
import matter from 'gray-matter';
import { readFileSync, writeFileSync } from 'node:fs';

export function updateFrontmatter(filePath: string, updates: Record<string, unknown>): void {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const merged = { ...data, ...updates };
  const output = matter.stringify(content, merged);
  writeFileSync(filePath, output, 'utf-8');
}
```

## Knowledge Pyramid Specification

Per D-04 and D-05, the five levels with recommended staleness TTLs:

| Level | Name | Definition | Examples (NanoClaw vault) | Staleness TTL | Rationale |
|-------|------|-----------|---------------------------|---------------|-----------|
| L10 | File Facts | Individual file, API, env var, config entry | System/Templates/*.md, individual source file docs | 14 days | Code changes frequently; file-level facts go stale fast |
| L20 | Behavior Patterns | How components interact, routing, data flow | yw.branding.md, yw.ecommerce.md, Research/*.md | 30 days | Patterns are more stable than individual files |
| L30 | System Topology | How subsystems compose, deployment, infrastructure | nightshift.architecture.md, cf.pipeline.md | 60 days | Architecture changes less often than implementation |
| L40 | Project Domains | Project overviews, business context, domain knowledge | YourWave.md, NightShift.md, ContentFactory.md, daily notes | 90 days | Business context is slow-moving |
| L50 | Experiential | User journeys, session insights, decision rationale | Session-Logs/*.md | 180 days | Experiential knowledge stays relevant longest |

**Staleness TTL meaning:** After N days without re-validation, the entry is flagged as `stale` and demoted in search ranking. It is NOT deleted -- just deprioritized. Configurable per deployment.

## Existing Vault Frontmatter Audit

Survey of 108 markdown files in `cortex/`:

| Field | Occurrences | Values Found |
|-------|-------------|-------------|
| type | ~72 files | session (32), project-note (18), project (7), daily (3), spec (2), reference (2), project-hub (2), architecture-spec (2), research (1), meeting (1), index (1), daily-note (1) |
| status | ~40 files | active, completed, planning |
| tags | ~50 files | arrays of strings |
| date | ~40 files | YYYY-MM-DD format |
| created | ~10 files | YYYY-MM-DD format |
| updated | ~10 files | YYYY-MM-DD format |
| project | ~25 files | YourWave, ContentFactory, NightShift |
| last_updated | ~5 files | YYYY-MM-DD format |
| topics | ~32 files | arrays of strings (session logs) |
| domain | ~18 files | branding, ecommerce, market, ops, etc. (sub-file domain, NOT Cortex domain) |
| day | ~1 file | weekday name |

**Key finding:** The existing `domain` field in sub-files (yw.branding.md: `domain: branding`) has different semantics from the Cortex `domain` field (project scope identifier like "yourwave"). The schema must handle this gracefully -- use `project` field for Cortex domain when available, fall back to path inference.

## Path-to-Level Mapping

Default inference rules for existing vault files (D-08):

| Path Pattern | Inferred Level | Inferred Domain | Confidence |
|-------------|---------------|-----------------|------------|
| `System/Templates/*` | L10 | nanoclaw | low |
| `Areas/Work/Projects/{Name}/Research/*` | L20 | from parent dir name | low |
| `Areas/Work/Projects/{Name}/yw.*.md` (sub-files) | L20 | from `project` field or parent dir | low |
| `Areas/Work/Projects/{Name}/{Name}.md` (hub files) | L40 | from `project` field or dir name | low |
| `Areas/Work/Projects/{Name}/*.md` (other) | L20 | from `project` field or dir name | low |
| `Areas/Work/Session-Logs/*` | L50 | from `project` field or "general" | low |
| `Calendar/Daily/*` | L40 | "personal" | low |
| `+Inbox/*` | L10 | "inbox" | low |
| `CLAUDE.md` | L30 | "nanoclaw" | medium |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|-------------|-----------------|--------------|--------|
| Unstructured markdown files | YAML frontmatter with schema validation | Established (Obsidian, Hugo, Astro ecosystem) | Standard practice for knowledge management |
| JSON Schema for validation | Zod runtime validation | 2022-2024 (Zod adoption) | TypeScript-native, better error messages, type inference |
| gray-matter v3 | gray-matter v4.0.3 | 2018 | Stable, no breaking changes expected |

## Open Questions

1. **Legacy `domain` field handling**
   - What we know: 18 files use `domain` for sub-file topic (branding, ecommerce, etc.). Cortex `domain` means project scope.
   - What's unclear: Should we rename the Cortex field to avoid collision?
   - Recommendation: Keep `domain` for Cortex (matches D-02). Use `project` field for Cortex domain inference. Legacy `domain` values pass through untouched. Document the dual meaning.

2. **Files without any frontmatter**
   - What we know: Some vault files (e.g., Research/design-systems.md) have no YAML frontmatter at all.
   - What's unclear: Exact count of files with zero frontmatter.
   - Recommendation: gray-matter returns empty object for missing frontmatter. inferDefaults() handles this case by deriving all values from file path. No blocker.

3. **Duplicate vault structure**
   - What we know: The vault has both `Areas/Projects/` and `Areas/Work/Projects/` with duplicate files.
   - What's unclear: Whether this is intentional (Obsidian symlinks/mirrors) or stale.
   - Recommendation: Schema validation does not need to resolve this. The embedding pipeline (Phase 16) should deduplicate by content hash or path normalization.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | none (vitest defaults, `npm test` runs `vitest run`) |
| Quick run command | `npx vitest run src/cortex/schema.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHEMA-01a | Valid frontmatter with all Cortex fields passes strict validation | unit | `npx vitest run src/cortex/schema.test.ts -t "strict valid"` | Wave 0 |
| SCHEMA-01b | Missing cortex_level fails strict validation with clear error | unit | `npx vitest run src/cortex/schema.test.ts -t "strict missing"` | Wave 0 |
| SCHEMA-01c | Invalid confidence value fails validation with clear error | unit | `npx vitest run src/cortex/schema.test.ts -t "invalid confidence"` | Wave 0 |
| SCHEMA-01d | Permissive mode applies defaults for missing fields | unit | `npx vitest run src/cortex/schema.test.ts -t "permissive defaults"` | Wave 0 |
| SCHEMA-01e | Existing frontmatter fields preserved (passthrough) | unit | `npx vitest run src/cortex/schema.test.ts -t "passthrough"` | Wave 0 |
| SCHEMA-01f | source_hash computed from body only (excludes frontmatter) | unit | `npx vitest run src/cortex/parser.test.ts -t "source_hash"` | Wave 0 |
| SCHEMA-01g | Path-based inference produces correct levels for each vault path pattern | unit | `npx vitest run src/cortex/schema.test.ts -t "infer"` | Wave 0 |
| SCHEMA-01h | L10-L50 levels documented with definitions, examples, TTLs | manual | Verify `cortex/System/cortex-schema.md` exists with all 5 levels | - |

### Sampling Rate
- **Per task commit:** `npx vitest run src/cortex/`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/cortex/schema.test.ts` -- covers SCHEMA-01a through SCHEMA-01e, SCHEMA-01g
- [ ] `src/cortex/parser.test.ts` -- covers SCHEMA-01f
- [ ] No vitest config file needed (defaults work with existing setup)

## Project Constraints (from CLAUDE.md)

- **Tech Stack:** Node.js, TypeScript (strict), discord.js ecosystem
- **Module system:** NodeNext (ESM with .js extensions in imports)
- **TypeScript target:** ES2022
- **Existing patterns:** Zod schemas in `src/agent-message-schema.ts` -- follow same style (`z.enum()`, `z.object()`, `z.infer<>`)
- **Secrets:** Managed by OneCLI gateway -- not relevant to this phase
- **GSD Workflow:** Required for all non-trivial tasks
- **Build:** `npm run build` (tsc), `npm run dev` (tsx)
- **Service management:** Linux systemd

## Sources

### Primary (HIGH confidence)
- Existing vault audit (108 files) -- direct filesystem inspection of frontmatter patterns
- `src/agent-message-schema.ts` -- confirmed Zod v4 patterns used in project
- `package.json` -- confirmed zod@^4.3.6, yaml@^2.8.2 already installed
- `npm view gray-matter version` -- confirmed 4.0.3 is latest
- `.planning/research/STACK.md` -- gray-matter recommendation with rationale
- `.planning/research/PITFALLS.md` -- schema-must-be-locked pitfall documented

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` -- knowledge pyramid L10-L50 definitions
- Staleness TTL values -- based on domain reasoning (no external standard exists)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project or verified via npm
- Architecture: HIGH -- follows established project patterns, no new architectural decisions
- Pitfalls: HIGH -- comprehensive vault audit completed, field conflicts documented
- Knowledge pyramid: MEDIUM -- TTL values are reasonable defaults but untested in practice

**Research date:** 2026-03-30
**Valid until:** 2026-05-30 (stable domain, no fast-moving dependencies)
