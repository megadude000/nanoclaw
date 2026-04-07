---
type: spec
cortex_level: L30
confidence: high
domain: nanoclaw
scope: >-
  Night Shift full architecture spec v2 - phases, bots, state contract, approval
  tiers
project: NightShift
created: 2026-03-22T00:00:00.000Z
updated: 2026-03-31T00:00:00.000Z
tags:
  - architecture
  - nightshift
source_hash: ee52738122e78689fbb5e901b886630784cc27213ee17d4ee25a0022d73749de
embedding_model: text-embedding-3-small
---

# Night Shift — Architecture (v2)

## Overview

```
21:03  ─── Planning Phase ───────────────────────────────
       │  Jarvis asks user what to work on tonight
       │  User picks via buttons (or Jarvis decides from TODO)
       │  Jarvis estimates difficulty, writes plan.json
       │  Assigns tasks to Friday / Alfred by role
       │
23:27  ─── Phase 1: Planned Work ───────────────────────
       │  Cron triggers execution
       │  Task 0: Warm-up (build check, lint)
       │  Friday + Alfred work IN PARALLEL on plan.json
       │  Creates git branch: nightshift/YYYY-MM-DD
       │  Parallel agent batching (4-7 agents)
       │  Quality gates per task
       │  All planned tasks done? → Phase 2
       │
       ─── Phase 2: Autonomous Improvement (Wind Rose) ──
       │  Plan complete, but shift continues!
       │  Jarvis runs Wind Rose scan → scores project axes
       │  Bots pick WEAKEST axis in their domain:
       │  Friday: Code Review + Docs Steward
       │    → code review, bug hunt, lint, type fixes
       │    → find stale docs/READMEs, update them
       │    → improve existing content (SEO, links, quality)
       │    → verify alignment between code and docs
       │  Alfred: Research + Ideas
       │    → competitor analysis, trends, new ideas
       │    → analytics review, improvement proposals
       │    → prepare brief for next shift
       │  Each bot generates tasks → executes → re-scans → repeats
       │  Change Approval Tiers: 🟢auto 🟡review 🔴proposal
       │  Circuit breakers still apply
       │
       ─── Phase 3: Wrap-up (before deadline) ──────────
       │  Final build + test verification
       │  Commit all changes
       │  Rebuild & restart tunnels (storybook + dev)
       │  Verify: storybook.yourwave.uk + dev.yourwave.uk
       │  Write shift summary
       │  Update learning.json
       │
06:00  ─── Hard Deadline ────────────────────────────────
       │  Stop after current task, write summary
       │
07:27  ─── Morning Report ──────────────────────────────
       │  Part of daily digest (Jarvis, not Friday)
       │  Summary of night's work + learning stats
```

## Bot Roles

### Friday — Code & Documentation
- **Phase 1:** Executes planned code/content tasks
- **Phase 2 (autonomous):**
  - **New Atlas articles:** write new origins, processing methods, brewing guides, varieties — anything missing from the atlas. Check existing articles first, find gaps, write new ones.
  - Code review: lint, types, patterns, edge cases
  - Bug hunt: `astro check`, broken links, build warnings
  - Documentation steward: find stale READMEs, outdated ideas, misaligned docs
  - Content improvement: SEO, interlinking, article quality
  - Storybook prototypes: new UI components, design tokens, interactive demos
  - Refactoring: small improvements to code structure
- **Sender:** `sender: "Friday"` for all messages

### Alfred — Research & Intelligence
- **Phase 1:** Executes planned research/analysis tasks
- **Phase 2 (autonomous):**
  - **New Atlas articles:** same as Friday — write new origins, processing methods, brewing guides, varieties. Both bots write content independently.
  - **Storybook prototypes:** create new UI components, design explorations, interactive demos
  - Competitor analysis, market trends
  - SEO/analytics review
  - New content ideas and briefs
  - Technology scouting (new tools, libraries, approaches)
  - Prepare next shift brief with prioritized suggestions
- **Sender:** `sender: "Alfred"` for all messages

### Jarvis — Orchestrator
- Plans shifts (21:03 cron)
- Launches execution (23:27 cron)
- Monitors health (12:00 cron)
- **Morning Approval Digest** (7:35, SEPARATE from 7:27 news digest) — structured approval flow with buttons
- Does NOT execute tasks directly — delegates to Friday/Alfred

### Two Morning Digests — CRITICAL
1. **7:27 — Новини** (Jarvis, isolated) — AI, світ, кава, пошта. БЕЗ Night Shift результатів.
2. **7:35 — Night Shift Approval** (Jarvis, group context) — structured per-category approval with buttons, deep links to storybook.yourwave.uk + dev.yourwave.uk. Reads `nightshift/reports/YYYY-MM-DD-approval.json`.

