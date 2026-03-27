# Phase 9: Agent Message Schema - Research

**Researched:** 2026-03-27
**Domain:** TypeScript schema definition, Zod v4, discord.js EmbedBuilder
**Confidence:** HIGH

## Summary

Phase 9 is a pure schema-definition phase: create `src/agent-message-schema.ts` with a Zod schema, inferred TypeScript types, a color palette, and a `withAgentMeta()` helper. No runtime connections, no new dependencies — everything already exists in the project.

All decisions are fully locked in CONTEXT.md (user delegated to Claude in "yolo mode"). The only open technical question is whether the metadata fields go into embed fields or the footer text, which this research resolves clearly: use `addFields()` for machine-parseable values (they show up in `toJSON().fields[]` and are queryable), and `setFooter()` only for human-visible context text.

The test pattern is established by `src/discord-embeds.test.ts` and `src/swarm-webhook-manager.test.ts`. Vitest runs with `vitest run`, covers `src/**/*.test.ts`, no additional config needed.

**Primary recommendation:** Create one file (`src/agent-message-schema.ts`) with a Zod v4 schema, `z.infer<>` type export, 8-value `AgentMessageType` discriminated union, `AGENT_COLORS` map, and `withAgentMeta()` wrapper — following the exact same patterns already used in `src/discord-server-manager.ts` and `src/discord-embeds.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Schema implementation — Zod with exported TypeScript types**
Use Zod to define the `AgentMessageMeta` schema. Export the inferred TypeScript type. Rationale: IPC messages arrive as runtime strings — runtime validation is essential, not optional. Zod is already in the project and produces TypeScript types automatically.

**D-02: Message type granularity — Fine-grained discriminated union**
Use 8 fine-grained types:
- `took` — agent picked up a task/issue
- `closed` — agent completed a task with PR reference
- `progress` — intermediate update during long-running task
- `blocker-perm` — blocked by permission/access error
- `blocker-service` — blocked by service/tunnel unavailability
- `blocker-conflict` — blocked by ambiguity requiring human input
- `handoff` — structured handoff to another agent
- `digest` — morning digest summary

**D-03: Metadata injection pattern — `withAgentMeta()` wrapper function**
Single `withAgentMeta(embed: EmbedBuilder, meta: AgentMessageMeta): EmbedBuilder` helper. Appends 3 metadata fields (agent name, task ID, message type) as footer + inline fields. Does NOT modify existing webhook embed builders.

Required metadata fields:
- `agentName`: string (e.g. "Friday", "Alfred", "NanoClaw")
- `taskId`: string | undefined — optional (digest/handoff may not reference a specific task)
- `messageType`: one of the 8 fine-grained types above

**D-04: Color palette — Separate `AGENT_COLORS` constant, new file**
- `took`: 0x5865f2 (Blurple)
- `closed`: 0x57f287 (Green)
- `progress`: 0xfeb932 (Orange)
- `blocker`: 0xed4245 (Red — all blocker subtypes)
- `handoff`: 0x9b59b6 (Purple)
- `digest`: 0x95a5a6 (Grey)

**D-05: File location**
Single new file: `src/agent-message-schema.ts`
Exports: `AgentMessageMeta` Zod schema, `AgentMessageMeta` TypeScript type, `AgentMessageType` type, `withAgentMeta()` function, `AGENT_COLORS` map.

### Claude's Discretion

All decisions delegated to Claude ("yolo mode, apply best practices"). No discretion areas remain unresolved.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEARCH-01 | All #agents messages include structured metadata as embed fields — agent name, task ID, message type (status/blocker/handoff/digest) — machine-parseable | Zod schema + `withAgentMeta()` helper establishes the contract; all downstream phases (10-14) will call `withAgentMeta()` before sending to #agents |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 (installed) | Runtime schema validation + type inference | Already in project. Established pattern: `discord-server-manager.ts` and `webhook-router.ts` both use `z.object()` + `z.infer<>`. Validates IPC messages at runtime. |
| discord.js | ^14.25.1 (installed) | `EmbedBuilder` for `withAgentMeta()` return type | Already in project. All embed work uses `EmbedBuilder` from `discord.js`. |
| typescript | ^5.7.0 (installed) | Static types via `z.infer<>` | Already in project. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 (installed) | Unit tests for schema and helper | All test files follow `describe/it/expect` from vitest |

### No New Dependencies Required
All libraries are already installed. `npm install` is not needed for this phase.

## Architecture Patterns

### Recommended Project Structure

The new file slots into existing `src/` alongside existing embed infrastructure:

```
src/
├── discord-embeds.ts          # Existing — bug/task/progress embeds (DO NOT MODIFY)
├── discord-embeds.test.ts     # Existing — test pattern to follow
├── agent-message-schema.ts    # NEW — schema, types, withAgentMeta(), AGENT_COLORS
└── agent-message-schema.test.ts  # NEW — tests for new file
```

### Pattern 1: Zod Schema + `z.infer<>` Type Export

This is the established project pattern from `src/discord-server-manager.ts` and `src/webhook-router.ts`.

```typescript
// Source: src/discord-server-manager.ts (existing pattern)
import { z } from 'zod';

