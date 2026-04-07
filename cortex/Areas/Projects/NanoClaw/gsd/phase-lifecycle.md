---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  GSD phase lifecycle - research, plan, execute, verify stages, PLAN.md
  structure, SUMMARY.md, goal-backward verification
project: nanoclaw
tags:
  - nanoclaw
  - gsd
  - phase-lifecycle
  - verification
  - planning
  - summary
created: 2026-03-31T00:00:00.000Z
source_hash: c5e42d69947d960bbc1a9f1e5970faf0b2fe8787c1bf5750ade2fa4631c2338b
embedding_model: text-embedding-3-small
---

# GSD — Phase Lifecycle

## 4-Stage Lifecycle

Each GSD phase moves through four stages: Research → Plan → Execute → Verify.

### Stage 1: Research

Before planning any non-trivial phase, research is captured in `RESEARCH.md`. The research stage addresses: what existing tools/libraries solve this problem, what pitfalls to watch for, what prior art exists, and what the stack choices imply for future phases. Research findings are referenced in the CONTEXT.md to guide planning decisions.

Not all phases require a separate research artifact — small phases where the approach is already clear skip to CONTEXT.

### Stage 2: Plan (CONTEXT.md + PLAN.md)

The CONTEXT.md defines the phase boundary (what is and is not in scope), implementation decisions (captured as D-01, D-02, etc. with explicit rationale), and canonical references (prior phase decisions that downstream phases must read).

The PLAN.md contains:
- `must_haves.truths` — observable behavioral truths that must be verifiable after execution (e.g., "checkStaleness returns entries whose updated date exceeds their TTL")
- `must_haves.artifacts` — specific files that must exist, with what they provide and any minimum size constraints
- `must_haves.key_links` — import relationships that must exist between files (verified via grep/regex pattern)
- `depends_on` — other plans in the same phase that must complete first
- `autonomous: true/false` — whether the plan can be executed by an agent without human checkpoints

The PLAN.md is explicit about success criteria rather than just listing tasks. The distinction matters: tasks can be completed without achieving the goal. Success criteria are observable states.

### Stage 3: Execute

During execution, each task is committed atomically. The SUMMARY.md is written after execution, not before. It captures:
- What was actually built (which files, which commits)
- Decisions made during execution (where the PLAN.md gave Claude discretion)
- Deviations from the plan (auto-fixed issues, scope changes, skipped items)
- Known stubs or deferred work
- A self-check section confirming artifacts are present

Commits reference the phase and plan number in the subject line: `feat(16-01): create embedEntry pipeline`.

### Stage 4: Verify (VERIFICATION.md)

The VERIFICATION.md uses goal-backward analysis: start from the phase goal, not from the task list. The question is not "were all tasks completed?" but "does the observable state match what the phase was supposed to achieve?"

Format: each "Observable Truth" from the PLAN.md is either VERIFIED (with specific evidence — file path, line number, grep command) or FAILED (with what was found instead). A phase is only marked complete when all must-have truths are verified.

Why goal-backward: it's easy to complete all tasks and still miss the goal. A task like "implement checkStaleness" can be completed incorrectly. The verification stage requires demonstrating the behavior, not just the code's presence.

## SUMMARY.md Structure (Frontmatter)

Each SUMMARY.md has a structured YAML frontmatter block:
```yaml
phase: 16-embedding-pipeline
plan: 01
subsystem: cortex
tags: [openai, qdrant, embeddings]
provides: [list of what this plan provides to downstream phases]
affects: [list of downstream phases that depend on this]
key-files:
  created: [list]
  modified: [list]
key-decisions: [list of decisions made during execution]
patterns-established: [reusable patterns documented here]
requirements-completed: [requirement IDs from PLAN.md]
duration: 10min
completed: 2026-03-30
```

This frontmatter makes the SUMMARY machine-readable for dependency tracking and planning future phases.

## Dependency Graph Convention

Each PLAN.md and SUMMARY.md includes a dependency graph section:
- `requires`: what prior phases provide that this plan depends on
- `provides`: what this plan provides to downstream phases
- `affects`: which downstream phases will import/use what this plan produces

This makes phased development explicit: Phase 17 knows it needs Phase 14 (schema) and Phase 16 (embedder), and what specifically it needs from each.
