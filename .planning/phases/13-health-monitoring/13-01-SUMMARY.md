---
phase: 13-health-monitoring
plan: "01"
subsystem: health-monitor
tags: [health-monitoring, discord, embeds, systemctl, state-persistence]
dependency_graph:
  requires: []
  provides: [health-monitor-embeds, health-monitor-core]
  affects: [src/index.ts]
tech_stack:
  added: []
  patterns: [TDD, vitest mocking with vi.mock, exec wrapping with Promise, Map-based state tracking]
key_files:
  created:
    - src/health-monitor-embeds.ts
    - src/health-monitor-embeds.test.ts
    - src/health-monitor.ts
    - src/health-monitor.test.ts
  modified: []
decisions:
  - "buildDownEmbed does not set description when errorSnippet is omitted (undefined), keeping the embed clean for brief status alerts"
  - "execAsync attaches stdout/stderr to the error object for downstream error inspection without wrapping in a custom class"
  - "Health monitor exports are individual named functions (not a class) to align with functional patterns used in agent-status-embeds.ts and discord-embeds.ts"
  - "Pre-existing build errors in whatsapp.ts and index.ts are out of scope — health-monitor.ts introduces 0 new TypeScript errors"
metrics:
  duration: 6m
  completed_date: "2026-03-28"
  tasks_completed: 2
  files_changed: 4
---

# Phase 13 Plan 01: Health Monitor Core Summary

Health monitor core built with TDD — embed builders and polling loop with state tracking, transition detection, and disk persistence. Implements HEALTH-01, HEALTH-02, HEALTH-03.

## What Was Built

**src/health-monitor-embeds.ts** — Three embed builders for health status:
- `buildDownEmbed(service, errorSnippet?)` — red embed (0xed4245) with DOWN title, optional error snippet
- `buildUpEmbed(service)` — green embed (0x57f287) with UP title, "Service recovered" description
- `buildHeartbeatEmbed(services)` — grey embed (0x95a5a6) listing all services with checkmark prefix
- `HEALTH_COLORS` constant exported for external consumers

**src/health-monitor.ts** — Health polling loop:
- `startHealthMonitor(sendEmbed)` — entry point returning cleanup function
- `buildServiceConfigs()` — reads HEALTH_MONITOR_SERVICES and CLOUDFLARE_TUNNEL_NAME from env
- `loadState(services)` — loads health-state.json with unknown fallback for crash recovery
- `saveState(stateMap)` — persists Map to data/health-state.json on every state transition
- `runHealthCheck(services, stateMap, sendEmbed)` — detects transitions, posts embeds, saves state
- `runHeartbeat(stateMap, services, sendEmbed)` — posts heartbeat only when all services up
- `execAsync(cmd, timeoutMs)` — Promise wrapper for exec with 5000ms default timeout

## State Transition Matrix

| From | To | Action |
|------|----|--------|
| unknown | up | Silent (startup spam prevention) |
| unknown | down | POST DOWN embed |
| up | down | POST DOWN embed |
| down | up | POST UP embed |
| up | up | No action |
| down | down | No action |

## Service Configuration

- **HEALTH_MONITOR_SERVICES** (env, default: `'nanoclaw'`) — comma-separated app services
- App services use `systemctl --user is-active {name}` (user session scope)
- **CLOUDFLARE_TUNNEL_NAME** (env, optional) — enables cloudflared monitoring
- cloudflared uses `systemctl is-active cloudflared` (system scope, no --user)

## Test Coverage

- 25 tests for embed builders (colors, titles, descriptions, truncation, timestamps)
- 24 tests for health monitor core (state transitions, persistence, service configs, timers, exec timeout)
- 49 total tests, all green

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Notes

**Pre-existing build failures:** `npm run build` fails with 8 errors in `src/channels/whatsapp.ts` (missing @whiskeysockets/baileys) and `src/index.ts` (missing telegram.js). These errors existed before this plan. `src/health-monitor.ts` introduces zero new TypeScript errors.

The pre-existing test failures in `container-runner.test.ts`, `claw-skill.test.ts`, `remote-control.test.ts`, and `channels/discord.test.ts` are also unrelated to this plan — confirmed by running the suite without health-monitor files.

## Known Stubs

None — all functions are fully implemented. `startHealthMonitor` is a complete, wired module ready for integration in `src/index.ts` (plan 13-02).

## Self-Check: PASSED

Files created:
- src/health-monitor-embeds.ts: EXISTS
- src/health-monitor-embeds.test.ts: EXISTS
- src/health-monitor.ts: EXISTS
- src/health-monitor.test.ts: EXISTS

Commits:
- f870f24: feat(13-01): health monitor embed builders with tests
- 4079a05: feat(13-01): health monitor core with state tracking and tests
