# Phase 13: Health Monitoring - Research

**Researched:** 2026-03-28
**Domain:** Host-side service health polling, Discord embed notifications, Node.js child_process
**Confidence:** HIGH

## Summary

Phase 13 adds a host-side health monitor that polls systemd services and Cloudflare tunnel status, then posts state-change embeds to the #logs Discord channel. The decisions from CONTEXT.md are well-specified and align perfectly with existing codebase patterns: `sendToLogs` for channel wiring, `setInterval` for polling (as in ProgressTracker), `EmbedBuilder` for Discord embeds (as in discord-embeds.ts and agent-status-embeds.ts), and `readEnvFile` for configuration.

The implementation requires two new files (`src/health-monitor.ts` and `src/health-monitor-embeds.ts`) plus a startup call in `src/index.ts`. No new dependencies are needed. All tools (`systemctl`, `cloudflared`) are confirmed available on the target machine. Both `nanoclaw` and `yw-dev` run as `--user` systemd services; cloudflared runs as a system-level service.

**Primary recommendation:** Follow the existing `sendToLogs` text pattern but upgrade to embed-based posting via the `sendEmbed` method already on the Discord channel. The health monitor should use `child_process.exec` with promisification (via a simple wrapper or `util.promisify`) since the codebase does not currently use promisified exec -- the simplest approach is wrapping in a `new Promise`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Architecture: Host-side polling** -- pure Node.js polling loop in `src/health-monitor.ts`, no agent container, posts directly to Discord via sendToLogs/sendEmbed pattern
- **Polling interval:** 60 seconds default, configurable via `HEALTH_CHECK_INTERVAL_MS` env var
- **Checks:** `systemctl --user is-active {service}`, Cloudflare tunnel status
- **State tracking:** In-memory `Map<string, 'up' | 'down' | 'unknown'>`, persisted to file for crash recovery
- **Initial state:** 'unknown' -- first transition to 'up' does NOT post (prevents spam on startup)
- **Heartbeat:** Posts to #logs every 30 minutes when all services healthy
- **Embed design:** RED for down, GREEN for up, GREY for heartbeat. No `withAgentMeta()` -- health monitor is not an agent
- **Service discovery:** `HEALTH_MONITOR_SERVICES` env var (comma-separated), default `nanoclaw` only
- **Cloudflare:** Enabled if `CLOUDFLARE_TUNNEL_NAME` env var is set
- **Integration:** `startHealthMonitor()` called at startup after sendToLogs is wired
- **First poll:** 10 seconds after startup (avoid false alarms during boot)
- **Embed files:** `src/health-monitor.ts`, `src/health-monitor-embeds.ts`
- **New env vars:** `HEALTH_MONITOR_SERVICES`, `HEALTH_CHECK_INTERVAL_MS`, `CLOUDFLARE_TUNNEL_NAME`

### Claude's Discretion
- Exact heartbeat interval (suggest 30 min)
- Whether to post "unknown->up" transitions on startup
- Cloudflare check command specifics

### Deferred Ideas (OUT OF SCOPE)
- #logs query capability -- defer to v2.1
- Email/SMS escalation for prolonged outages -- defer to v2.1
- Web dashboard for health history -- defer to v2.1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HEALTH-01 | Alfred monitors Cloudflare tunnels and posts status to #logs on state change (up/down) | `cloudflared tunnel list --output json` returns tunnel connections array; check `connections.length > 0` for UP. System service `cloudflared` is active. Tunnel name `yw-dev-tunnel` confirmed. |
| HEALTH-02 | Alfred monitors key services (yw-dev, nanoclaw systemd) and posts to #logs on state change | Both services run as `--user` systemd units. `systemctl --user is-active {service}` returns "active"/"inactive". Confirmed: nanoclaw=active, yw-dev=active. |
| HEALTH-03 | Alfred posts periodic heartbeat to #logs when all services are operational | Use `setInterval` at 30-minute cadence. Heartbeat embed uses GREY color (0x95a5a6) matching `AGENT_COLORS.digest`. Only post when all services report 'up'. |
</phase_requirements>

