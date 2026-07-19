---
status: deprecated
updated: 2026-07-19T00:00:00.000Z
source_hash: 4b6568dadf6aafee494ba1269baa7ffb9a849fee4016c1cfe13ca7cdbff48aa4
embedding_model: text-embedding-3-small
---

# ⚠️ Deprecated duplicate — canonical tree is `Areas/Work/Projects/YourWave/`

This directory is a diverged fork of the canonical YourWave docs (which CLAUDE.md's
Active Projects section points to). Do NOT update files here.

Known divergences (audited 2026-07-19):
- `yw.platform-spec.md` here is NEWER (2026-03-31) than the canonical copy (2026-03-23)
  — its cortex metadata + Atlas-scope edits should be ported to canonical before this
  directory is deleted.
- `yw.content-factory.md` here is OLDER (2026-03-17, still says "Shopify Blog") — ignore.
- Subdirs `arch/`, `atlas/`, `bootstrap/`, `Research/` exist only here — review before deleting.
- All other yw.* files were byte-identical to canonical at audit time.

Current platform status lives in `Areas/Work/Projects/YourWave/yw-core-status.md`.
