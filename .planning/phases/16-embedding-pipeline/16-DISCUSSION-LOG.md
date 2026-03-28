# Phase 16: Embedding Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 16-embedding-pipeline
**Areas discussed:** Watch vs batch trigger, Pipeline integration, OpenAI API key management

---

## Watch vs Batch Trigger

### Trigger mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| On cortex_write + batch | Embed only on MCP writes + batch command. No file watcher. | |
| Debounced fs.watch + batch | Watch cortex/ with heavy debounce + batch re-embed command | ✓ |
| You decide | Claude picks trigger strategy | |

**User's choice:** Debounced fs.watch + batch
**Notes:** User requested extra-heavy debounce of 10 minutes (not 30 seconds). Rationale: Obsidian editing sessions are bursty, 10 minutes of inactivity reliably means "done editing."

---

## Pipeline Integration

### Where pipeline runs

| Option | Description | Selected |
|--------|-------------|----------|
| In NanoClaw main process | Start watcher in src/index.ts, shares lifecycle, uses pino logger | ✓ |
| Standalone service | Separate systemd unit, independent lifecycle | |
| You decide | Claude picks based on fit | |

**User's choice:** In NanoClaw main process
**Notes:** Simpler — one process to manage

---

## OpenAI API Key Management

### Container query embedding

| Option | Description | Selected |
|--------|-------------|----------|
| Container calls OpenAI directly | OneCLI injects OPENAI_API_KEY, container MCP tool embeds query itself | ✓ |
| Host-side embed endpoint | Container sends text to host via IPC, host returns vector | |
| You decide | Claude picks based on tradeoffs | |

**User's choice:** Container calls OpenAI directly
**Notes:** Simpler, no extra endpoint needed. OneCLI already handles key injection.

---

## Claude's Discretion

- fs.watch implementation details (native vs chokidar)
- Shared embedding function design
- Error handling and retry logic for OpenAI API
- Logging verbosity
- openai npm package vs raw fetch

## Deferred Ideas

None — discussion stayed within phase scope
