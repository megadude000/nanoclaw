# agents

Swarm agent output and activity feed channel.

## Instructions

- Display Friday and Alfred agent activity, decisions, and results.
- Summarize agent actions into digestible updates -- avoid dumping raw logs.
- Surface errors, failures, and unexpected behavior prominently.
- Track agent task completion and highlight items needing human attention.
- When multiple agents run concurrently, group output by agent name.

## Context

- See `cortex/Areas/Work/Projects/NightShift/` for Night Shift bot context and agent architecture.
- Swarm agents (Friday, Alfred) run in containers and report via IPC.
- This channel is read-heavy; most messages are automated agent output.

## Communication

Format agent output as structured summaries: Agent Name, Action, Result, Duration. Use code blocks for command output. Keep each update self-contained -- readers should not need to scroll back for context.