## State File Contract

`/workspace/group/nightshift/plans/YYYY-MM-DD.json`

```json
{
  "date": "2026-03-22",
  "created_at": "2026-03-22T21:15:00",
  "started_at": null,
  "completed_at": null,
  "status": "planned",
  "git_branch": "nightshift/2026-03-22",
  "config": {
    "deadline": "06:00",
    "max_retries_per_task": 2,
    "max_consecutive_failures": 3,
    "cooldown_between_cycles_min": 2
  },
  "tasks": [
    {
      "id": 0,
      "type": "warmup",
      "description": "Build check + environment verification",
      "priority": "critical",
      "difficulty": "S",
      "estimated_minutes": 2,
      "prompt": "Run build, check dev server, verify git status is clean",
      "status": "pending",
      "attempts": 0,
      "started_at": null,
      "completed_at": null,
      "actual_minutes": null,
      "result": null,
      "error": null,
      "quality_gate": {
        "passed": null,
        "checks": []
      }
    },
    {
      "id": 1,
      "type": "translate",
      "description": "Translate ethiopia.mdx to Ukrainian",
      "priority": "normal",
      "difficulty": "M",
      "estimated_minutes": 5,
      "prompt": "Full prompt for the agent...",
      "status": "pending",
      "attempts": 0,
      "started_at": null,
      "completed_at": null,
      "actual_minutes": null,
      "result": null,
      "error": null,
      "quality_gate": {
        "passed": null,
        "checks": []
      }
    }
  ],
  "summary": null,
  "consecutive_failures": 0,
  "stats": {
    "tasks_planned": 0,
    "tasks_completed": 0,
    "tasks_failed": 0,
    "total_estimated_minutes": 0,
    "total_actual_minutes": 0,
    "accuracy_ratio": null
  }
}
```

### Status Values
- Plan: `planned` → `running` → `completed` | `failed` | `deadline_reached` | `halted`
- Task: `pending` → `running` → `completed` | `failed` | `skipped`

### Priority Values
- `critical` — must do first, blocks morning work
- `high` — important, do early in the shift
- `normal` — standard priority

### Difficulty Values
- `S` (Small) — 2-5 min, simple/mechanical (build check, single file edit)
- `M` (Medium) — 5-10 min, standard task (translate article, write tests)
- `L` (Large) — 10-20 min, complex task (new feature, multi-file refactor)

## Warm-up Task (Always First)

Every shift starts with Task 0 — a cheap environment check:

1. `git status` — is working tree clean?
2. `npx astro build` — does the project build?
3. Check dev server port availability
4. Verify key directories exist

If warm-up fails → HALT immediately. Something is wrong with the environment.
Do not proceed with real work on a broken setup.

## Git Branch Isolation (Rollback)

At shift start:
```bash
git checkout -b nightshift/YYYY-MM-DD
```

All work happens on this branch. Benefits:
- Morning review: `git diff main...nightshift/2026-03-22`
- Happy → `git merge nightshift/2026-03-22`
- Unhappy → `git branch -D nightshift/2026-03-22` (clean rollback)
- Partial accept → cherry-pick specific commits

At shift end:
- Do NOT merge automatically
- Report includes branch name and diff summary
- User decides in the morning

## Morning Approval Flow — CRITICAL

After every Night Shift, the morning digest MUST include a structured approval section. This is NOT optional — it's the most important part of the handover.

### Approval Message Format

Jarvis sends a structured summary in the morning digest (7:27) with:

1. **Quick Stats** — tasks completed, articles written, research docs, commits, build status
2. **Git Branch** — `nightshift/YYYY-MM-DD`, one-click diff: `git diff main...nightshift/YYYY-MM-DD`
3. **Tunnels** — verify storybook.yourwave.uk + dev.yourwave.uk are live

Then for each category of work, a *separate message* with buttons:

#### Research Findings (🟡 moderate)
Each research doc gets its own mini-summary (3-5 bullet points with KEY takeaway) + expandable details + buttons:
```
📄 *Design Systems Research*
• Design tokens → components → patterns → templates
• Рекомендація: shadcn/ui + Tailwind + custom tokens
• Для YourWave: 12 base tokens, 8 core components

<blockquote expandable>
Детальніше:
• Приклади: Shopify Polaris, Radix UI, Carbon IBM
• Atomic Design: atoms → molecules → organisms
• Token categories: color, spacing, typography, shadow, radius
• Storybook integration: кожен токен як story
• Estimated implementation: 2-3 Night Shifts
</blockquote>

[👍 Прийняти] [📖 Повний документ] [✏️ Переробити] [🗑 Відхилити]
```

