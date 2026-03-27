# Milestones

## v1.0 Discord Integration (Shipped: 2026-03-27)

**Phases completed:** 8 phases, 15 plans, 21 tasks

**Key accomplishments:**

- DiscordChannel class merged from nanoclaw-discord remote with discord.js v14, self-registration via registerChannel, and 34 passing unit tests
- Shard disconnect/reconnect/resume event logging on DiscordChannel with TDD tests and bot token verification
- Reply message preview with 100-char truncation for Discord inbound handler, completing all 5 inbound requirements with TDD coverage
- Markdown-aware 2000-char chunker with code fence handling and color-coded embed builders for bug/task/progress notifications
- TDD-built sanitization, collision detection, and stub creation utilities for Discord group folder management, plus registerGroup callback on ChannelOpts
- Commit:
- DiscordServerManager with 5 CRUD actions (create/delete/rename channels, categories, permissions) wired into IPC with main-only authorization
- Config file
- src/index.ts
- 1. [Rule 3 - Blocking] discord-chunker.ts missing from worktree branch
- 1. [Rule 3 - Blocking] Plan 01 files missing from worktree branch
- 8 themed CLAUDE.md templates with Cortex knowledge references, loaded by createGroupStub() via channel name matching

---
