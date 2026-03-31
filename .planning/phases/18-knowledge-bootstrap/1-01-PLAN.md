---
wave: 1
plan_id: "18-01"
phase: 18
title: "Update global CLAUDE.md with Cortex auto-query instruction"
objective: "Add a Cortex Knowledge Base section to groups/global/CLAUDE.md so every agent invocation auto-queries Cortex before starting work (POP-03, D-03)"
depends_on: []
files_modified:
  - "groups/global/CLAUDE.md"
requirements_addressed: ["POP-03"]
autonomous: true
must_haves:
  - "groups/global/CLAUDE.md contains a '## Cortex Knowledge Base' section"
  - "The section instructs agents to call cortex_search before any task"
  - "The instruction includes a concrete example query"
  - "The instruction is under 15 lines to avoid context bloat (Pitfall 5)"
---

<objective>
Add the Cortex auto-query instruction to `groups/global/CLAUDE.md` so all container agents automatically search the knowledge base before starting any task. This is the single file change needed for POP-03 per D-03.

Purpose: First real wiring that makes agents knowledge-aware -- every agent invocation will query Cortex for relevant context before doing work.
Output: Updated `groups/global/CLAUDE.md` with Cortex section.
</objective>

<context>
@groups/global/CLAUDE.md
@.planning/phases/18-knowledge-bootstrap/18-RESEARCH.md (section: "CLAUDE.md Auto-Query Instruction")
@.planning/phases/18-knowledge-bootstrap/18-CONTEXT.md (D-03: agents query Cortex always before any task)
</context>

<tasks>

<task id="T01" title="Add Cortex Knowledge Base section to global CLAUDE.md">
<read_first>
- groups/global/CLAUDE.md -- current content, find insertion point (after existing sections, before any trailing content)
- container/agent-runner/src/ipc-mcp-stdio.ts -- confirm MCP tool names are `cortex_search` and `cortex_read` (lines 477-558)
</read_first>
<action>
Append the following section to the END of `groups/global/CLAUDE.md` (after the "Frequent task guidance" section, before EOF):

```markdown

## Cortex Knowledge Base

Before starting any task, search the Cortex knowledge base for relevant context:

1. Extract 2-3 key concepts from the task (e.g., "IPC", "container", "Discord channel")
2. Call `cortex_search` with a natural language query combining those concepts
3. If results are relevant (score > 0.7), call `cortex_read` on the top result paths
4. Use the retrieved knowledge to inform your approach

Example:
- Task: "Fix the IPC message handler for cortex_write"
- Query: `cortex_search("IPC cortex_write message handler")`
- This returns entries about IPC contracts and the cortex write pipeline

Skip the search only if the task is purely conversational with no technical component.
```

This is exactly 12 lines of content. The wording follows the research recommendation from 18-RESEARCH.md. Key design choices per Claude's Discretion:
- "2-3 key concepts" prevents agents from searching with entire prompts (poor semantic match)
- "score > 0.7" gives agents a threshold to skip irrelevant results
- Concrete example models the expected behavior
- "Skip if purely conversational" avoids unnecessary API calls for casual chat
- Uses MCP tool names `cortex_search` and `cortex_read` (not import paths -- containers use MCP tools per Pitfall 6)
</action>
<acceptance_criteria>
- `grep -c "## Cortex Knowledge Base" groups/global/CLAUDE.md` returns `1`
- `grep -c "cortex_search" groups/global/CLAUDE.md` returns at least `2` (instruction + example)
- `grep -c "cortex_read" groups/global/CLAUDE.md` returns at least `1`
- `grep -c "score > 0.7" groups/global/CLAUDE.md` returns `1`
- `grep -c "Skip the search only if" groups/global/CLAUDE.md` returns `1`
- File still contains all original content: `grep -c "## What You Can Do" groups/global/CLAUDE.md` returns `1`
- Total line count of added section is <= 15 lines (excluding blank separator lines)
</acceptance_criteria>
</task>

</tasks>

<verification>
```bash
# Verify the section exists and is well-formed
grep "## Cortex Knowledge Base" groups/global/CLAUDE.md
grep "cortex_search" groups/global/CLAUDE.md
grep "cortex_read" groups/global/CLAUDE.md

# Verify original content is preserved
grep "## What You Can Do" groups/global/CLAUDE.md
grep "## Task Scripts" groups/global/CLAUDE.md
grep "## Memory" groups/global/CLAUDE.md
```
</verification>

<success_criteria>
- groups/global/CLAUDE.md contains the Cortex Knowledge Base section with cortex_search and cortex_read tool references
- All original CLAUDE.md content is preserved intact
- The added section is concise (under 15 lines of instruction text)
</success_criteria>

<output>
After completion, create `.planning/phases/18-knowledge-bootstrap/18-01-SUMMARY.md`
</output>