#### Auto-merged (🟢 safe) — summary only
```
✅ *Замержено автоматично (safe):*

<blockquote expandable>
📝 *5 нових статей:*
• 🇮🇳 India — Monsooned Malabar, Chikmagalur
• 🇵🇬 Papua New Guinea — Highland organic, Sigri
• 🇹🇿 Tanzania — Kilimanjaro, Peaberry
• 🇨🇩 DRC Congo — Kivu, emerging specialty
• 🇪🇨 Ecuador — Galápagos, Loja
</blockquote>

<blockquote expandable>
🌐 *43 UK переклади:*
• brazil.mdx ✅
• colombia.mdx ✅
• ethiopia.mdx ✅
...всі 43
</blockquote>

🔗 dev.yourwave.uk
```

NOTE: Use `<blockquote expandable>` for ANY list > 5 items. Summary visible, details collapsed.

#### Storybook Prototypes (🟡 moderate)
```
🎨 *Storybook прототипи:*
• BundleBuilder — 3-step flow
• Dashboard — modular layout
• ProductGrid — filters + cards
• OrderList — compact statuses

🔗 Переглянути: storybook.yourwave.uk
[👍 Подобається] [✏️ Є правки] [🗑 Переробити]
```

#### Platform Spec (🟡 moderate)
```
📋 *Platform v2 Architecture Spec*
Написано на основі 20 discovery Q&A.
Модулі: Atlas, BundleBuilder, Shop, CRM, Inventory, IntegrationHub, Auth

[📖 Прочитати] [👍 Затвердити] [✏️ Є правки]
```

### Approval Rules

1. **🟢 Safe** (translations, articles) — **AUTO-MERGE**. Мержити автоматично під час wrap-up, не питати. Вранці тільки повідомити: "✅ Замержено: 43 переклади, 5 статей"
2. **🟡 Moderate** (research, prototypes, specs) — потребують approval. Кожен має окреме повідомлення з кнопками
3. **🔴 Ground-shifting** — тільки proposal, не виконувати. Детальний документ + окреме обговорення
4. **Кожен research** має summary 3-5 пунктів + рекомендацію + кнопку "Детальніше" (відкриває повний документ)
5. **Deep links** — всюди де є візуальний результат (Storybook, dev site)
6. **Одне рішення за раз** — не валити все в одне повідомлення. Окремі категорії = окремі рішення

### User Response Handling

- 👍 / "Прийняти" → merge changes, update wind rose
- 📖 / "Детальніше" → send full research doc or Storybook link
- ✏️ / "Переробити" → create task for next Night Shift
- 🗑 / "Відхилити" → revert changes on branch, note in learning.json
- 👀 / "Переглянути" → send individual items one by one with approve/reject per item
- No response → remind at 12:00 health check

## Execution Loop (Continuous 3-Phase)

### Phase 1: Planned Work

1. **Read** plan.json
2. **Check stop conditions:**
   - Current time > deadline → Phase 3 (wrap-up)
   - consecutive_failures >= max → HALT
   - File `nightshift/STOP` exists → HALT
3. **Spawn parallel agents** — Friday + Alfred work simultaneously on planned tasks
   - Batch 4-7 agents at a time for maximum throughput
   - Each agent picks a pending task by priority (critical → high → normal)
4. **Quality gates** — validate each task output
5. **Record results** — update plan.json
6. **All planned tasks done?** → transition to Phase 2
7. **More tasks remaining?** → schedule next batch

### Phase 2: Autonomous Improvement

Triggered when all planned tasks are complete AND time < deadline.

1. **Friday generates improvement tasks:**
   - Scan codebase for lint issues, type errors, broken links
   - Check docs alignment (README vs actual state)
   - Find stale/outdated documentation in Obsidian vault
   - Review existing content quality (articles, SEO)
   - Each finding → create task → execute → record
2. **Alfred generates research tasks:**
   - Research competitors, market trends
   - Analyze project metrics
   - Generate ideas and briefs for future work
   - Each finding → write to results dir
3. **Both bots loop:** generate → execute → check deadline → repeat
4. **Transition to Phase 3** when time approaches deadline (30 min buffer)

### Phase 3: Wrap-up

Triggered 30 minutes before deadline, or when both bots have nothing to improve.

1. Final `astro build` + `storybook build` — verify everything builds
2. Run full test suite
3. Commit any uncommitted changes
4. Rebuild & restart Cloudflare Tunnels (storybook.yourwave.uk, dev.yourwave.uk)
5. Verify tunnel URLs respond (curl -I)
6. **Generate morning approval data** → `nightshift/reports/YYYY-MM-DD-approval.json`:
   - Per-category summaries (research, articles, translations, prototypes, specs)
   - Per-item: title, 3-5 bullet summary, recommendation, approval_tier, deep_link
   - Build status, test results, tunnel status