export const AgentMessageTypeSchema = z.enum([
  'took', 'closed', 'progress',
  'blocker-perm', 'blocker-service', 'blocker-conflict',
  'handoff', 'digest',
]);

export const AgentMessageMetaSchema = z.object({
  agentName: z.string(),
  taskId: z.string().optional(),
  messageType: AgentMessageTypeSchema,
});

export type AgentMessageType = z.infer<typeof AgentMessageTypeSchema>;
export type AgentMessageMeta = z.infer<typeof AgentMessageMetaSchema>;
```

### Pattern 2: `withAgentMeta()` Wrapper

Mirrors how `buildBugEmbed()` etc. use `addFields()` in `discord-embeds.ts`. The function receives an already-configured `EmbedBuilder` and appends the 3 metadata fields.

```typescript
// Source: mirrors src/discord-embeds.ts addFields() pattern
import { EmbedBuilder } from 'discord.js';

export function withAgentMeta(embed: EmbedBuilder, meta: AgentMessageMeta): EmbedBuilder {
  embed.addFields(
    { name: 'Agent', value: meta.agentName, inline: true },
    { name: 'Type', value: meta.messageType, inline: true },
  );
  if (meta.taskId) {
    embed.addFields({ name: 'Task', value: meta.taskId, inline: true });
  }
  return embed;
}
```

**Critical design note:** Use `addFields()` for all three metadata values, not `setFooter()`. Discord's `toJSON()` exposes fields as `fields[]` array — downstream Phase 14 queries filter on `fields[].name === 'Type'`. Footer text is unstructured and not filterable. The CONTEXT.md says "footer + inline fields" but for machine-parseability all values must be in `addFields()`. Footer may be used for supplemental human-readable text (e.g. timestamp hint) but must NOT be the sole carrier of structured metadata.

### Pattern 3: `AGENT_COLORS` Map

Mirrors the existing `COLORS` constant in `discord-embeds.ts`. Blocker subtypes share one color since they share visual meaning.

```typescript
// Source: mirrors src/discord-embeds.ts COLORS pattern
export const AGENT_COLORS = {
  took:    0x5865f2, // Blurple — active
  closed:  0x57f287, // Green — success
  progress: 0xfeb932, // Orange — in-flight
  'blocker-perm':     0xed4245, // Red
  'blocker-service':  0xed4245, // Red
  'blocker-conflict': 0xed4245, // Red
  handoff: 0x9b59b6, // Purple — transition
  digest:  0x95a5a6, // Grey — informational
} as const;
```

**AGENT_COLORS key design:** Use the full `AgentMessageType` value as key (not a collapsed `blocker` key). This allows `AGENT_COLORS[meta.messageType]` to work without a switch statement in Phase 10-11 builders.

### Pattern 4: Test Structure

Follows `src/discord-embeds.test.ts` exactly — no mocking needed since `EmbedBuilder` can be instantiated directly in tests, and Zod schemas test with `.parse()` / `.safeParse()`.

```typescript
// Source: mirrors src/discord-embeds.test.ts + src/swarm-webhook-manager.test.ts
import { describe, it, expect } from 'vitest';
import { EmbedBuilder } from 'discord.js';
import {
  AgentMessageMetaSchema,
  AgentMessageTypeSchema,
  withAgentMeta,
  AGENT_COLORS,
} from './agent-message-schema.js';
```

### Anti-Patterns to Avoid

- **Storing metadata only in footer text:** `embed.setFooter({ text: '...' })` is not machine-parseable. Always use `addFields()` for the 3 metadata fields.
- **Modifying `discord-embeds.ts`:** Phase 9 is additive only. No edits to existing files.
- **Using `z.discriminatedUnion()` for `messageType`:** The message type is a flat string enum, not a parent-level discriminant for different object shapes. Use `z.enum([...])` directly.
- **Importing `truncate` from `discord-embeds.ts`:** The function is not exported. Either duplicate the one-liner or write a local version. Field values for agent name, task ID, and type are short — truncation at 1024 chars is a safety measure only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime type validation | Custom type guard functions | `AgentMessageMetaSchema.safeParse()` | Zod handles nested errors, unknown keys, optional fields |
| TypeScript types from schema | Manually maintained interface parallel to schema | `z.infer<typeof AgentMessageMetaSchema>` | Single source of truth; no drift between schema and types |
| Color lookup | Switch statement on messageType | `AGENT_COLORS[meta.messageType]` map lookup | O(1) and exhaustive with `as const` |

**Key insight:** The project already has Zod and the exact patterns needed. This phase is wiring, not invention.

## Common Pitfalls

### Pitfall 1: `taskId` field empty string vs. undefined

**What goes wrong:** Callers pass `taskId: ''` (empty string) instead of `taskId: undefined`. Phase 14 query logic checking `taskId` presence would treat empty string as "has a task ID".

**Why it happens:** IPC messages from containers may serialize `null`/`undefined` as empty string.

**How to avoid:** Schema should coerce empty string to undefined: `z.string().optional().transform(v => v || undefined)`. Or document that callers must pass `undefined`, not `''`.

**Warning signs:** `withAgentMeta()` renders a `Task` field with empty value, which is visible in Discord as a blank inline field.

### Pitfall 2: Field count limit

**What goes wrong:** `EmbedBuilder.addFields()` allows up to 25 fields per embed. Phase 10-11 builders add their own fields before calling `withAgentMeta()`. If a builder already has 23+ fields, `addFields()` throws.

**Why it happens:** Discord API enforces a hard 25-field limit. discord.js v14 throws `RangeError` if exceeded.

**How to avoid:** Document that `withAgentMeta()` adds 2-3 fields (2 always, 1 if taskId present). Phase 10-11 builders must leave room. In practice, existing builders add 3-6 fields max, so this is not a real risk for this project — but worth noting in the helper's JSDoc.

**Warning signs:** `RangeError: A message embed must not exceed 25 fields` at send time.

### Pitfall 3: Zod v4 import syntax

**What goes wrong:** Copying Zod v3 code that uses `z.string().nonempty()` or other removed methods.

**Why it happens:** Zod v4 (installed: 4.3.6) changed some method names. `nonempty()` on strings is gone; use `z.string().min(1)` instead.

**How to avoid:** Use only: `z.string()`, `z.string().optional()`, `z.enum([...])`, `z.object({})`, `z.infer<>`. All confirmed working in installed 4.3.6.

**Warning signs:** TypeScript errors at schema definition, not at runtime.

### Pitfall 4: `.js` extension in imports

**What goes wrong:** Importing without `.js` extension causes ESM resolution failures at runtime.

**Why it happens:** Project uses `"type": "module"` in `package.json`. Node.js ESM requires explicit file extensions.

**How to avoid:** Always import as `from './agent-message-schema.js'` in test files and consuming modules — even though the source file is `.ts`.

**Warning signs:** `ERR_MODULE_NOT_FOUND` at test run time.

## Code Examples

Verified patterns from existing project files:

### Zod enum + object + infer (from src/discord-server-manager.ts)
```typescript
// Source: src/discord-server-manager.ts lines 21-38
import { z } from 'zod';

