# Phase 8: Per-Channel Context and Migration - Research

**Researched:** 2026-03-26
**Domain:** Channel-specific AI context templates + webhook routing migration toggles
**Confidence:** HIGH

## Summary

Phase 8 has two distinct workstreams: (1) replacing generic CLAUDE.md stubs with rich, themed templates per Discord channel, and (2) adding an `enabled` toggle to routing targets so notifications can migrate from Telegram to Discord gradually per webhook type.

Both workstreams are straightforward config/content changes with minimal code modifications. The CLAUDE.md template system requires creating static template files and modifying `createGroupStub()` to select templates by channel name. The migration toggle requires adding one optional `enabled` field to the existing Zod schema in `webhook-router.ts` and filtering on it in `resolveTargets()`.

No new libraries are needed. No external dependencies beyond what is already installed. The Cortex vault exists at `/workspace/host/nanoclaw/cortex/` with subdirectories (Areas/Work, Areas/Health, Areas/Personal, System/Templates, System/Dashboards) — CLAUDE.md templates reference these paths as forward-compatible pointers.

**Primary recommendation:** Split into two plans: (1) channel templates + CLAUDE.md enhancement, (2) routing `enabled` toggle + migration docs.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Replace Phase 4 generic stubs with rich themed templates per channel purpose
- D-02: Templates defined per target channel: #main, #agents, #yw-tasks, #bugs, #progress, #dev-alerts, #logs, #bot-control
- D-03: Templates are static files in `config/channel-templates/` — copied to group folder on bootstrap or first registration
- D-04: CLAUDE.md references Cortex vault paths (e.g., `See cortex/bugs/ for known issues`) — no runtime code changes needed
- D-05: Agent already mounts group directory with CLAUDE.md — Cortex references work via existing mount system
- D-06: If Cortex vault doesn't exist yet, CLAUDE.md references are forward-compatible (agent ignores missing paths)
- D-07: Extend `config/routing.json` target entries with optional `enabled` field (default: `true`)
- D-08: `resolveTargets()` in webhook-router.ts filters out targets where `enabled === false`
- D-09: Migration flow: start with both targets enabled (dual-send) -> verify Discord works -> set Telegram `enabled: false`
- D-10: Manual verification per webhook type — no automated migration, user controls the toggle
- D-11: Document migration checklist in project docs

### Claude's Discretion
- Exact CLAUDE.md template content per channel
- Cortex vault path conventions
- Whether to add `enabled` field to routing schema or keep it simple
- Template file naming convention

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-01 | Each Discord channel group gets a channel-specific CLAUDE.md with themed instructions | Template files in `config/channel-templates/`, `createGroupStub()` enhanced to select by channel name |
| CTX-02 | `#bugs` channel agent responds in bug-triage mode using Cortex knowledge | Bug-triage template references `cortex/Areas/Work/` bug knowledge, sets triage persona |
| CTX-03 | `#yw-tasks` channel agent responds in project management mode | PM template references Cortex project data, sets task management persona |
| CTX-04 | `#main` channel agent responds as general Jarvis assistant | Main template mirrors existing `groups/main/CLAUDE.md` pattern with general assistant instructions |
| CTX-05 | Agent uses Cortex/Obsidian knowledge base for contextual responses per channel | Cortex vault paths embedded in CLAUDE.md templates; container mounts already handle access |
| MIG-01 | Configurable per-webhook routing toggle (Telegram-only / Discord-only / both) | Add optional `enabled` field to TargetSchema in webhook-router.ts |
| MIG-02 | Migration can be done gradually — one webhook at a time | Each webhook type in routing.json has independent target entries with own `enabled` flag |
| MIG-03 | Telegram notifications remain functional until explicitly disabled per-webhook | Default `enabled: true` means existing Telegram targets continue working |
| MIG-04 | Rollback capability — switch any webhook back to Telegram-only | Set Discord target `enabled: false` and Telegram `enabled: true` in routing.json |

</phase_requirements>

## Standard Stack

### Core
No new libraries needed. Phase 8 is entirely config + content + minor code changes.

### Already in Project
| Library | Version | Purpose | Used For |
|---------|---------|---------|----------|
| zod | ^4.3.6 | Schema validation | Extend TargetSchema with optional `enabled` field |
| better-sqlite3 | ^11.8.1 | Database | No DB changes needed |
| pino | ^9.6.0 | Logging | Log template selection and migration toggles |

## Architecture Patterns

### Recommended Project Structure
```
config/
  channel-templates/
    main.md              # General Jarvis assistant
    agents.md            # Swarm output display
    yw-tasks.md          # Project management mode
    bugs.md              # Bug triage mode
    progress.md          # Progress tracking, read-mostly
    dev-alerts.md        # CI/CD notifications
    logs.md              # System logs, minimal interaction
    bot-control.md       # Server management, admin mode
  routing.json           # Add `enabled` per target
  discord-server.json    # Unchanged
```

