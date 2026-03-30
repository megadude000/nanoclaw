---
phase: 15-qdrant-infrastructure
plan: 01
subsystem: infra
tags: [qdrant, docker, systemd, vector-database, hnsw, cosine]

requires:
  - phase: 14-cortex-schema-standard
    provides: "CortexFrontmatter field names and types for payload index design"
provides:
  - "Running Qdrant container at localhost:6333 with cortex-entries collection"
  - "Persistent bind-mount storage at data/qdrant/"
  - "systemd auto-start on boot via qdrant.service"
  - "4 keyword payload indexes: project, cortex_level, domain, status"
  - "Idempotent setup and collection scripts"
affects: [16-embedding-pipeline, 17-mcp-tools]

tech-stack:
  added: [qdrant/qdrant:latest]
  patterns: [idempotent-docker-setup, systemd-user-unit, qdrant-rest-api]

key-files:
  created:
    - scripts/qdrant-setup.sh
    - scripts/qdrant-collection.sh
    - .config/systemd/qdrant.service
  modified: []

key-decisions:
  - "Removed Requires=docker.service from systemd unit -- Docker runs as system service, not user service"
  - "Vector size 1536 for OpenAI text-embedding-3-small compatibility"
  - "HNSW m=16 ef_construct=100 -- standard defaults good for collections up to ~100K vectors"
  - "indexing_threshold=100 -- HNSW index builds after 100 points for small collection efficiency"

patterns-established:
  - "Qdrant REST API pattern: curl-based scripts for collection and index management"
  - "Docker container lifecycle: check exists -> check running -> start or create"

requirements-completed: [SCHEMA-02, SCHEMA-03]

duration: 3min
completed: 2026-03-30
---

# Phase 15 Plan 01: Qdrant Infrastructure Summary

**Qdrant vector database deployed as Docker container with cortex-entries collection, HNSW index, 4 payload indexes, systemd auto-start, and persistent bind-mount storage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T17:58:53Z
- **Completed:** 2026-03-30T18:01:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Qdrant running at localhost:6333 with cortex-entries collection (1536-dim Cosine vectors, HNSW m=16)
- 4 keyword payload indexes on project, cortex_level, domain, status for filtered search
- systemd user unit auto-starts Qdrant on boot, data persists via bind-mount at data/qdrant/
- Both scripts are fully idempotent -- safe to run repeatedly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Qdrant Docker setup script and systemd unit** - `6deac7d` (feat)
2. **Task 2: Create cortex-entries collection with payload indexes** - `7bc25a9` (feat)

## Files Created/Modified
- `scripts/qdrant-setup.sh` - Idempotent Docker run with localhost-only binding and persistent bind-mount
- `scripts/qdrant-collection.sh` - Collection creation with HNSW config and 4 payload indexes via REST API
- `.config/systemd/qdrant.service` - systemd user unit template for Qdrant lifecycle

## Decisions Made
- Removed `Requires=docker.service` from systemd unit because Docker runs as a system-level service, not a user-level one -- the `Requires` directive caused startup failure
- Vector size 1536 matches OpenAI text-embedding-3-small (per REQUIREMENTS.md EMBED-01)
- HNSW m=16, ef_construct=100 are standard defaults suitable for the expected collection size

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed docker.service dependency from systemd unit**
- **Found during:** Task 1 (systemd service start)
- **Issue:** `Requires=docker.service` caused `systemctl --user start qdrant.service` to fail with "Unit docker.service not found" because Docker is a system service, not a user service
- **Fix:** Removed `Requires=docker.service` line, kept `After=network.target`
- **Files modified:** .config/systemd/qdrant.service
- **Verification:** `systemctl --user start qdrant.service` succeeds, container starts
- **Committed in:** 6deac7d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for systemd unit to function on this system. No scope creep.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired and operational.

## Next Phase Readiness
- Qdrant is running and ready to receive embeddings from Phase 16 (embedding pipeline)
- cortex-entries collection schema matches Phase 14's locked frontmatter fields
- localhost:6333 REST API available for Phase 17 MCP tools

## Self-Check: PASSED

All 4 files found. All 2 commit hashes verified.

---
*Phase: 15-qdrant-infrastructure*
*Completed: 2026-03-30*