7. Write shift summary to session logs
8. Update learning.json with shift stats
9. Send wrap-up confirmation to chat (sender: "Friday")

### Stop Conditions (all phases)
- Current time > deadline (06:00) → wrap up immediately
- consecutive_failures >= 3 → HALT
- `nightshift/STOP` file exists → HALT
- Build broken and unfixable → revert last change, HALT

## Quality Gates

After each task completes, run validation before marking as "done":

### By Task Type

| Type | Quality Checks |
|------|---------------|
| `translate` | Frontmatter has `locale` + `translationOf`, build passes, word count > 200, all internal links valid |
| `write_article` | Frontmatter complete (all required fields), build passes, word count > 500, has 3+ images, has 3+ inline links |
| `improve_article` | Build passes, diff is non-empty, no broken links introduced |
| `refactor` | Build passes, all tests pass, no new lint errors |
| `test` | Tests pass, coverage didn't decrease |
| `research` | Output file exists and has > 200 words |
| `review` | Review file exists with actionable items |
| `warmup` | Build passes, git clean |

### Gate Failure Handling
- If quality gate fails → count as task failure (triggers retry logic)
- Quality gate results recorded in task's `quality_gate` field
- Summary report shows which checks passed/failed

## Circuit Breakers

| Breaker | Threshold | Action |
|---------|-----------|--------|
| Warm-up failure | 1 attempt | HALT entire shift immediately |
| Task retry limit | 2 attempts per task | Mark task `failed`, skip to next |
| Consecutive failure limit | 3 in a row | HALT entire shift, write error summary |
| Time deadline | 06:00 local | Stop after current task, write summary |
| Manual kill | `nightshift/STOP` file exists | Stop immediately, write summary |
| Plan missing | No plan.json for today | Skip, do nothing |
| Build broken | Build fails after task | Revert task changes, mark failed |

## Priority-Based Task Selection

Tasks are picked in this order:
1. Priority: `critical` first, then `high`, then `normal`
2. Within same priority: lowest `id` first
3. Skip tasks with status != `pending`

This ensures blocking/important work is done first, even if easier tasks exist.

## Difficulty Estimation & Planning

During planning phase:
1. Estimate each task's difficulty (S/M/L) and minutes
2. Calculate total estimated time
3. Compare against available shift time (23:30–06:00 = 6.5 hours)
4. If total estimate > 5 hours → warn user, suggest cutting scope
5. Rule of thumb: plan for 60% of available time (buffer for retries, overhead)

Estimation guidelines:
| Difficulty | Minutes | Example |
|-----------|---------|---------|
| S | 2-5 | Build check, single frontmatter fix, add one image |
| M | 5-10 | Translate article, write tests for one module, add references |
| L | 10-20 | Write new article from scratch, multi-file refactor, research task |

## Progress Notifications

When approximately 50% of tasks are completed (or at ~02:00-03:00, whichever comes first):
- Send a quiet notification to chat:
  ```
  🌙 Night Shift Progress — 3/6 tasks done
  ✅ warmup, translate ethiopia, translate coffee-belt
  ⏳ Next: translate washed-process
  ```
- Flag: `progress_notified: true` in plan.json to avoid duplicates

## Learning Loop

After each shift, record stats in `/workspace/group/nightshift/learning.json`:

```json
{
  "shifts": [
    {
      "date": "2026-03-22",
      "planned": 6,
      "completed": 5,
      "failed": 1,
      "estimated_total_min": 35,
      "actual_total_min": 42,
      "accuracy": 0.83,
      "by_type": {
        "translate": { "count": 4, "avg_min": 5.2, "success_rate": 1.0 },
        "warmup": { "count": 1, "avg_min": 2, "success_rate": 1.0 },
        "refactor": { "count": 1, "avg_min": 0, "success_rate": 0.0 }
      }
    }
  ],
  "aggregated": {
    "total_shifts": 1,
    "avg_completion_rate": 0.83,
    "avg_accuracy": 0.83,
    "type_benchmarks": {
      "translate": { "avg_min": 5.2, "success_rate": 1.0 },
      "warmup": { "avg_min": 2, "success_rate": 1.0 }
    }
  }
}
```

During planning, use `aggregated.type_benchmarks` for more accurate time estimates.
After 5+ shifts, estimation accuracy should improve significantly.

## Planning Phase (21:00)

The planning cron:

1. Check if user has pending TODOs or known tasks
2. Read `learning.json` for estimation benchmarks
3. Send buttons to chat:
   ```
   "🌙 Night Shift Planning — що робимо сьогодні?"

   [Переклади (UK)] [Нові статті] [Рефакторинг] [Своє завдання]
   ```