### Pattern 1: Template Selection by Channel Name
**What:** Map Discord channel name to template file, fall back to generic stub if no template matches.
**When to use:** During auto-registration (discord.ts line 192-198) and optionally during bootstrap.
**Example:**
```typescript
// In discord-group-utils.ts
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = resolve(__dirname, '..', 'config', 'channel-templates');

export function createGroupStub(channelName: string, isMain: boolean): string {
  // Try channel-specific template first
  const templatePath = resolve(TEMPLATES_DIR, `${channelName}.md`);
  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf-8');
  }

  // Fallback to generic stub
  return `# ${channelName}\n\nDiscord channel group.${isMain ? ' This is the main channel.' : ''}\n\n## Instructions\n\nRespond helpfully to messages in this channel.\n`;
}
```

### Pattern 2: Routing Target Enabled Filter
**What:** Add optional `enabled` boolean to each target in routing.json, filter in resolveTargets().
**When to use:** When processing webhook routing decisions.
**Example:**
```typescript
// Updated TargetSchema
const TargetSchema = z.object({
  platform: z.enum(['telegram', 'discord']),
  jid: z.string(),
  enabled: z.boolean().default(true),
});

// In resolveTargets(), filter step:
for (const target of route.targets) {
  if (target.enabled === false) {
    logger.info({ jid: target.jid, webhookType }, 'resolveTargets: target disabled, skipping');
    continue;
  }
  // ... existing resolution logic
}
```

### Pattern 3: Template Content Structure
**What:** Each CLAUDE.md template follows the established pattern from groups/main/CLAUDE.md.
**When to use:** All channel templates.
**Example (bugs.md):**
```markdown
# bugs

Bug triage and tracking channel.

## Instructions

You are in bug-triage mode. When messages arrive in this channel:

1. Analyze bug reports for severity, reproduction steps, and affected areas
2. Reference known issues from the Cortex knowledge base
3. Suggest triage priority (critical/high/medium/low)
4. Link to relevant GitHub Issues when applicable

## Context

- See `cortex/Areas/Work/` for project context
- Bug reports arrive via GitHub Issues webhook
- Format responses with clear structure: Summary, Impact, Suggested Priority, Next Steps

## Communication

Your output is sent to this Discord channel. Keep responses concise and actionable.
Use embeds-friendly formatting (headers, bullet points, code blocks).
```

### Anti-Patterns to Avoid
- **Hardcoding channel IDs in templates:** Templates use channel names, not IDs. IDs change per server.
- **Runtime Cortex loading in code:** Cortex references go in CLAUDE.md text only. The agent reads them at runtime via existing mount. No code changes for Cortex integration.
- **Complex template engine:** Simple file read, no Handlebars/Mustache. Channel name maps to filename directly.
- **Modifying existing group CLAUDE.md files:** Only new/missing CLAUDE.md files get templates. Existing ones (already customized) are preserved by the `if (!existsSync(claudePath))` guard in discord.ts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template engine | Custom placeholder system | Static markdown files | Templates are simple enough to not need variable substitution |
| Migration orchestration | Automated migration workflow | Manual toggle in routing.json | D-10 explicitly says manual verification |
| Cortex integration code | Runtime Cortex file reader | Path references in CLAUDE.md text | Agent already reads its group CLAUDE.md; D-04/D-05 confirm this |

## Common Pitfalls

### Pitfall 1: Overwriting Existing Customized CLAUDE.md
**What goes wrong:** Running template installation overwrites user-customized CLAUDE.md content in existing group folders.
**Why it happens:** Not checking if file already exists before writing.
**How to avoid:** The existing guard `if (!existsSync(claudePath))` in discord.ts already prevents this. Keep this guard. For a "re-template" scenario, add a separate force flag or command.
**Warning signs:** Group folder CLAUDE.md content looks like a fresh template after restart.

### Pitfall 2: Template Filename Mismatch
**What goes wrong:** Template not found because channel name doesn't match filename.
**Why it happens:** Discord channel names use hyphens (e.g., `yw-tasks`), but template file is named differently.
**How to avoid:** Name template files exactly as Discord channel names from discord-server.json: `main.md`, `agents.md`, `yw-tasks.md`, `bugs.md`, `progress.md`, `dev-alerts.md`, `logs.md`, `bot-control.md`.
**Warning signs:** Channels getting generic stub instead of themed template.

### Pitfall 3: Enabled Field Breaking Existing Config
**What goes wrong:** Adding `enabled` field to schema breaks parsing of existing routing.json that lacks the field.
**Why it happens:** Using `z.boolean()` without `.default(true)` or `.optional()`.
**How to avoid:** Use `z.boolean().default(true)` so existing config entries without `enabled` default to true.
**Warning signs:** All routing fails after code update, before config update.

### Pitfall 4: Cortex Paths That Don't Exist Yet
**What goes wrong:** Templates reference Cortex paths that don't exist, causing agent confusion.
**Why it happens:** Writing specific file paths instead of directory-level references.
**How to avoid:** Reference directories, not files: "See `cortex/Areas/Work/` for project context" instead of specific file paths. D-06 confirms forward-compatibility.
**Warning signs:** Agent mentions it cannot find referenced files.

## Code Examples

### Existing createGroupStub (to be enhanced)
```typescript
// Current: src/discord-group-utils.ts line 58-67
export function createGroupStub(channelName: string, isMain: boolean): string {
  return `# ${channelName}\n\nDiscord channel group.${isMain ? ' This is the main channel.' : ''}\n\n## Instructions\n\nRespond helpfully to messages in this channel.\n`;
}
```

### Existing resolveTargets filter loop (to add enabled check)
```typescript
// Current: src/webhook-router.ts line 107-118
for (const target of route.targets) {
  const group = groups[target.jid];
  if (!group) {
    logger.warn({ jid: target.jid, webhookType }, 'resolveTargets: JID not registered, skipping');
    continue;
  }
  resolved.push({ jid: target.jid, group });
}
```

### Existing auto-registration guard (preserves customized CLAUDE.md)
```typescript
// Current: src/channels/discord.ts line 193-200
const claudePath = path.join(groupDir, 'CLAUDE.md');
if (!fs.existsSync(claudePath)) {
  fs.writeFileSync(claudePath, createGroupStub(textChannel.name, isMain));
}
```

### Routing config with enabled field
```json
{
  "github-issues": {
    "targets": [
      { "platform": "telegram", "jid": "tg:TELEGRAM_CHAT_ID", "enabled": true },
      { "platform": "discord", "jid": "dc:DISCORD_BUGS_CHANNEL_ID", "enabled": true }
    ]
  }
}
```

## Cortex Vault Structure (Existing)

```
cortex/
  CLAUDE.md           # Hot section with identity, projects, decisions
  Areas/
    Health/
    Personal/
    Work/             # YourWave, Night Shift, Morning Digest, Content Factory
  Calendar/
  +Inbox/
  System/
    Dashboards/
    Templates/
