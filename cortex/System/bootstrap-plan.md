---
type: reference
cortex_level: L10
confidence: high
domain: nanoclaw
scope: cortex knowledge bootstrap tracking
source_hash: edf9970a061152429dae6bdb4d240e604852114fb4f2d821eb7c0f2be94ec3e8
embedding_model: text-embedding-3-small
---

# Cortex Bootstrap Plan

Tracks the one-time bootstrap of L20/L30 architectural knowledge for all major systems.
L10 file-level entries already exist (Phase 22). This plan targets **decision-level** knowledge:
why things are built the way they are, constraints, rejected alternatives, key patterns.

## How to Work This List

For each system marked `pending`:

1. Set status to `in-progress` (edit this file)
2. Read the specified git commits — use `git show <hash>` or `git log --oneline <range>`
3. Read the specified source files for current implementation
4. Write each entry listed under **Entries to create** using `cortex_write`
5. Run `cortex_relate` for each entry — connect to hub + related entries
6. Verify: `cortex_search("{system} architecture")` returns results with score > 0.7
7. Set status to `done`, fill `completed` date

**Do not skip entries.** If a source doesn't yield useful info for an entry, write what is known
and set `confidence: medium`. Empty entries are worse than partial ones.

---

## Systems

---

### 1. NanoClaw Core Architecture

**Status:** `done`
**Completed:** 2026-03-31
**Domain:** `nanoclaw`
**Hub entry:** `cortex/Areas/Projects/NanoClaw/NanoClaw.md`

**What to read:**
- Git: `git log --oneline c17823a..09c0e81` (initial architecture → container system)
- Git: `git show 6aec4a` (IPC auth), `git show 48822ff` (mount security)
- Source: `src/index.ts`, `src/ipc.ts`, `src/router.ts`, `src/container-runner.ts`
- Source: `src/channels/registry.ts`, `src/config.ts`

**Entries to create:**

| Path | Level | Capture |
|------|-------|---------|
| `cortex/Areas/Projects/NanoClaw/arch/message-flow.md` | L30 | Full message lifecycle: channel receives → index.ts message loop → container-runner spawns agent → agent writes IPC response → router sends back. Include sequence, key files at each step. |
| `cortex/Areas/Projects/NanoClaw/arch/ipc-protocol.md` | L20 | All IPC message types (cortex_write, cortex_read, cortex_search, cortex_relate, cortex_reconcile, send_message, register_group, etc.), their JSON shapes, which handler processes each. File-based IPC in `/workspace/group/{name}/ipc/`. |
| `cortex/Areas/Projects/NanoClaw/arch/channel-registry.md` | L20 | How channels self-register via `registerChannel()`. Why self-registration over explicit list. Channel interface contract (sendMessage, isConnected, ownsJid, etc.). JID format per channel (tg:, dc:, wa:). |
| `cortex/Areas/Projects/NanoClaw/arch/container-isolation.md` | L20 | Each group = isolated VM. What gets mounted (workspace, cortex vault, skills). Env injection pattern (OneCLI credential proxy, never raw keys in env). CLAUDE.md per group. Container lifecycle (spawn on message, exit after response). |
| `cortex/Areas/Projects/NanoClaw/arch/security-model.md` | L20 | IPC auth tokens (per-group namespaces), mount security allowlist, sender allowlist, credential proxy. Why these layers exist. What attacks they prevent. |

**cortex_relate:**
- Each entry → `NanoClaw.md` via `IMPLEMENTS`
- `ipc-protocol.md` → `container-isolation.md` via `RELATES_TO`
- `channel-registry.md` → `message-flow.md` via `IMPLEMENTS`

**Done criteria:** `cortex_search("nanoclaw message flow IPC container")` returns ≥ 3 results score > 0.7

---

### 2. NanoClaw Subsystems

**Status:** `done`
**Completed:** 2026-03-31
**Domain:** `nanoclaw`

**What to read:**
- Source: `src/task-scheduler.ts`, `src/webhook-router.ts`, `src/health-monitor.ts`
- Source: `src/discord-server-manager.ts`, `src/group-folder.ts`
- Git: commits mentioning "webhook", "scheduler", "health"

**Entries to create:**

| Path | Level | Capture |
|------|-------|---------|
| `cortex/Areas/Projects/NanoClaw/arch/task-scheduler.md` | L20 | How scheduled tasks work: cron expression, optional script gate (wakeAgent: true/false), 30s timeout. Why script gate exists (API credit conservation). Auto-expire + health check reinstall pattern. |
| `cortex/Areas/Projects/NanoClaw/arch/webhook-routing.md` | L20 | Webhook server → webhook-router → per-type handlers (GitHub, Notion, bugreport). How routing_tag determines destination group. Why webhooks go to Discord channels not Telegram. |
| `cortex/Areas/Projects/NanoClaw/arch/health-monitor.md` | L20 | What health monitor checks, what it reports, what it doesn't check (Cortex consistency gap). Morning digest timing (7:27 news, 7:35 nightshift approval). |
| `cortex/Areas/Projects/NanoClaw/arch/discord-server-manager.md` | L20 | Guild management: category/channel creation, JID format (dc:{channel_id}), 2000-char chunking, EmbedBuilder usage. How Discord groups map to IPC groups. |