4. If user responds → build plan.json from their choice with difficulty estimates
5. If no response by 23:00 → Jarvis picks autonomously from:
   - Pending items in project TODOs
   - Known technical debt
   - Translation backlog
   - Content improvements
6. Write plan.json and confirm in chat with estimated completion time

## Result Files

Each task writes its result to:
`/workspace/group/nightshift/results/YYYY-MM-DD/task-{id}-{type}.md`

```markdown
# Task 1: Translate ethiopia.mdx

Status: completed
Duration: 4m 32s (estimated: 5m)
Priority: normal
Difficulty: M
Files changed: src/content/atlas/uk/ethiopia.mdx (created)

## Quality Gate
- [x] Frontmatter has locale + translationOf
- [x] Build passes
- [x] Word count > 200 (1,247 words)
- [x] Internal links valid

## Summary
Translated ethiopia.mdx to Ukrainian. 1,247 words.
All frontmatter updated (locale: uk, translationOf: en/ethiopia).
Internal links updated to /uk/atlas/... paths.
```

## Summary Report

Written to `/workspace/group/nightshift/logs/YYYY-MM-DD.md` and sent to chat:

```markdown
# 🌙 Night Shift Report — 2026-03-22

Shift: 23:30 — 03:45 (4h 15m)
Branch: nightshift/2026-03-22
Status: completed (all tasks done)

## Completed (5/6)
✅ [S] Warm-up — build + env check (2m)
✅ [M] Translated ethiopia.mdx → UK (5m, est: 5m)
✅ [M] Translated coffee-belt.mdx → UK (4m, est: 5m)
✅ [M] Translated washed-process.mdx → UK (6m, est: 5m)
✅ [M] Translated arabica.mdx → UK (4m, est: 5m)

## Failed (1/6)
❌ [L] Refactor header component — quality gate failed (build broken after change)

## Quality Gates: 5/5 passed (100% on completed tasks)
## Estimation Accuracy: 88% (21m actual vs 24m estimated)

## Files Changed
- 4 new files in src/content/atlas/uk/
- Branch diff: +4,892 lines

## To Merge
git checkout main && git merge nightshift/2026-03-22

## Next Shift Suggestions
- Continue UK translations (16 remaining)
- Retry: header refactor (needs different approach)
```

## Task Types

Predefined task types with prompt templates:

| Type | Description | Difficulty | Quality Checks | Bot | Agent (`subagent_type`) |
|------|-------------|-----------|----------------|-----|------------------------|
| `warmup` | Build + environment check | S (2min) | Build passes, git clean | Friday | `general-purpose` |
| `write_article` | Write new atlas article from brief | L (10min) | Frontmatter, build, word count, images, links | Friday | `Content Creator` |
| `translate` | Translate MDX article to target locale | M (5min) | Frontmatter, build, word count, links | Friday | `Technical Writer` |
| `improve_article` | Enhance existing article (SEO, links, quality) | M (5min) | Build, non-empty diff, no broken links | Friday | `SEO Specialist` |
| `review` | Code review + suggestions file | M (5min) | Review file with actionable items | Friday | `Code Reviewer` |
| `code_lint` | Fix lint/type errors found in codebase | S (3min) | `astro check` clean, build passes | Friday | `Code Reviewer` |
| `refactor` | Code refactoring task | L (15min) | Build, tests pass, no new lint errors | Friday | `Software Architect` |
| `test` | Write or fix tests | M (8min) | Tests pass, coverage maintained | Friday | `Frontend Developer` |
| `doc_audit` | Find stale/outdated docs, READMEs, ideas | M (5min) | Report file with findings | Friday | `Technical Writer` |
| `doc_fix` | Update outdated documentation | S (3min) | Doc updated, no broken links | Friday | `Technical Writer` |
| `research` | Web research + write findings | M (8min) | Output file > 200 words | Alfred | `Trend Researcher` |
| `seo_review` | Analyze article SEO + suggest improvements | M (5min) | Report with actionable items | Alfred | `SEO Specialist` |
| `competitor_scan` | Research competitors/trends | M (8min) | Report > 300 words with sources | Alfred | `Trend Researcher` |
| `idea_brief` | Write brief for future work | M (5min) | Brief file with scope + priority | Alfred | `Product Manager` |

### Agent Selection — Autonomous

Bots choose the best `subagent_type` AND `model` for each task themselves.

**166+ specialized agents** available (Code Reviewer, SEO Specialist, Technical Writer, Trend Researcher, Software Architect, Frontend Developer, Product Manager, etc.). Pick the one that best fits the task.