export const ChannelConfigSchema = z.object({
  name: z.string(),
  topic: z.string().optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
});
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;
```

### EmbedBuilder addFields (from src/discord-embeds.ts)
```typescript
// Source: src/discord-embeds.ts lines 38-49
embed.addFields({ name: 'Reporter', value: issue.reporter, inline: true });
embed.addFields({ name: 'Labels', value: issue.labels.join(', '), inline: true });
```

### Test: verify embed fields via toJSON() (from src/discord-embeds.test.ts)
```typescript
// Source: src/discord-embeds.test.ts lines 31-36
const data = embed.toJSON();
const reporterField = data.fields?.find((f: any) => f.name === 'Reporter');
expect(reporterField?.value).toBe('user1');
expect(reporterField?.inline).toBe(true);
```

### Test: Zod schema validation (from src/swarm-webhook-manager.test.ts)
```typescript
// Source: src/swarm-webhook-manager.test.ts lines 97-110
describe('SwarmIdentitySchema', () => {
  it('validates a correct identity', () => {
    const result = SwarmIdentitySchema.parse({ name: 'Friday', avatarURL: '...' });
    expect(result.name).toBe('Friday');
  });
  it('rejects missing name', () => {
    expect(() => SwarmIdentitySchema.parse({ avatarURL: '...' })).toThrow();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `.nonempty()` on strings | Zod v4 `.min(1)` | Zod v4 release | `.nonempty()` removed from string type |
| Zod v3 `z.string().url()` | Zod v4 same | — | No change, still works |
| Manual type guards | `z.infer<>` + `.safeParse()` | Zod v1+ | Project already uses this pattern |

**Deprecated/outdated:**
- `z.string().nonempty()`: Removed in Zod v4. Use `z.string().min(1)`.

## Open Questions

1. **Should `withAgentMeta()` accept footer text as an optional parameter?**
   - What we know: CONTEXT.md says "footer + inline fields" but does not spec footer content
   - What's unclear: Whether any phase 10-14 builders want to set custom footer text alongside metadata
   - Recommendation: Skip footer parameter in Phase 9; add if Phase 10-11 need it. The function signature can be extended non-breakingly later.

2. **Should `AgentMessageMetaSchema` be the export name, or `AgentMessageMeta` (schema value)?**
   - What we know: `discord-server-manager.ts` uses `Schema` suffix on the Zod object and bare name on the type: `ServerConfigSchema` / `ServerConfig`
   - What's unclear: CONTEXT.md says export both `AgentMessageMeta` Zod schema and `AgentMessageMeta` TypeScript type — same name for both creates a naming collision
   - Recommendation: Follow project convention: `AgentMessageMetaSchema` (Zod object) and `AgentMessageMeta` (TypeScript type). `AgentMessageTypeSchema` (Zod enum) and `AgentMessageType` (TypeScript type).

## Environment Availability

Step 2.6: SKIPPED — Phase 9 is purely additive TypeScript code. No external tools, services, CLIs, or runtimes beyond Node.js and the already-installed project dependencies are needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `vitest.config.ts` (covers `src/**/*.test.ts`) |
| Quick run command | `npx vitest run src/agent-message-schema.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEARCH-01 | `AgentMessageMetaSchema` validates valid meta objects | unit | `npx vitest run src/agent-message-schema.test.ts` | Wave 0 |
| SEARCH-01 | `AgentMessageMetaSchema` rejects missing required fields | unit | `npx vitest run src/agent-message-schema.test.ts` | Wave 0 |
| SEARCH-01 | `AgentMessageMetaSchema` rejects invalid `messageType` values | unit | `npx vitest run src/agent-message-schema.test.ts` | Wave 0 |
| SEARCH-01 | `withAgentMeta()` adds Agent, Type fields to embed | unit | `npx vitest run src/agent-message-schema.test.ts` | Wave 0 |
| SEARCH-01 | `withAgentMeta()` adds Task field when taskId is present | unit | `npx vitest run src/agent-message-schema.test.ts` | Wave 0 |
| SEARCH-01 | `withAgentMeta()` omits Task field when taskId is undefined | unit | `npx vitest run src/agent-message-schema.test.ts` | Wave 0 |
| SEARCH-01 | `AGENT_COLORS` has entries for all 8 message types | unit | `npx vitest run src/agent-message-schema.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/agent-message-schema.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/agent-message-schema.test.ts` — covers all SEARCH-01 behaviors above

*(All gaps are in the new test file for the new module. No existing test infrastructure needs modification.)*

## Sources

### Primary (HIGH confidence)
- `src/discord-embeds.ts` (project file) — EmbedBuilder usage, `addFields()`, field format `{ name, value, inline }`, `COLORS` pattern
- `src/discord-embeds.test.ts` (project file) — test patterns: `toJSON()`, `fields?.find()`, truncation assertions
- `src/discord-server-manager.ts` (project file) — Zod v4 schema + `z.infer<>` export pattern
- `src/swarm-webhook-manager.test.ts` (project file) — Zod schema test patterns: `.parse()`, `expect(() => ...).toThrow()`
- `src/webhook-router.ts` (project file) — `z.enum()`, `z.record()`, `z.infer<>` confirmed working patterns
- `package.json` (project file) — confirmed: zod@4.3.6, discord.js@^14.25.1, vitest@^4.0.18, `"type": "module"`, test script = `vitest run`
- `vitest.config.ts` (project file) — confirmed: `include: ['src/**/*.test.ts']`
- `.planning/phases/09-agent-message-schema/09-CONTEXT.md` — all design decisions locked

### Secondary (MEDIUM confidence)
- discord.js typings index: `EmbedBuilder.toJSON()` returns `APIEmbed` — confirms `fields[]` is the correct path for machine-parseable field access

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are installed, versions confirmed against package.json and node_modules
- Architecture: HIGH — patterns copied directly from existing project files; no speculation
- Pitfalls: HIGH (field count, ESM extensions) / MEDIUM (taskId coercion) — ESM and field limits are documented discord.js/Node.js behaviors; taskId coercion is a design choice to document

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain — Zod and discord.js APIs change slowly)