## Standard Stack

### Core (already in project -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | ^14.25.1 | EmbedBuilder for health embeds | Already in project, used by discord-embeds.ts and agent-status-embeds.ts |
| pino | ^9.6.0 | Logging | Already in project, consistent logging pattern |
| child_process (Node.js built-in) | N/A | Shell command execution | `exec` already used in container-runner.ts and ipc.ts |
| fs (Node.js built-in) | N/A | State persistence to JSON file | Already used extensively throughout project |

### No Additional Libraries Needed
- No npm install required
- `systemctl` and `cloudflared` are system tools called via `exec`

## Architecture Patterns

### Recommended Project Structure
```
src/
  health-monitor.ts          # Main polling loop, state tracking, startup/shutdown
  health-monitor-embeds.ts   # EmbedBuilder functions for down/up/heartbeat
  health-monitor.test.ts     # Unit tests for embeds and state logic
```

### Pattern 1: sendToLogs Embed Wiring
**What:** The health monitor receives a send function at startup, identical to how `sendToLogs` and `sendToAgents` are wired in `src/index.ts` (~line 879-895).
**When to use:** For posting health embeds to #logs.
**Key insight:** Current `sendToLogs` sends plain text via `ch.sendMessage()`. Health monitor needs to send embeds via `ch.sendEmbed()`. Wire a new `sendHealthEmbed` function or reuse the existing `sendToAgents` pattern (which already sends `EmbedBuilder` instances).

**Example (from existing code, src/index.ts line 890-895):**
```typescript
// Existing sendToAgents pattern -- health monitor should follow this exactly
sendToAgents = agentsJid
  ? async (embed: EmbedBuilder) => {
      const ch = findChannel(channels, agentsJid);
      if (ch?.sendEmbed) await ch.sendEmbed(agentsJid, embed).catch(() => {});
    }
  : undefined;
```

The health monitor's `sendToLogs` should be wired the same way but pointing to `DISCORD_LOGS_CHANNEL_ID`.

### Pattern 2: setInterval Polling Loop
**What:** Health checks run on a fixed interval using `setInterval`, following the ProgressTracker pattern.
**When to use:** For the main 60s health check loop and the 30m heartbeat.

```typescript
// Pattern from ProgressTracker (src/progress-tracker.ts line 92-95)
state.typingTimer = setInterval(
  () => this.setTyping(chatJid, true).catch(() => {}),
  TYPING_INTERVAL_MS,
);
```

### Pattern 3: State Persistence via JSON File
**What:** Write health state to `data/health-state.json` on every state change, read on startup for crash recovery.
**When to use:** To prevent re-alerting on nanoclaw restart when services were already down.

**IMPORTANT CORRECTION:** CONTEXT.md says `.data/health-state.json` but the project uses `data/` directory (see `DATA_DIR` in `src/config.ts` line 42: `export const DATA_DIR = path.resolve(PROJECT_ROOT, 'data')`). The health state file should be at `${DATA_DIR}/health-state.json` for consistency.

### Pattern 4: Shell Command Execution
**What:** Run systemctl and cloudflared commands via `child_process.exec`.
**When to use:** For service status checks.

The codebase uses `exec` in callback style (container-runner.ts line 545). For cleaner async code, wrap in a Promise:

```typescript
import { exec } from 'child_process';

function execAsync(cmd: string, timeoutMs = 5000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}
```