```

**Template Cortex references by channel:**
| Channel | Cortex Reference | Purpose |
|---------|------------------|---------|
| bugs | `cortex/Areas/Work/` | Known issues, project bug history |
| yw-tasks | `cortex/Areas/Work/` | YourWave project context, task history |
| main | `cortex/` (root CLAUDE.md) | Full project memory |
| agents | `cortex/Areas/Work/Projects/NightShift/` | Night Shift bot context |
| progress | None needed | Read-mostly, receives formatted data |
| dev-alerts | None needed | CI/CD notifications only |
| logs | None needed | System logs only |
| bot-control | None needed | Admin commands only |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (from package.json) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01 | createGroupStub selects template by channel name | unit | `npx vitest run src/discord-group-utils.test.ts -t "template"` | Wave 0 |
| CTX-02 | bugs template contains triage instructions | unit | `npx vitest run src/discord-group-utils.test.ts -t "bugs"` | Wave 0 |
| CTX-03 | yw-tasks template contains PM instructions | unit | `npx vitest run src/discord-group-utils.test.ts -t "yw-tasks"` | Wave 0 |
| CTX-04 | main template contains general assistant instructions | unit | `npx vitest run src/discord-group-utils.test.ts -t "main"` | Wave 0 |
| CTX-05 | Templates with Cortex references contain vault paths | unit | `npx vitest run src/discord-group-utils.test.ts -t "cortex"` | Wave 0 |
| MIG-01 | resolveTargets filters disabled targets | unit | `npx vitest run src/webhook-router.test.ts -t "enabled"` | Wave 0 |
| MIG-02 | Each webhook type has independent enabled flags | unit | `npx vitest run src/webhook-router.test.ts -t "independent"` | Wave 0 |
| MIG-03 | Missing enabled field defaults to true | unit | `npx vitest run src/webhook-router.test.ts -t "default"` | Wave 0 |
| MIG-04 | Disabled Discord + enabled Telegram = Telegram-only | unit | `npx vitest run src/webhook-router.test.ts -t "rollback"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/discord-group-utils.test.ts` — covers CTX-01 through CTX-05 (template selection + content verification)
- [ ] `src/webhook-router.test.ts` — covers MIG-01 through MIG-04 (enabled filter + defaults)

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/discord-group-utils.ts` — current createGroupStub implementation
- Codebase inspection: `src/webhook-router.ts` — current TargetSchema and resolveTargets logic
- Codebase inspection: `src/channels/discord.ts` — auto-registration with CLAUDE.md guard
- Codebase inspection: `config/routing.json` — current routing config structure
- Codebase inspection: `config/discord-server.json` — 8 channels across 4 categories
- Codebase inspection: `cortex/` — vault structure with Areas/Work, System, Calendar, +Inbox
- Codebase inspection: `groups/main/CLAUDE.md` — existing main group template pattern

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-11 — user-locked implementation choices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all changes use existing packages
- Architecture: HIGH - patterns directly extend existing code with minimal changes
- Pitfalls: HIGH - identified from direct code inspection of existing guards and schemas

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable — no external dependencies changing)