**Done criteria:** `cortex_search("nanoclaw webhook scheduler discord")` returns ≥ 2 results > 0.7

---

### 3. Cortex Pipeline Architecture

**Status:** `done`
**Completed:** 2026-03-31
**Domain:** `nanoclaw`
**Hub entry:** `cortex/Areas/Projects/NanoClaw/NanoClaw.md`

**What to read:**
- `.planning/phases/14-cortex-schema-standard/14-01-SUMMARY.md`
- `.planning/phases/16-embedding-pipeline/` (all SUMMARY files)
- `.planning/phases/17-search-mcp-tools/` (all SUMMARY files)
- `.planning/phases/19-knowledge-graph/` (all SUMMARY files)
- `.planning/phases/21-nightshift-reconciliation/` (all SUMMARY files)
- `.planning/phases/23-lore-mining-production-wiring/23-VERIFICATION.md`

**Entries to create:**

| Path | Level | Capture |
|------|-------|---------|
| `cortex/Areas/Projects/NanoClaw/cortex-subsystem/pipeline-architecture.md` | L30 | Full pipeline: vault file change → watcher → embedEntry() → Qdrant. Schema validation (strict for writes, permissive for reads). source_hash skip logic. What triggers re-embedding vs skip. |
| `cortex/Areas/Projects/NanoClaw/cortex-subsystem/mcp-tool-interface.md` | L20 | All 4 MCP tools: cortex_search, cortex_read, cortex_write, cortex_relate. Input/output schemas. How they're exposed to containers vs how host handles them via IPC. Two paths: container MCP server stdio + host IPC handlers. |
| `cortex/Areas/Projects/NanoClaw/cortex-subsystem/knowledge-graph.md` | L20 | cortex-graph.json schema. Edge types (IMPLEMENTS, EXTENDS, RELATES_TO, CROSS_LINK, SUPERSEDES). Graph-augmented search: how graph neighbors boost search results. discoverCrossLinks cosine threshold 0.85. |
| `cortex/Areas/Projects/NanoClaw/cortex-subsystem/reconciliation-pipeline.md` | L20 | 4-step reconciliation: checkStaleness → markStaleEntries → discoverCrossLinks → findOrphans → mineLoreFromHistory. TTLs per level. When triggered (Night Shift IPC). Manual trigger pattern. |
| `cortex/Areas/Projects/NanoClaw/cortex-subsystem/lore-mining.md` | L20 | Git trailer format (Constraint/Rejected/Directive). parseLoreFromGit() → writeLoreAtom() → indexLoreAtoms(). Vault naming: {7-char-hash}-{key}.md. lore_mined: true flag. Auto-runs in reconciliation Step 4. |

**cortex_relate:**
- `pipeline-architecture.md` → `mcp-tool-interface.md` via `IMPLEMENTS`
- `knowledge-graph.md` → `pipeline-architecture.md` via `EXTENDS`
- `reconciliation-pipeline.md` → `pipeline-architecture.md` via `RELATES_TO`
- `lore-mining.md` → `reconciliation-pipeline.md` via `IMPLEMENTS`

**Done criteria:** `cortex_search("cortex embedding pipeline qdrant MCP")` returns ≥ 3 results > 0.7

---

### 4. GSD Workflow

**Status:** `done`
**Completed:** 2026-03-31
**Domain:** `nanoclaw`

**What to read:**
- `.planning/phases/` directory structure — any CONTEXT.md or first PLAN.md
- One complete phase as example: `.planning/phases/21-nightshift-reconciliation/` all files
- CLAUDE.md section "GSD Workflow Enforcement"

**Entries to create:**

| Path | Level | Capture |
|------|-------|---------|
| `cortex/Areas/Projects/NanoClaw/gsd/gsd-overview.md` | L30 | GSD = phase-based development system. Milestone → phases → plans. Directory structure `.planning/phases/{N}-{name}/`. Artifact types: CONTEXT, RESEARCH, PLAN, SUMMARY, VERIFICATION, VALIDATION. Enforcement rule (must use GSD before file edits). |
| `cortex/Areas/Projects/NanoClaw/gsd/phase-lifecycle.md` | L20 | Phase lifecycle: research → plan → execute → verify. PLAN.md structure (tasks, success criteria). SUMMARY.md structure (what was built, decisions, deviations). VERIFICATION.md (goal-backward analysis). Why goal-backward: prevents "all tasks done" without actual goal met. |
| `cortex/Areas/Projects/NanoClaw/gsd/lore-trailer-convention.md` | L20 | Trailer format, placement rules (last paragraph, blank line before), one decision per line, Constraint/Rejected/Directive keys, why forward-only (never amend). How this feeds lore mining. |