**Model selection by complexity:**
| Model | When to use | Examples |
|-------|-------------|---------|
| `haiku` | Simple/mechanical, low-risk | lint fix, typo, warmup, single file edit |
| `sonnet` | Standard tasks (DEFAULT) | article, translation, review, research |
| `opus` | Complex, high-stakes | architecture, multi-file refactor, deep analysis |

Rule: no hardcoded mapping — bots decide both specialist and effort level autonomously.

Example:
```
Agent(subagent_type="Code Reviewer", model="sonnet", prompt="Review src/lib/content.ts...")
Agent(subagent_type="Technical Writer", model="haiku", prompt="Fix typo in README.md...")
Agent(subagent_type="Software Architect", model="opus", prompt="Refactor content system...")
```

## Orchestrator Role — Jarvis as Chief Archivist

Jarvis is NOT a passive cron launcher. During the shift, Jarvis is the *librarian* — the strategic brain that:

1. **Dispatches** — assigns tasks to Friday/Alfred based on role fit
2. **Monitors** — analyzes results as they come in, catches patterns
3. **Regroups** — if a bot finishes early or hits a wall, reassigns work
4. **Groups** — clusters results (e.g., "3 doc fixes" → one commit message)
5. **Prioritizes** — adjusts task order mid-shift based on what's been learned
6. **Archives** — writes structured summaries, updates project docs, tracks stats

Friday & Alfred are the *skilled workers*. They're smart, autonomous executors.
Jarvis is the *architect* — sees the whole floor, knows what's built and what's missing.

## Project Wind Rose — Full Business Process Map

The Wind Rose is NOT just scores — it's a *complete map of the YourWave business process* with current state, gaps, options, and dependencies. Bots use it to find where the project is weakest and make informed decisions about what to work on.

### Value Chain Stages

```
☕ SOURCING → 🔥 ROASTING → 📦 PRODUCT → 🎨 BRAND → 📝 CONTENT
                                                          │
💰 FINANCE ← ⚖️ LEGAL/OPS ← 📊 ANALYTICS ← 📈 MARKETING ← 🛒 PLATFORM
                                                          │
                                                     🤝 COMMUNITY
```

### Stage Details

Each stage has: `status` (0-100), `state` (what exists), `gaps` (what's missing), `options` (available paths), `blockers`, `dependencies`.

| # | Stage | Status | Current State | Key Gaps | Options |
|---|-------|--------|---------------|----------|---------|
| 1 | ☕ **Sourcing** | 15% | 4 suppliers identified (Jaká káva, Algrano, Trabocca, Nordic Approach). No contact made | No samples, no pricing, no relationship | A) Jaká káva (min 5kg, easy start) B) Algrano (direct trade, story-rich) C) Both — test two origins |
| 2 | 🔥 **Roasting** | 10% | 3 contract roasters identified (Chroast, Industra, The Miners). No contact made | No MOQ, no pricing, no tasting | A) Email all 3, compare B) Start with Chroast (Prague, easy logistics) C) Industra (experience, quality) |
| 3 | 📦 **Product** | 20% | 5 product lines named, formats defined (200g, drip bags, mix box). No physical product | No packaging design, no labeling, no samples, no pricing | A) Start with 2 SKU (Colombia 200g + Starter Box) B) 3-5 SKU from day one |
| 4 | 🎨 **Brand** | 25% | Name ✅, tagline ✅, tone of voice ✅, product line names ✅ | No logo, no visual identity, no moodboard, no design tool chosen | A) Figma + DIY B) Hire designer (Fiverr/99designs) C) AI-assisted (Midjourney + Figma) |
| 5 | 📝 **Content** | 65% | Coffee Atlas: 44 EN articles, 1 UK translation. Astro site built, CI green | 43 translations missing, no CZ content, no video content, some SEO gaps | A) Complete UK translations B) Start CZ content C) Video-first strategy |
| 6 | 🛒 **Platform** | 15% | Tech stack chosen (Shopify + Klaviyo). Domain not registered | No store, no domain, no bundle builder, no payment flow | A) Shopify trial now B) Wait for brand identity C) Start with landing page only |
| 7 | 📈 **Marketing** | 5% | Strategy documented, channels identified | No Instagram, no social presence, no email list, 0 audience | A) Instagram first B) TikTok first C) Email capture via Atlas D) All three |
| 8 | 📊 **Analytics** | 30% | GA4 + Shopify planned. Hotjar identified | No tracking implemented, no baseline data | A) GA4 on Atlas now B) Wait for Shopify launch |
| 9 | ⚖️ **Legal/Ops** | 10% | Requirements researched (S.R.O., SZPI, HACCP, VAT) | Nothing registered, no storage space, no HACCP plan | A) Register S.R.O. now B) Wait 2 months before launch (planned) |
| 10 | 💰 **Finance** | 20% | Budget €5-15k, unit economics modeled, 6 grants identified | No grant applications, no financial model spreadsheet, no cash flow plan | A) Apply EIT Jumpstarter (no company needed) B) CzechInvest consult C) Bootstrap only |
| 11 | 🤝 **Community** | 0% | Events identified (Prague Coffee Festival) | No partnerships, no events, no community channels | A) Pop-up at festival B) Collab with local café C) Online community first |

