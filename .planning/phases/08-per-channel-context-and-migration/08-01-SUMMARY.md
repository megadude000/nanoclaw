---
phase: 08-per-channel-context-and-migration
plan: 01
subsystem: config
tags: [discord, templates, claude-md, cortex, channel-context]

# Dependency graph
requires:
  - phase: 04-group-registration
    provides: createGroupStub() function and auto-registration guard
  - phase: 05-server-structure-management
    provides: discord-server.json with 8 channel definitions
provides:
  - 8 channel-specific CLAUDE.md templates in config/channel-templates/
  - Enhanced createGroupStub() that selects templates by channel name
  - Cortex knowledge references in bugs, yw-tasks, main, and agents templates
affects: [08-02, agent-context, discord-channels]

# Tech tracking
tech-stack:
  added: []
  patterns: [channel-template-selection, cortex-directory-references]

key-files:
  created:
    - config/channel-templates/main.md
    - config/channel-templates/bugs.md
    - config/channel-templates/yw-tasks.md
    - config/channel-templates/agents.md
    - config/channel-templates/progress.md
    - config/channel-templates/dev-alerts.md
    - config/channel-templates/logs.md
    - config/channel-templates/bot-control.md
  modified:
    - src/discord-group-utils.ts
    - src/discord-group-utils.test.ts

key-decisions:
  - "Templates are static markdown files loaded via readFileSync, no template engine needed"
  - "Cortex references use directory-level paths only for forward-compatibility"
  - "Function signature unchanged -- existing callers unaffected"

patterns-established:
  - "Channel template naming: config/channel-templates/{channel-name}.md matches Discord channel name exactly"
  - "Cortex references: always directory paths (cortex/Areas/Work/) never specific files"

requirements-completed: [CTX-01, CTX-02, CTX-03, CTX-04, CTX-05]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 8 Plan 1: Channel-Specific CLAUDE.md Templates Summary

**8 themed CLAUDE.md templates with Cortex knowledge references, loaded by createGroupStub() via channel name matching**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T05:46:23Z
- **Completed:** 2026-03-27T05:50:23Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Created 8 channel-specific CLAUDE.md templates with distinct personas (bug triage, project management, general assistant, swarm output, etc.)
- Enhanced createGroupStub() to load templates from config/channel-templates/ by channel name, falling back to generic stub
- Added Cortex knowledge references to bugs, yw-tasks, main, and agents templates using directory-level paths
- Added 7 new tests covering template selection, content verification, and Cortex path validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 8 channel-specific CLAUDE.md templates** - `79cff13` (feat)
2. **Task 2 RED: Add failing tests for template selection** - `20c1691` (test)
3. **Task 2 GREEN: Enhance createGroupStub() with template selection** - `89bb53c` (feat)

## Files Created/Modified

- `config/channel-templates/main.md` - General Jarvis assistant template with cortex/ root reference
- `config/channel-templates/bugs.md` - Bug triage mode with cortex/Areas/Work/ reference
- `config/channel-templates/yw-tasks.md` - Project management mode with cortex/Areas/Work/ reference
- `config/channel-templates/agents.md` - Swarm output display with cortex/Areas/Work/Projects/NightShift/ reference
- `config/channel-templates/progress.md` - Progress tracking, read-mostly channel
- `config/channel-templates/dev-alerts.md` - CI/CD notifications and deployment alerts
- `config/channel-templates/logs.md` - System logs and container events
- `config/channel-templates/bot-control.md` - Server management and admin commands
- `src/discord-group-utils.ts` - Added template loading with TEMPLATES_DIR, readFileSync, existsSync
- `src/discord-group-utils.test.ts` - Added 7 template selection tests, updated 3 existing stub tests

## Decisions Made

- Used simple readFileSync for template loading -- no template engine needed since templates are static markdown
- Cortex references use directory-level paths only (e.g., `cortex/Areas/Work/`) for forward-compatibility per D-04/D-06
- Function signature `createGroupStub(channelName, isMain)` kept unchanged -- isMain only used in fallback path

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

- Pre-existing build errors in src/index.ts (missing onTasksChanged) and src/whatsapp-auth.ts (missing baileys module) -- not caused by this plan's changes. Logged as out-of-scope.

## Known Stubs

None -- all templates contain substantive content with proper instructions and Cortex references.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- All 8 channel templates ready for use by Discord auto-registration
- createGroupStub() will automatically apply themed content when new group folders are created
- Ready for Plan 02 (routing migration toggles) which is independent of template content

---
*Phase: 08-per-channel-context-and-migration*
*Completed: 2026-03-27*
