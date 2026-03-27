# Phase 4: Group Registration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 04-group-registration
**Areas discussed:** Group folder naming, Auto vs explicit registration, Main channel designation, Workspace bootstrapping

---

## Group Folder Naming

| Option | Description | Selected |
|--------|-------------|----------|
| Human-readable (Recommended) | dc-main, dc-bugs, dc-yw-tasks — derived from Discord channel name. Sanitized (lowercase, hyphens). | ✓ |
| Channel ID based | dc-1234567890 — guaranteed unique, no collision risk, but opaque. | |
| Hybrid | dc-bugs-1234567890 — readable prefix + ID suffix. Unique and readable but verbose. | |

**User's choice:** Human-readable (Recommended)
**Notes:** Matches existing `main` folder pattern. Collision handled by appending channel ID as tiebreaker.

---

## Auto vs Explicit Registration

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-register on message (Recommended) | When bot receives first message in a Discord channel, auto-register via onChatMetadata. Zero setup. | ✓ |
| Explicit command only | User must send a registration command before channel becomes a group. More control, more friction. | |
| Config-driven allowlist | Only channels listed in config get registered. Prevents accidental creation but requires manual updates. | |

**User's choice:** Auto-register on message (Recommended)
**Notes:** Same pattern as Telegram. Zero friction per channel.

---

## Main Channel Designation

| Option | Description | Selected |
|--------|-------------|----------|
| Env var DISCORD_MAIN_CHANNEL_ID (Recommended) | Set channel ID in env config. Explicit, no ambiguity. Matches Telegram main chat pattern. | ✓ |
| First channel with 'main' in name | Auto-detect by matching channel name. Convention-based, fragile. | |
| First message from owner | First channel bot owner messages in becomes main. Dynamic but non-reproducible. | |

**User's choice:** Env var DISCORD_MAIN_CHANNEL_ID (Recommended)
**Notes:** Clean and explicit. Mirrors how Telegram main is identified.

---

## Workspace Bootstrapping

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal CLAUDE.md stub (Recommended) | Create groups/dc-{name}/CLAUDE.md with channel name and basic instructions. Phase 8 adds themes. | ✓ |
| Copy from template directory | Maintain groups/_template/ with defaults. More structure upfront. | |
| Empty directory only | Just mkdir. Minimal but agents may need CLAUDE.md to function. | |

**User's choice:** Minimal CLAUDE.md stub (Recommended)
**Notes:** Phase 8 later adds themed, Cortex-aware content.

---

## Claude's Discretion

- Exact CLAUDE.md stub template wording
- Channel name sanitization edge cases
- Logging verbosity for registration events

## Deferred Ideas

None — discussion stayed within phase scope
