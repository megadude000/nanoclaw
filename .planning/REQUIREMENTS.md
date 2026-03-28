# Requirements — v2.0 Agent Dashboard

## Milestone Scope

Transform #agents into a live operational dashboard and machine-searchable activity log where agents report status, blockers, handoffs, and where health monitoring routes to #logs. Telegram main chat stays clean for personal conversation.

---

## v2.0 Requirements

### Agent Status Reporting

- [x] **ASTATUS-01**: Agent posts "took #N [title]" embed to #agents when picking up a task or GitHub issue
- [x] **ASTATUS-02**: Agent posts "closed #N, PR #M" embed to #agents when completing a task
- [x] **ASTATUS-03**: Agent posts progress update embed to #agents during long-running tasks

### Blocker Reporting

- [ ] **BLOCK-01**: Agent posts blocker embed to #agents when hitting a permission error (no access to repo/API/file)
- [ ] **BLOCK-02**: Agent posts blocker embed to #agents when a service or tunnel is unavailable
- [ ] **BLOCK-03**: Agent posts blocker embed to #agents when facing a conflict or ambiguity requiring human input

### Agent Handoffs

- [ ] **HAND-01**: Agent posts structured handoff embed to #agents (what, to whom, why/context)

### Morning Digest

- [ ] **DIGEST-01**: Morning Digest routes to #agents channel instead of Telegram main
- [ ] **DIGEST-02**: Morning Digest removed from Telegram main routing

### Health Monitoring (#logs)

- [ ] **HEALTH-01**: Alfred monitors Cloudflare tunnels and posts status to #logs on state change (up/down)
- [ ] **HEALTH-02**: Alfred monitors key services (yw-dev, nanoclaw systemd) and posts to #logs on state change
- [ ] **HEALTH-03**: Alfred posts periodic heartbeat to #logs when all services are operational

### Agent Memory / Searchability

- [x] **SEARCH-01**: All #agents messages include structured metadata as embed fields — agent name, task ID, message type (status/blocker/handoff/digest) — machine-parseable
- [ ] **SEARCH-02**: Agent can query #agents message history via IPC command — filter by type, task ID, agent name, with configurable limit
- [ ] **SEARCH-03**: #agents serves as persistent chronological activity log — messages are never deleted

---

## Future Requirements

- Bidirectional handoff acknowledgement (receiving agent confirms pickup) — defer to v2.1
- #logs query capability (same as SEARCH-02 but for #logs) — defer to v2.1
- Cross-channel activity summary (daily digest of #agents + #logs) — defer to v2.1

## Out of Scope

- Replacing Telegram as primary conversational interface — Telegram stays for mobile/quick interactions
- Health alerts in #agents — health monitoring routes to #logs only
- Voice channel support — not needed for ops use case
- Discord slash commands — NanoClaw uses its own trigger pattern system

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| ASTATUS-01 | Phase 10 | Complete |
| ASTATUS-02 | Phase 10 | Complete |
| ASTATUS-03 | Phase 10 | Complete |
| BLOCK-01 | Phase 11 | Pending |
| BLOCK-02 | Phase 11 | Pending |
| BLOCK-03 | Phase 11 | Pending |
| HAND-01 | Phase 11 | Pending |
| DIGEST-01 | Phase 12 | Pending |
| DIGEST-02 | Phase 12 | Pending |
| HEALTH-01 | Phase 13 | Pending |
| HEALTH-02 | Phase 13 | Pending |
| HEALTH-03 | Phase 13 | Pending |
| SEARCH-01 | Phase 9 | Complete |
| SEARCH-02 | Phase 14 | Pending |
| SEARCH-03 | Phase 14 | Pending |
