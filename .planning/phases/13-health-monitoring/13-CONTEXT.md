# Phase 13: Health Monitoring - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (full autonomous approval — all decisions at Claude's discretion)

<domain>
## Phase Boundary

Alfred monitors Cloudflare tunnel health and key service status (nanoclaw systemd, yw-dev)
and posts state-change embeds to #logs. Also posts a periodic heartbeat when all services
are healthy. Runs as a scheduled task — no manual invocation needed.

</domain>

<decisions>
## Implementation Decisions

### Architecture: Host-side polling vs agent-based
- **Host-side** (new `src/health-monitor.ts`): pure Node.js polling loop, no agent container, posts directly to Discord via sendToLogs pattern — simpler, lower cost, lower latency
- **Agent-based** (scheduled task): agent runs `systemctl status`, `cloudflared tunnel list` — uses existing task infra but burns tokens every check
- **Decision: Host-side polling** for health checks (zero token cost, runs in same process as nanoclaw, instant posting)

### Health Monitor (src/health-monitor.ts)
- Polls every 60 seconds (configurable via `HEALTH_CHECK_INTERVAL_MS` env, default 60000)
- Checks:
  1. `systemctl --user is-active nanoclaw` (or `systemctl is-active nanoclaw` — detect which)
  2. `systemctl --user is-active yw-dev` (if exists)
  3. Cloudflare tunnel: `cloudflared tunnel list --output json` or `curl` to tunnel health endpoint
- Tracks previous state per service — only posts on state CHANGE (up→down, down→up)
- Heartbeat: posts to #logs every 30 minutes when all services are healthy

### State Tracking
- In-memory state map: `Map<string, 'up' | 'down' | 'unknown'>` per service
- Initial state is 'unknown' — first transition to 'up' does NOT post (prevents spam on startup)
- Persists state to `.data/health-state.json` for crash recovery

### Embed Design (src/health-monitor-embeds.ts)
- Down embed: color RED (0xed4245), title = "⬇ {service} DOWN", description = error output snippet
- Up embed: color GREEN (0x57f287), title = "⬆ {service} UP", description = recovery note
- Heartbeat embed: color GREY (0x95a5a6), title = "💚 All systems operational", description = service list with uptime
- No `withAgentMeta()` for health embeds — health monitor is not an agent

### Service Discovery
- Read services to monitor from `HEALTH_MONITOR_SERVICES` env var (comma-separated, e.g. `nanoclaw,yw-dev`)
- Cloudflare tunnel check: enabled if `CLOUDFLARE_TUNNEL_NAME` env var is set
- Default services: `nanoclaw` only (safe default)

### Integration (src/index.ts)
- `startHealthMonitor()` called at startup after `sendToLogs` is wired
- Receives same `sendToLogs`-style function pointing to #logs channel

### Claude's Discretion
- Exact heartbeat interval (suggest 30 min)
- Whether to post "unknown→up" transitions on startup
- Cloudflare check command specifics

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sendToLogs` pattern in src/index.ts — exact same wiring for health monitor's send function
- `DISCORD_LOGS_CHANNEL_ID` env var already exists — health posts go to #logs (same channel)
- src/discord-embeds.ts COLORS pattern — mirror for health embed colors
- src/env.ts `readEnvFile()` — read new HEALTH_MONITOR_SERVICES env

### Established Patterns
- setInterval polling loops (see ProgressTracker for pattern)
- logger.info/warn/error for internal logging (pino)
- `exec` from child_process for shell commands (already used in container-runner)

### Integration Points
- `src/index.ts` ~line 877-887 (sendToLogs wiring) — add `startHealthMonitor()` call here
- New files: `src/health-monitor.ts`, `src/health-monitor-embeds.ts`
- New env vars: `HEALTH_MONITOR_SERVICES`, `HEALTH_CHECK_INTERVAL_MS`, `CLOUDFLARE_TUNNEL_NAME`

</code_context>

<specifics>
## Specific Ideas

- First poll happens 10 seconds after startup (avoid false alarms during boot)
- Health state file prevents re-alerting on nanoclaw restart if services were already down
- Cloudflare check should be lightweight: check tunnel process existence, not deep API call

</specifics>

<deferred>
## Deferred Ideas

- #logs query capability — defer to v2.1
- Email/SMS escalation for prolonged outages — defer to v2.1
- Web dashboard for health history — defer to v2.1

</deferred>
