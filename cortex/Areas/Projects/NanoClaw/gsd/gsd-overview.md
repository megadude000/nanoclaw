---
cortex_level: L30
confidence: high
domain: nanoclaw
scope: >-
  GSD (Get Shit Done) phase-based development system overview - milestones,
  phases, artifact types, enforcement rule
project: nanoclaw
tags:
  - nanoclaw
  - gsd
  - workflow
  - phases
  - planning
  - development-process
created: 2026-03-31T00:00:00.000Z
source_hash: 11ca773010a8cc134b4082a0da2579d9001f9abd3dfb0b391052b32a274decac
embedding_model: text-embedding-3-small
---

# GSD — Phase-Based Development System

## What GSD Is

GSD ("Get Shit Done") is the structured development workflow used for all NanoClaw feature work. It provides a consistent structure for planning and executing code changes, producing artifacts that document what was built, why, and what decisions were made. The primary purpose is ensuring that every non-trivial change is planned before implemented, and that decisions are captured in a form that makes the codebase legible to future agents and human reviewers.

## Structure: Milestone → Phases → Plans

Work is organized in a three-level hierarchy:

**Milestones**: broad goals (e.g., "Cortex v3.0 — knowledge base infrastructure"). A milestone spans multiple phases.

**Phases**: discrete, deployable units of work within a milestone. Each phase is numbered sequentially and has a name (`{N}-{name}/`). Phase 14 = `14-cortex-schema-standard`. Phases are meant to be individually completable and verifiable.

**Plans**: multiple plans can exist within a phase when work is complex enough to split. Each plan produces one or more commits. `16-01-PLAN.md`, `16-02-PLAN.md` — Plan 01 builds the foundation, Plan 02 wires it into the watcher.

## Directory Structure

All GSD artifacts live under `.planning/phases/{N}-{name}/`:

```
.planning/phases/
  14-cortex-schema-standard/
    14-CONTEXT.md         — Phase scope, decisions, canonical refs, code context
    14-RESEARCH.md        — Research findings before planning
    14-01-PLAN.md         — Execution plan for Plan 01
    14-01-SUMMARY.md      — What was built, decisions, deviations (written after execution)
    14-VERIFICATION.md    — Goal-backward analysis: was the goal actually achieved?
    14-VALIDATION.md      — User acceptance testing results (sometimes)
    14-DISCUSSION-LOG.md  — Planning discussion and decision rationale
```

## Artifact Types

| File | Written By | Content |
|------|-----------|---------|
| `CONTEXT.md` | Planning session | Phase boundary, implementation decisions, canonical refs, code context. The most important artifact — defines exactly what will be built and what constraints apply. |
| `RESEARCH.md` | Research phase | Findings about stack choices, prior art, pitfalls. Written before planning. |
| `PLAN.md` | Planning session | Explicit tasks, success criteria (`must_haves.truths`), artifacts to produce, key_links to verify. |
| `SUMMARY.md` | After execution | What was built, which commits, decisions made, deviations from plan. |
| `VERIFICATION.md` | After execution | Goal-backward analysis: does the observable state match the phase goal? Not just "tasks done". |
| `VALIDATION.md` | After user testing | Human acceptance testing results. |

## Enforcement Rule

The CLAUDE.md enforces GSD before file edits:

> Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

GSD entry points:
- `/gsd:quick` — small fixes, doc updates, ad-hoc tasks (produces minimal artifacts)
- `/gsd:debug` — investigation and bug fixing
- `/gsd:execute-phase` — planned phase work (full PLAN → SUMMARY → VERIFY cycle)

Direct repo edits outside a GSD workflow are only allowed when the user explicitly asks to bypass it. This rule exists because bypassed planning means no SUMMARY, which means the decision context is lost.

## Why Phase Numbers Are Permanent

Phase numbers never get reused or renumbered. If Phase 14 was about cortex schema and was completed, Phase 14 is forever "cortex schema". New phases get new numbers. This makes references to "Phase 14" in git commit messages and downstream CONTEXTs permanently meaningful.