### Anti-Patterns to Avoid
- **Don't use execSync:** Blocks the event loop. Use async exec with timeout.
- **Don't import from agent-message-schema.ts:** Health embeds are NOT agent messages. No `withAgentMeta()`. Define health-specific colors in `health-monitor-embeds.ts`.
- **Don't poll too aggressively:** 60s is fine. Avoid sub-10s intervals that could cause log noise.
- **Don't use `cloudflared tunnel list` on every check:** It makes an API call to Cloudflare. Instead, check the systemd service status (`systemctl is-active cloudflared`) for lightweight polling, and use `cloudflared tunnel list --output json` only when the service is active to verify tunnel connectivity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Discord embeds | Custom JSON payloads | `EmbedBuilder` from discord.js | Type-safe, handles field limits, already used in project |
| JSON state persistence | Custom serialization | `JSON.stringify`/`JSON.parse` with `fs.writeFileSync`/`readFileSync` | Simple key-value state, no need for SQLite |
| Cron/interval scheduling | Custom scheduler | `setInterval` + `setTimeout` | Health checks are simple fixed intervals, not cron expressions |
| Service status checking | HTTP health endpoints | `systemctl --user is-active` | Both services are systemd-managed, direct status check |

## Common Pitfalls

### Pitfall 1: Startup Spam
**What goes wrong:** On every nanoclaw restart, all services transition from 'unknown' to their current state, flooding #logs with "UP" messages.
**Why it happens:** Initial state is 'unknown', first poll detects 'active', posts transition.
**How to avoid:** Load persisted state from `data/health-state.json` on startup. If no persisted state exists, set initial state to 'unknown' and suppress the first 'unknown->up' transition (only post 'unknown->down'). The CONTEXT.md explicitly says "first transition to 'up' does NOT post."
**Warning signs:** Multiple green "UP" embeds in #logs every time nanoclaw restarts.

### Pitfall 2: exec Timeout Not Set
**What goes wrong:** `systemctl` or `cloudflared` hangs (e.g., dbus timeout), blocking the health check loop.
**Why it happens:** `exec` without timeout waits indefinitely.
**How to avoid:** Always set `timeout` option on `exec` calls. 5 seconds is generous for `systemctl is-active` (typically returns in <100ms).
**Warning signs:** Health checks stop posting, no heartbeat in #logs.

### Pitfall 3: DATA_DIR vs .data Path
**What goes wrong:** Health state file written to wrong path, not found on restart.
**Why it happens:** CONTEXT.md says `.data/` but project convention is `data/` (via `DATA_DIR` constant).
**How to avoid:** Use `import { DATA_DIR } from './config.js'` and `path.join(DATA_DIR, 'health-state.json')`.
**Warning signs:** State file not persisting across restarts.

### Pitfall 4: cloudflared tunnel list Is Heavyweight
**What goes wrong:** Running `cloudflared tunnel list --output json` every 60 seconds makes API calls to Cloudflare, potentially rate-limited.
**Why it happens:** The command queries Cloudflare's API, not local state.
**How to avoid:** For routine checks, use `systemctl is-active cloudflared` (system-level, not --user) to verify the tunnel process is running. Use `cloudflared tunnel list --output json` only on startup or when investigating a state change, or skip it entirely and rely on the systemd service status.
**Warning signs:** Cloudflare API rate limiting errors in logs.

### Pitfall 5: systemctl --user vs system-level
**What goes wrong:** Checking the wrong service scope returns "inactive" for a service that is actually running.
**Why it happens:** `nanoclaw` and `yw-dev` run as `--user` services, but `cloudflared` runs as a system-level service.
**How to avoid:** Use `systemctl --user is-active` for nanoclaw and yw-dev. Use `systemctl is-active` (no --user) for cloudflared. Store this scope as part of the service configuration.
**Warning signs:** cloudflared always reported as "down" despite being active.

### Pitfall 6: sendToLogs Sends Text, Not Embeds
**What goes wrong:** Using the existing `sendToLogs` function only sends plain text. Health embeds need `sendEmbed`.
**Why it happens:** `sendToLogs` was designed for simple lifecycle text messages (line 879-884).
**How to avoid:** Wire a separate `sendHealthEmbed` function using the `sendToAgents` pattern (which already sends EmbedBuilder instances).
**Warning signs:** Health messages appear as raw text in #logs instead of rich embeds.

## Code Examples