**Done criteria:** `cortex_search("GSD phase planning verification")` returns ≥ 2 results > 0.7

---

### 5. Night Shift System

**Status:** `done`
**Completed:** 2026-03-31
**Domain:** `nanoclaw`
**Existing docs:** `cortex/Areas/Projects/NightShift/NightShift.md`, `nightshift.architecture.md`

**What to read:**
- `cortex/Areas/Projects/NightShift/nightshift.architecture.md` — full spec
- `cortex/Areas/Projects/NightShift/NightShift.md` — decisions log
- Git: commits with "nightshift" in message

**Action:** These docs already exist as vault files. Check if they have proper Cortex frontmatter
(`cortex_level`, `confidence`, `domain`, `scope`). If not — update frontmatter only, no content rewrite.
Then create the missing L20 decision entries below.

**Entries to create:**

| Path | Level | Capture |
|------|-------|---------|
| `cortex/Areas/Projects/NightShift/arch/orchestration-model.md` | L20 | Jarvis as active orchestrator (not passive cron). 3-phase shift: Planned → Autonomous (Wind Rose) → Wrap-up. Two bots: Friday (code/docs) + Alfred (research/ideas). Circuit breakers (max 2 retries, 3 consecutive = halt). |
| `cortex/Areas/Projects/NightShift/arch/approval-tiers.md` | L20 | 🟢 auto-merge (safe: translations, articles), 🟡 flag for review (moderate), 🔴 require approval (ground-shifting). Morning review flow timing (7:35). Git branch isolation: nightshift/YYYY-MM-DD. |

**Done criteria:** `cortex_search("nightshift orchestration wind rose approval")` returns ≥ 2 results > 0.7

---

### 6. YourWave Platform

**Status:** `done`
**Completed:** 2026-03-31
**Domain:** `yourwave`
**Existing docs:** `cortex/Areas/Projects/YourWave/` — many L20 domain files

**What to read:**
- `cortex/Areas/Projects/YourWave/YourWave.md` — project hub
- `cortex/Areas/Projects/YourWave/yw.platform-spec.md` — technical spec
- `cortex/Areas/Projects/YourWave/yw.ecommerce.md`

**Action:** Domain files (branding, market, ops) likely already adequate. Focus on:
1. Check if `YourWave.md` hub has proper frontmatter — update if not
2. Check `yw.platform-spec.md` for cortex_level — it should be L30

**Entries to create:**

| Path | Level | Capture |
|------|-------|---------|
| `cortex/Areas/Projects/YourWave/arch/platform-decisions.md` | L20 | Key technical decisions: stack choices, architecture patterns, what was rejected and why. Read yw.platform-spec.md + yw.platform-discovery.md and extract the *why*, not just the *what*. |

**Done criteria:** `cortex_search("yourwave platform architecture decisions")` returns ≥ 1 result > 0.7

---

### 7. ContentFactory Pipeline

**Status:** `done`
**Completed:** 2026-03-31
**Domain:** `yourwave`
**Existing docs:** `cortex/Areas/Projects/ContentFactory/cf.pipeline.md`, `cf.atlas.md`

**Action:** Same as YourWave — check frontmatter on existing docs, update if missing Cortex fields.
If `cf.pipeline.md` is already a proper L20/L30 entry, this is just a frontmatter update — mark done.

**Entries to create:**

| Path | Level | Capture |
|------|-------|---------|
| `cortex/Areas/Projects/ContentFactory/arch/pipeline-decisions.md` | L20 | Only if cf.pipeline.md doesn't already capture decisions. Key: what the pipeline does, how content flows, rejected alternatives. |

**Done criteria:** `cortex_search("contentfactory pipeline content generation")` returns ≥ 1 result > 0.7

---

## Progress Summary

| System | Status | Entries | Completed |
|--------|--------|---------|-----------|
| NanoClaw Core Architecture | `done` | 5 | 2026-03-31 |
| NanoClaw Subsystems | `done` | 4 | 2026-03-31 |
| Cortex Pipeline | `done` | 5 | 2026-03-31 |
| GSD Workflow | `done` | 3 | 2026-03-31 |
| Night Shift | `done` | 2 (+frontmatter check) | 2026-03-31 |
| YourWave Platform | `done` | 1 (+frontmatter check) | 2026-03-31 |
| ContentFactory | `done` | 1 (+frontmatter check) | 2026-03-31 |

**Total entries to create: ~21** (+ frontmatter updates on existing docs)

---

## Quality Gates (apply to every entry)

Before marking a system `done`, verify:

1. Every entry has valid frontmatter: `cortex_level`, `confidence`, `domain`, `scope`
2. Every entry is connected to its hub via `cortex_relate`
3. Every entry passes: `cortex_search("{scope}")` returns the entry with score > 0.7
4. No entry is shorter than 150 words (too short = not useful for search)
5. L20 entries explain **why**, not just **what** — include constraints, rejected alternatives

If any gate fails — fix the entry before marking done. Do not mark done with known gaps.
