---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: NanoClaw health monitor - systemctl checks, state transitions, Discord embeds, gaps
project: nanoclaw
tags: [nanoclaw, health-monitor, systemctl, discord, monitoring]
created: 2026-03-31
---

# NanoClaw — Health Monitor

## What It Checks

The health monitor (`src/health-monitor.ts`) polls systemd service states using `systemctl --user is-active {service}`. Services monitored are configured via environment variable `HEALTH_MONITOR_SERVICES` (comma-separated, default: `nanoclaw`). Cloudflare Tunnel is added as a system-level service (no `--user` flag) if `CLOUDFLARE_TUNNEL_NAME` is set.

The monitor checks: is each configured service `active`? Any other output (activating, failed, inactive) is treated as `down`. Each check runs `execAsync()` with a 5-second timeout to prevent stuck systemctl calls from blocking the loop.

## State Transitions and What It Reports

The monitor persists service states to `data/health-state.json` so it survives process restarts without spamming alerts for already-known states.

Reported transitions:
- **`unknown` → `down`**: service found down on startup — alert posted (service was not previously known to be up)
- **`up` → `down`**: service went down while running — alert embed posted to #agents
- **`down` → `up`**: service recovered — recovery embed posted
- **`unknown` → `up`**: suppressed (startup spam prevention — services coming up normally don't need an alert)
- No change: no embed, no log entry

Embeds use Discord EmbedBuilder: down alerts use red color with service name and stderr output, recovery alerts use green.

## Morning Digest Timing

The health monitor is not directly responsible for the morning digest timing — that's handled by scheduled tasks (crons). Two separate morning crons run each day:
- **7:27** — news digest (Jarvis, isolated, no Night Shift content)
- **7:35** — Night Shift approval digest (Jarvis, group context, structured approval flow)

The health monitor's role in morning operations is checking that the crons themselves haven't expired and reinstalling them if needed (via the 12:00 health check cron — see task-scheduler.md for the auto-expire + reinstall pattern).

## What the Health Monitor Does NOT Check

Known gaps as of the architecture doc date:
- **Cortex consistency** — stale entries, orphan nodes, and embedding freshness are not checked by the health monitor. These are handled by Night Shift reconciliation (triggered via `cortex_reconcile` IPC) or manual triggers.
- **Qdrant vector database health** — no liveness probe for the embedding store
- **API quota / rate limit status** — no alerts for approaching OpenAI or Anthropic quota limits
- **Container process health** — the monitor checks systemd services, not individual container runs. A container that's stuck but hasn't crashed won't trigger a health alert.
- **Disk space** — no disk usage alerts

## Configuration

```
HEALTH_MONITOR_SERVICES=nanoclaw,yw-dev    # comma-separated systemd user services
CLOUDFLARE_TUNNEL_NAME=myproject           # adds cloudflared system service check
```

If no configuration is present, only `nanoclaw` is monitored. The monitor is started in `index.ts` and runs as a background loop with a configurable poll interval.

## State File

`data/health-state.json` stores the last known state per service:
```json
{ "nanoclaw": "up", "cloudflared": "up" }
```
This file is read on startup to initialize state without triggering false `unknown → up` alerts for services that were already running before restart.