### Dependencies (what blocks what)

```
Brand (logo) ──blocks──→ Product (packaging) ──blocks──→ Platform (store)
                                                            │
Legal (S.R.O.) ──blocks──→ SZPI ──blocks──→ Sales           │
                                                            │
Sourcing ──blocks──→ Roasting ──blocks──→ Product samples   │
                                                            │
Content (Atlas) ──enables──→ Marketing (SEO traffic) ──→ Email list ──→ First customers
```

### Critical Path to First Sale

```
1. Brand identity (logo, visual) ← CAN START NOW
2. Domain registration ← CAN DO NOW
3. Instagram launch ← CAN DO NOW (builds audience pre-launch)
4. Contact roasters + suppliers ← CAN DO NOW
5. First samples + tasting ← NEEDS #4
6. Packaging design ← NEEDS #1
7. Shopify store ← NEEDS #1, #6
8. S.R.O. + SZPI ← 2 months before launch
9. First sale ← NEEDS all above
```

### How Bots Use the Wind Rose

**Phase 2 autonomous work:**
1. Bot reads wind-rose.json → finds weakest stages
2. Filters to stages *within its domain*:
   - **Friday:** Content, Platform (code), Brand (design assets), Analytics (implementation)
   - **Alfred:** Sourcing (research), Marketing (strategy), Finance (grants), Community (opportunities)
3. For each gap → checks if it's *actionable tonight* (no blockers, within bot's capability)
4. Generates tasks → applies approval tier → executes or writes proposal
5. Updates wind-rose.json with new scores and notes

**Key rule:** Bots should focus on *unblocked* gaps. If a stage is blocked by something physical (e.g., "need to taste samples"), skip to next weakest.

### Wind Rose State

Stored in `/workspace/group/nightshift/wind-rose.json`:

```json
{
  "last_scan": "2026-03-23T02:30:00",
  "stages": {
    "sourcing": {
      "score": 15,
      "state": "4 suppliers identified, no contact made",
      "gaps": ["no samples", "no pricing", "no relationship"],
      "options": [
        { "id": "A", "label": "Jaká káva (easy start, 5kg min)", "effort": "S", "blocked_by": null },
        { "id": "B", "label": "Algrano (direct trade, story-rich)", "effort": "M", "blocked_by": null }
      ],
      "blockers": [],
      "bot_actionable": { "friday": false, "alfred": true }
    },
    "roasting": {
      "score": 10,
      "state": "3 roasters identified, no contact",
      "gaps": ["no MOQ info", "no pricing", "no tasting"],
      "options": [],
      "blockers": [],
      "bot_actionable": { "friday": false, "alfred": true }
    },
    "product": {
      "score": 20,
      "state": "5 lines named, formats defined",
      "gaps": ["no packaging", "no labels", "no samples"],
      "options": [],
      "blockers": ["brand.logo", "roasting.agreement"],
      "bot_actionable": { "friday": false, "alfred": false }
    },
    "brand": {
      "score": 25,
      "state": "Name, tagline, tone of voice done",
      "gaps": ["no logo", "no visual identity", "no moodboard"],
      "options": [
        { "id": "A", "label": "Figma + DIY", "effort": "L", "blocked_by": null },
        { "id": "B", "label": "Hire designer", "effort": "M", "blocked_by": null }
      ],
      "blockers": [],
      "bot_actionable": { "friday": true, "alfred": true }
    },
    "content": {
      "score": 65,
      "state": "44 EN articles, 1 UK translation, Astro site, CI green",
      "gaps": ["43 UK translations", "no CZ content", "SEO optimization"],
      "options": [],
      "blockers": [],
      "bot_actionable": { "friday": true, "alfred": true }
    },
    "platform": {
      "score": 15,
      "state": "Stack chosen, nothing built",
      "gaps": ["no domain", "no store", "no payments"],
      "options": [
        { "id": "A", "label": "Shopify trial now", "effort": "M", "blocked_by": null },
        { "id": "B", "label": "Landing page only", "effort": "S", "blocked_by": null }
      ],
      "blockers": ["brand.logo"],
      "bot_actionable": { "friday": true, "alfred": false }
    },
    "marketing": {
      "score": 5,
      "state": "Strategy documented, 0 presence",
      "gaps": ["no Instagram", "no email list", "no audience"],
      "options": [],
      "blockers": [],
      "bot_actionable": { "friday": false, "alfred": true }
    },
    "analytics": {
      "score": 30,
      "state": "Tools chosen, nothing implemented",
      "gaps": ["no tracking on Atlas", "no baseline data"],
      "options": [],
      "blockers": [],
      "bot_actionable": { "friday": true, "alfred": false }
    },
    "legal_ops": {
      "score": 10,
      "state": "Requirements researched",
      "gaps": ["no S.R.O.", "no SZPI", "no storage"],
      "options": [],
      "blockers": [],
      "bot_actionable": { "friday": false, "alfred": true }
    },
    "finance": {
      "score": 20,
      "state": "Budget set, 6 grants identified",
      "gaps": ["no applications", "no financial model", "no cash flow"],
      "options": [
        { "id": "A", "label": "EIT Jumpstarter (no company needed)", "effort": "L", "blocked_by": null },
        { "id": "B", "label": "CzechInvest consult (free)", "effort": "S", "blocked_by": null }
      ],
      "blockers": [],
      "bot_actionable": { "friday": false, "alfred": true }
    },
    "community": {
      "score": 0,
      "state": "Events identified, nothing else",
      "gaps": ["no partnerships", "no events", "no community"],
      "options": [],
      "blockers": [],
      "bot_actionable": { "friday": false, "alfred": true }
    }
  },
  "overall_score": 20,
  "critical_path": ["brand.logo", "domain", "instagram", "contact_roasters", "samples"],
  "history": []
}
```

