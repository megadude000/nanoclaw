# Phase 15: Qdrant Infrastructure - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy a persistent Qdrant vector database running as a Docker container with systemd lifecycle management. The collection schema (payload indexes) derives from Phase 14's locked frontmatter fields. No embedding pipeline, no MCP tools — just infrastructure that's ready to receive vectors.

</domain>

<decisions>
## Implementation Decisions

### Storage & persistence
- **D-01:** Bind-mount to `./data/qdrant/` inside the NanoClaw project directory. Visible in file explorer, easy to backup alongside the project, git-ignorable.
- **D-02:** `data/qdrant/` must be added to `.gitignore` to prevent accidental commits of binary vector data.

### Claude's Discretion
- Deployment method — systemd unit vs docker-compose.yml (project already uses systemd for nanoclaw itself, so systemd unit is the natural fit)
- Network access — agent containers reach Qdrant via `host.docker.internal` (already handled in `container-runtime.ts` with `--add-host` on Linux)
- Port exposure — localhost-only binding (127.0.0.1:6333) vs 0.0.0.0 (Claude decides based on security posture)
- Qdrant collection configuration — cosine distance, HNSW index params, payload indexes on project/cortex_level/domain/status
- Snapshot/backup strategy beyond the bind-mount

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/14-cortex-schema-standard/14-CONTEXT.md` — Schema fields that become Qdrant payload indexes (cortex_level, confidence, domain, scope, source_hash, embedding_model)

### Research findings
- `.planning/research/STACK.md` — @qdrant/js-client-rest ^1.17.0, Qdrant Docker setup
- `.planning/research/ARCHITECTURE.md` — Qdrant integration architecture, host-side deployment, Docker networking
- `.planning/research/PITFALLS.md` — Volume persistence as most preventable disaster, snapshot backup recommendation

### Existing infrastructure patterns
- `src/container-runtime.ts` — Docker runtime abstraction, `host.docker.internal` handling, `hostGatewayArgs()` for Linux
- `container/build.sh` — Existing container build script pattern
- `CLAUDE.md` §Development — systemd service management commands (systemctl --user start/stop/restart nanoclaw)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `container-runtime.ts`: Already abstracts Docker operations, provides `CONTAINER_HOST_GATEWAY`, `hostGatewayArgs()`, `readonlyMountArgs()`, `stopContainer()`
- systemd user services pattern: NanoClaw already runs as `systemctl --user` service — Qdrant can follow the same pattern

### Established Patterns
- `CONTAINER_RUNTIME_BIN = 'docker'` — all Docker commands go through this constant
- `host.docker.internal` on Linux: `--add-host=host.docker.internal:host-gateway` already handled
- Service management: `systemctl --user start/stop/restart` for user-level services

### Integration Points
- Qdrant must be accessible from both host process (embedding pipeline, Phase 16) and agent containers (MCP tools, Phase 17)
- Agent containers already use `host.docker.internal` to reach credential proxy — same pattern for Qdrant
- `./data/qdrant/` bind-mount needs to be in `.gitignore`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard Qdrant Docker deployment following existing infrastructure patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-qdrant-infrastructure*
*Context gathered: 2026-03-28*