### Health Embed Builders (src/health-monitor-embeds.ts)
```typescript
// Pattern follows discord-embeds.ts and agent-status-embeds.ts
import { EmbedBuilder } from 'discord.js';

// Health-specific colors (NOT from AGENT_COLORS -- health monitor is not an agent)
export const HEALTH_COLORS = {
  down: 0xed4245,    // Red -- matches CONTEXT.md spec
  up: 0x57f287,      // Green
  heartbeat: 0x95a5a6, // Grey
} as const;

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

export function buildDownEmbed(service: string, errorSnippet?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(HEALTH_COLORS.down)
    .setTitle(truncate(`\u2B07 ${service} DOWN`, 256))
    .setTimestamp();
  if (errorSnippet) {
    embed.setDescription(truncate(errorSnippet, 4096));
  }
  return embed;
}

export function buildUpEmbed(service: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(HEALTH_COLORS.up)
    .setTitle(truncate(`\u2B06 ${service} UP`, 256))
    .setDescription('Service recovered')
    .setTimestamp();
  return embed;
}

export function buildHeartbeatEmbed(services: string[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(HEALTH_COLORS.heartbeat)
    .setTitle('\uD83D\uDC9A All systems operational')
    .setDescription(services.map(s => `\u2705 ${s}`).join('\n'))
    .setTimestamp();
  return embed;
}
```

### Health Monitor Core (src/health-monitor.ts skeleton)
```typescript
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { EmbedBuilder } from 'discord.js';
import { DATA_DIR } from './config.js';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';
import { buildDownEmbed, buildUpEmbed, buildHeartbeatEmbed } from './health-monitor-embeds.js';

type ServiceState = 'up' | 'down' | 'unknown';
type SendEmbedFn = (embed: EmbedBuilder) => Promise<void>;

interface ServiceCheck {
  name: string;
  command: string;  // e.g. 'systemctl --user is-active nanoclaw'
  parseUp: (stdout: string) => boolean;
}

const STATE_FILE = path.join(DATA_DIR, 'health-state.json');

export function startHealthMonitor(sendEmbed: SendEmbedFn): () => void {
  // 1. Read env for services list, interval, tunnel name
  // 2. Build ServiceCheck[] from config
  // 3. Load persisted state from STATE_FILE
  // 4. setTimeout first poll 10s after startup
  // 5. setInterval for subsequent polls
  // 6. setInterval for heartbeat
  // 7. Return cleanup function that clears all intervals
}
```

### Integration Point (src/index.ts ~line 897)
```typescript
// After sendToLogs and sendToAgents wiring, add:
import { startHealthMonitor } from './health-monitor.js';

// Wire health monitor to send embeds to #logs
const sendHealthEmbed = dumpJid
  ? async (embed: EmbedBuilder) => {
      const ch = findChannel(channels, dumpJid);
      if (ch?.sendEmbed) await ch.sendEmbed(dumpJid, embed).catch(() => {});
    }
  : undefined;

if (sendHealthEmbed) {
  startHealthMonitor(sendHealthEmbed);
}
```

## Cloudflare Tunnel Check Strategy

