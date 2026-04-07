---
type: session
date: 2026-03-31
time: 21:27
project: NanoClaw
topics: [upstream-sync, build-fixes, whatsapp-removal, qdrant, progress-tracker-bug]
status: archived
tags: [session]
---

# Session: 2026-03-31 21:27 — Upstream Sync, Build Fixes, Progress Tracker Debug

## Quick Reference
**Topics:** upstream NanoClaw sync, loose ends commit, build errors, WhatsApp removal, Qdrant health, progress tracker bug
**Projects:** NanoClaw
**Outcome:** Merged 52 upstream commits, fixed 4 build/test failures, removed WhatsApp, confirmed Qdrant has 84 indexed entries, partially diagnosed progress tracker bug (not yet fixed)

---

## Decisions Made
- WhatsApp removed entirely — `@whiskeysockets/baileys` missing from package.json, dynamic import was hiding the failure silently. Not used, deleted.
- Push target is `fork` remote (`megadude000/nanoclaw`), NOT `origin` (`qwibitai/nanoclaw` — upstream, no write access)
- Notion `secret_*` / `ntn_*` tokens must NEVER be in vault files — use `[redacted — stored in .env]`
- `discoverAfter` in ProgressTracker changed from `Date.now() - 1000` to `Date.now() - 300_000` (5min lookback for reused sessions) — but this did NOT fix the bug

---

## Key Learnings
- `git-filter-repo` removes ALL remotes after rewriting history — re-add manually
- `ContainerInput.model` was lost in upstream merge (upstream interface doesn't have it) — TypeScript caught it only due to object literal strict checking
- GitHub secret scanning blocks push on ALL commits containing secrets, not just HEAD — needed `git-filter-repo` twice (two separate secret patterns)
- Qdrant stores path as `file_path`, not `path` — scroll query was looking at wrong key
- Qdrant `active (exited)` in systemd = Docker container stopped (Type=oneshot doesn't auto-restart)
- ProgressTracker `discoverAfter` bug: on message 2, JSONL file mtime was from message 1 and older than 1s threshold — poller skipped it. Fixed to 5min but progress still doesn't spawn on msg 2
- Real bug likely: `setTyping` debug log not appearing at all (not even for msg 1 after restart) — Discord client may be null due to post-restart race, OR `onMessageSent` path isn't being called via `processGroupMessages` for the active dc-main container

---

## Files Modified
- `src/container-runner.ts` — added `model?: string` back to `ContainerInput`
- `src/remote-control.ts` — stdin `'pipe'` → `'ignore'`
- `src/channels/discord.ts` — added `isChatInputCommand: () => false` to 3 test mocks + debug logs on `setTyping` and `sendMessageRaw`
- `src/container-runner.test.ts` — added `CREDENTIAL_PROXY_PORT: 0` to config mock
- `src/cortex/parser.test.ts` — updated expectation (vault file now has cortex fields, strict mode passes)
- `src/channels/index.ts` — removed WhatsApp dynamic import
- `src/channels/whatsapp.ts` — deleted
- `src/channels/whatsapp.test.ts` — deleted
- `src/whatsapp-auth.ts` — deleted
- `src/progress-tracker.ts` — `discoverAfter: Date.now() - 300_000`
- `cortex/Areas/Projects/NanoClaw/arch/upstream-sync-findings-2026-03-31.md` — new, 6 findings
- `cortex/Areas/Work/Session-Logs/2026-03-25-hooks-gateway-setup.md` — secrets redacted
- `cortex/CLAUDE.md` — secret redacted

---

## Pending Tasks
- [ ] **Progress tracker bug**: On message 2, no progress message and typing shows only ~3s. Debug logs added to `setTyping` and `sendMessageRaw` in discord.ts. Next session: check if `setTyping called` log appears at all — if not, `this.client` is null (Discord client lost after restart). If yes, check `sendMessageRaw` failure.
- [ ] **Qdrant auto-restart**: systemd service is `Type=oneshot`, container doesn't auto-restart if it dies. Should add a separate `nanoclaw-qdrant.service` with `Type=simple` or use `docker run --restart=unless-stopped`
- [ ] **Remove debug logs** from `discord.ts` once progress tracker is fixed

---

## Errors & Workarounds
- GitHub push blocked by secret scanning: ran `git-filter-repo --force --replace-text` twice (two separate passes for different token patterns)
- Qdrant crashed on nanoclaw restart (timing issue): must `docker start nanoclaw-qdrant` before `systemctl --user restart nanoclaw`
- Build failed after upstream merge: `ContainerInput` missing `model`, WhatsApp missing dep, `remote-control` stdin wrong, discord test mocks incomplete, parser test stale

---

## Raw Session Log

**Upstream sync:**
- Local main: 411 commits ahead of merge-base, origin/main: 52 new upstream commits
- Committed all loose ends: untracked `telegram.ts`, cortex source (17 files), container skills (persist/resume), 45 cortex vault files, planning artifacts
- Merged origin/main — got stale session recovery (`deleteSession` + logic), v1.2.43, npm audit fixes, setup skill Apple Container update
- Push blocked: `megadude000` has no write access to `qwibitai/nanoclaw`. Found personal fork at `megadude000/nanoclaw`, added as `fork` remote
- Push blocked again: 4 Notion tokens in session logs + CLAUDE.md across commit history. Installed `git-filter-repo`, ran twice to scrub all patterns. Re-added all 5 remotes. Force-pushed successfully.

**Build/test fixes:**
- `npm run build`: 2 errors — missing `model` on ContainerInput, missing `@whiskeysockets/baileys`
- `npm test`: 8 failures in 4 files — CREDENTIAL_PROXY_PORT mock, remote-control stdin, discord interaction mocks, parser test
- All fixed, 718/718 tests pass, WhatsApp deleted per user request

**Cortex findings entry:**
- Wrote 6 findings to `cortex/Areas/Projects/NanoClaw/arch/upstream-sync-findings-2026-03-31.md`

**Qdrant check:**
- 84 points in `cortex-entries` collection: nanoclaw(53), yourwave(24), nightshift(4), contentfactory(3)
- Watcher IS working — new files get `source_hash` + `embedding_model` added to frontmatter
- Qdrant container keeps dying (Type=oneshot service). Fixed each time with `docker start nanoclaw-qdrant`

**Progress tracker debug:**
- First message: progress shows, typing works
- Second message: no progress, typing ~3s only
- Investigation: ProgressTracker.onMessageSent does fire (JSONL discovered log at 21:55:39), but no typing/sendMessage logs follow
- Hypothesis 1 (wrong): `discoverAfter` 1s threshold skips reused JSONL from msg1 → fixed to 300s → still broken
- Hypothesis 2 (current): `setTyping` debug log not appearing at all after restart → `this.client` may be null in Discord channel after service restart race condition
- Debug logs added to `discord.ts` setTyping + sendMessageRaw, service restarted, awaiting test
