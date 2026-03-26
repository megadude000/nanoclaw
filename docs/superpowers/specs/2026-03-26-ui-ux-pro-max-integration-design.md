---
title: UI/UX Pro Max Skill Integration
date: 2026-03-26
status: approved
---

# UI/UX Pro Max Skill Integration

## Problem

When working on YW_Core (Coffee Atlas — Astro + React + Tailwind + shadcn/ui), there is no consistent design intelligence applied across the three usage modes:
1. Claude Code opened directly in YW_Core
2. Claude Code opened in the nanoclaw directory
3. nanoclaw container agents (Telegram/WhatsApp messages)

Design decisions are made ad-hoc with no shared palette, typography, accessibility baseline, or component conventions.

## Solution

Install the `nextlevelbuilder/ui-ux-pro-max-skill` globally into `~/.claude/skills/`. nanoclaw's existing `container-runner.ts` (lines 172–185) already syncs `~/.claude/skills/` into every container agent at startup — so all three usage modes are covered with no code changes.

YW_Core gets a project-scoped `design-system/MASTER.md` that persists Coffee Atlas design tokens across sessions, making the generic skill project-aware.

## Architecture

```
~/.claude/ui-ux-pro-max-skill/       ← git clone (updatable source)
    .claude/skills/
        ui-ux-pro-max/SKILL.md       ← main design intelligence
        design/SKILL.md              ← logo, CIP, banners, icons
        design-system/SKILL.md       ← design system generation
        ui-styling/SKILL.md          ← UI styling guides
        brand/SKILL.md               ← brand identity
        banner-design/SKILL.md       ← banner design
        slides/SKILL.md              ← presentations

~/.claude/skills/                    ← symlinks → source repo sub-skills
    ui-ux-pro-max/  →  ../ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/
    design/         →  ../ui-ux-pro-max-skill/.claude/skills/design/
    design-system/  →  (etc.)
    ui-styling/     →  ...
    brand/          →  ...
    banner-design/  →  ...
    slides/         →  ...

nanoclaw/container-runner.ts         ← unchanged (already syncs ~/.claude/skills/)

YW_Core/
    .claude/
        CLAUDE.md                    ← invoke ui-ux-pro-max on UI/design tasks
    design-system/
        MASTER.md                    ← Coffee Atlas design tokens (persisted)
```

## Triggering

No hooks required. The `using-superpowers` skill checks all skills in `~/.claude/skills/` at session start and invokes matching ones when tasks qualify. `ui-ux-pro-max` matches on: component creation, layout, styling, color, typography, accessibility, animation, responsive design, shadcn/ui, Tailwind.

`YW_Core/.claude/CLAUDE.md` reinforces this with an explicit instruction to load `design-system/MASTER.md` and invoke `ui-ux-pro-max` for all UI/frontend work.

## Components

### 1. Skill source clone
- Location: `~/.claude/ui-ux-pro-max-skill/`
- Method: `git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git`
- Update: `git -C ~/.claude/ui-ux-pro-max-skill pull`

### 2. Global skill symlinks
- 6 directory symlinks in `~/.claude/skills/`
- Relative paths so they survive home dir moves
- Covers: case 1 (YW_Core direct), case 2 (nanoclaw dir)

### 3. Container coverage
- Zero changes needed
- nanoclaw's `container-runner.ts` already copies `~/.claude/skills/` into each group's container session at line 174–185
- Covers: case 3 (Telegram/WhatsApp agent)

### 4. YW_Core `.claude/CLAUDE.md`
- Instructs Claude to invoke `ui-ux-pro-max` skill for UI/frontend tasks
- References `design-system/MASTER.md` as project design context

### 5. YW_Core `design-system/MASTER.md`
- Coffee Atlas design tokens: palette, typography, spacing, dark/light mode
- Populated from YW_Core's existing `components.json` and `src/styles/global.css`
- Persists across sessions — updated as design evolves

## Scope Excluded
- No changes to nanoclaw source code
- No container image rebuild
- No hooks or settings.json changes
- Other sub-skills (slides, banner-design) installed but not prioritized for YW_Core

## Update Path
```bash
git -C ~/.claude/ui-ux-pro-max-skill pull
# Symlinks pick up changes immediately — no reinstall needed
```