## Change Approval Tiers

Not all night shift changes are equal. Three tiers control what gets auto-applied vs. needs human review:

### 🟢 Tier 1: Auto-approve (safe, low-risk)

Applied directly, reported in morning summary.

- Typo fixes (code comments, docs)
- Lint/type error fixes
- Adding missing alt texts, meta tags
- Updating stale dates/versions in docs
- Adding test cases (that pass)
- Fixing broken internal links

### 🟡 Tier 2: Flag for review (moderate impact)

Applied on branch, highlighted in morning review with diff preview.

- New/edited articles or translations
- Code refactoring (< 3 files)
- SEO changes (meta, slugs, redirects)
- Documentation rewrites
- Dependency updates
- Adding new utility functions

### 🔴 Tier 3: Require approval (ground-shifting)

**NOT executed during night shift.** Written as proposals to `/workspace/group/nightshift/proposals/YYYY-MM-DD/`.

- Architecture changes (new patterns, folder restructure)
- New features or components
- Deleting files or removing functionality
- Changing build/deploy config
- Any change affecting user-facing URLs
- Database schema changes
- New third-party integrations
- Changes to Night Shift system itself

### Morning Review Flow

At 07:27 (part of digest), or when user wakes up:

```
🌙 *Night Shift Review — 2026-03-23*
Branch: `nightshift/2026-03-23`

🟢 *Auto-applied (12 changes):*
• 5 lint fixes, 3 doc updates, 2 link fixes, 2 new tests

🟡 *Flagged for review (4 changes):*
1. New article: "Costa Rica — Volcanic Terroir" (1,247 words)
2. Refactored content.ts utility functions
3. Updated SEO meta for 8 articles
4. Translated 2 articles to UK

🔴 *Proposals (needs your OK):*
1. 📋 Restructure /atlas routes to /coffee-atlas
2. 📋 Add Cloudflare R2 image pipeline

[✅ Merge All Flagged] [👀 Show Diffs] [❌ Reject All]
```

User can:
- **Merge All** → `git merge nightshift/2026-03-23`
- **Show Diffs** → detailed diff per flagged change
- **Cherry Pick** → select specific changes to keep
- **Reject** → `git branch -D nightshift/2026-03-23`

For 🔴 proposals:
- Each proposal is a separate markdown file with: problem, proposed solution, impact analysis, rollback plan
- User reviews at their pace, approves → becomes a planned task for next shift

## Safety Rules

1. **No deployments** — never push to production during night shift
2. **No destructive git** — no force push, reset, or branch deletion (except own nightshift branch on rollback)
3. **No external API calls** that cost money (except Claude itself)
4. **No email sending** — only drafts if needed
5. **Build verification** — run build after code changes, revert if broken
6. **Atomic tasks** — each task should be independently valuable; partial completion is OK
7. **Branch isolation** — all work on `nightshift/YYYY-MM-DD` branch, never commit to main
8. **Warm-up first** — always verify environment before real work