**Recommendation (Claude's discretion area):**

For the Cloudflare tunnel check, use a two-tier approach:

1. **Primary (lightweight):** `systemctl is-active cloudflared` -- checks if the tunnel daemon process is running. This is local, instant, no API call. Note: this is system-level (no `--user`), as confirmed by `systemctl is-active cloudflared` returning "active" while `systemctl --user is-active cloudflared` returns "inactive".

2. **Secondary (on state change only):** When the primary check transitions from 'up' to 'down' or 'down' to 'up', optionally run `cloudflared tunnel list --output json` to get connection details for the embed description. This adds richness without the cost of running it every 60s.

The tunnel name confirmed on this system is `yw-dev-tunnel`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| systemctl | HEALTH-02 (service checks) | Yes | systemd 255 | -- |
| cloudflared | HEALTH-01 (tunnel checks) | Yes | 2026.3.0 | Skip tunnel check if not installed |
| Discord bot (sendEmbed) | All HEALTHs (posting to #logs) | Yes | discord.js ^14.25.1 | Log to console only |
| data/ directory | State persistence | Yes | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None -- all dependencies confirmed available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/health-monitor` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HEALTH-01 | Tunnel state change triggers DOWN/UP embed | unit | `npx vitest run src/health-monitor.test.ts -t "tunnel"` | Wave 0 |
| HEALTH-02 | Service state change triggers DOWN/UP embed | unit | `npx vitest run src/health-monitor.test.ts -t "service"` | Wave 0 |
| HEALTH-03 | Heartbeat embed when all services up | unit | `npx vitest run src/health-monitor.test.ts -t "heartbeat"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/health-monitor`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/health-monitor.test.ts` -- covers HEALTH-01, HEALTH-02, HEALTH-03
- [ ] `src/health-monitor-embeds.test.ts` -- covers embed builder output (colors, titles, fields)

### Test Strategy Notes
- Mock `child_process.exec` to simulate systemctl/cloudflared output
- Mock `sendEmbed` function to capture posted embeds and verify color/title/description
- Test state transitions: unknown->up (no post), unknown->down (post), up->down (post), down->up (post)
- Test heartbeat: only posts when all services are 'up'
- Test state persistence: write/read from JSON file
- Follow existing pattern from `src/agent-status-embeds.test.ts` (check `embed.data.color`, `embed.data.title`, `embed.data.fields`)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agent-based health checks (burn tokens) | Host-side polling (zero cost) | Phase 13 decision | No token cost per health check |
| Plain text logs | Discord embeds | Phase 9-11 pattern | Rich, color-coded, structured notifications |

## Open Questions

1. **Heartbeat interval precision**
   - What we know: CONTEXT.md suggests 30 min
   - What's unclear: Whether this should be configurable via env var
   - Recommendation: Hardcode 30 min (1800000ms), configurable is overkill for a heartbeat

2. **Cloudflare tunnel check depth**
   - What we know: `cloudflared tunnel list --output json` works but is an API call
   - What's unclear: Whether Cloudflare rate-limits this
   - Recommendation: Use `systemctl is-active cloudflared` as primary (local, instant), `tunnel list` only for enrichment on state changes

3. **Multiple tunnels**
   - What we know: Only one tunnel (`yw-dev-tunnel`) exists currently
   - What's unclear: Whether multiple tunnels will be added
   - Recommendation: Support single tunnel via `CLOUDFLARE_TUNNEL_NAME` env var. Future-proofing for multiple tunnels is out of scope.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/index.ts` lines 879-901 -- sendToLogs/sendToAgents wiring pattern
- Codebase inspection: `src/discord-embeds.ts` -- EmbedBuilder pattern with COLORS constant
- Codebase inspection: `src/agent-status-embeds.ts` -- embed builder pattern with fields
- Codebase inspection: `src/progress-tracker.ts` -- setInterval polling pattern
- Codebase inspection: `src/config.ts` line 42 -- DATA_DIR = `data/` (not `.data/`)
- Codebase inspection: `src/channels/discord.ts` line 781-792 -- sendEmbed implementation
- Codebase inspection: `src/env.ts` -- readEnvFile pattern for new env vars
- System probe: `systemctl --user is-active nanoclaw` = active
- System probe: `systemctl --user is-active yw-dev` = active
- System probe: `systemctl is-active cloudflared` = active (system-level, not --user)
- System probe: `cloudflared --version` = 2026.3.0
- System probe: `cloudflared tunnel list --output json` = yw-dev-tunnel with active connections

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions -- well-specified, internally consistent with codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all verified in project
- Architecture: HIGH -- follows established patterns (sendToAgents, ProgressTracker, EmbedBuilder)
- Pitfalls: HIGH -- verified by system probes (systemctl scopes, cloudflared behavior, DATA_DIR path)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, no external API changes expected)
