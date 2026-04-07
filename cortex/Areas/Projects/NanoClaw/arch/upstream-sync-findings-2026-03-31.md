---
type: findings
cortex_level: L30
confidence: high
domain: nanoclaw
project: NanoClaw
scope: internal
date: 2026-03-31T00:00:00.000Z
topics:
  - git
  - upstream-sync
  - build
  - security
  - whatsapp
  - stale-sessions
source_hash: 1a1bf1f98160674372a3dcb0f3b92e49c3b5cfeb9d6a1cbd892bb93654b578ad
embedding_model: text-embedding-3-small
---

# Curious Findings: Upstream Sync & Build Cleanup (2026-03-31)

## Context
Full upstream sync of `qwibitai/nanoclaw` → local `main`, plus build/test cleanup session.
Local was 411 commits ahead of merge-base; upstream had 52 new commits.

---

## Finding 1: Secrets in Cortex Vault Files Block GitHub Push

Notion webhook secrets (`secret_...` and `ntn_...` tokens) were documented verbatim in session log files and `cortex/CLAUDE.md`. GitHub's secret scanning silently blocked the push.

**Why curious:** The push failure message only shows the first blocked file and a URL — easy to miss that there are more secrets across multiple commits. Had to run `git-filter-repo` twice to scrub all of them.

**Lesson:** Never write raw `secret_*` or `ntn_*` tokens in vault files. Use `[redacted — stored in .env]` as placeholder. Session logs are especially risky since they're conversational and tokens get pasted carelessly.

---

## Finding 2: `git-filter-repo` Silently Removes All Remotes

After rewriting history with `git-filter-repo`, ALL configured remotes are deleted as a safety measure. The tool prints a notice but it's easy to miss in the output.

**Why curious:** After the first filter-repo run, `origin` was gone. Had to re-add all 5 remotes (origin, fork, discord, gmail, whatsapp) manually.

**Lesson:** After any `git-filter-repo` run, always run `git remote -v` before pushing. Keep a local note of remotes if the repo has many.

---

## Finding 3: `ContainerInput.model` Was Lost in the Upstream Merge

`task-scheduler.ts` passes `model` in the `ContainerInput` object, but the upstream version of `ContainerInput` in `container-runner.ts` never had the field. The merge silently reverted to the upstream interface, dropping our custom field.

**Why curious:** TypeScript caught it at build time — but only because `model` was passed as an object literal (strict excess property checking). If it had been spread via `...input`, it would have silently disappeared at runtime with no error.

**Lesson:** After merging upstream, always run `npm run build` immediately. Interface fields added for custom features are prime collision points with upstream merges.

---

## Finding 4: WhatsApp Channel Was Silently Broken

`src/channels/whatsapp.ts` imported `@whiskeysockets/baileys` which was never in `package.json`. The channel was loaded via a dynamic import with `.catch(() => {})` in `channels/index.ts`, so the missing dep was swallowed at runtime — no startup error, the channel just never registered.

**Why curious:** The silent catch meant WhatsApp appeared to "work" (no crash) while actually not being loaded at all. Only discovered when the TypeScript build failed because the file existed in the compilation step.

**Resolution:** Removed WhatsApp entirely (not used). The dynamic import pattern is useful for truly optional skills, but hides missing deps — if a channel is required, use a static import.

---

## Finding 5: Upstream Added Stale Session Auto-Recovery

`qwibitai/nanoclaw` v1.2.43 merged `deleteSession()` in `db.ts` and stale session detection logic in `index.ts`. When a container agent exits with error and the error matches `/no conversation found|ENOENT.*\.jsonl|session.*not found/i`, the session ID is cleared from both memory and DB so the next retry starts fresh.

**Why curious:** Without this, a corrupted `.jsonl` session file causes infinite retry loops — every message to that group fails until the session is manually cleared from the DB. The fix is ~20 lines but eliminates a whole class of hard-to-diagnose stuck-group bugs.

---

## Finding 6: Personal Fork Was Missing as a Remote

`origin` pointed to `git@github.com:qwibitai/nanoclaw.git` (upstream, `megadude000` has no write access). The personal fork `megadude000/nanoclaw` existed on GitHub but was never configured as a remote locally. All push attempts were silently going to the wrong place.

**Fix:** `git remote add fork git@github.com:megadude000/nanoclaw.git` — push to `fork main`, not `origin main`.
