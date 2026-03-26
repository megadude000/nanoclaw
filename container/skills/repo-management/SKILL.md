---
name: repo-management
description: |
  Clone, edit, commit, push, and create PRs on private GitHub repositories.
  Triggers: "edit repo", "fix bug in repo", "create PR", "clone repo",
  "push changes", "manage repo", "development", "code review", "merge".
---

# Repository Management

You can clone, edit, and push to private GitHub repositories. Authentication is handled via `GITHUB_TOKEN` (HTTPS) or SSH keys from the host.

## Working Directory

All repos live on the host at `/workspace/host/REPOS/` (maps to `~/REPOS` on the host machine).

```bash
cd /workspace/host/REPOS
```

## Clone a Private Repo

```bash
# HTTPS (uses GITHUB_TOKEN automatically)
cd /workspace/host/REPOS
git clone https://github.com/OWNER/REPO.git

# If repo already exists, pull latest
cd /workspace/host/REPOS/REPO && git pull
```

## Edit, Commit, Push Workflow

```bash
cd /workspace/host/REPOS/REPO

# Create a feature branch
git checkout -b fix/description

# Make changes using Edit/Write tools or bash
# ...

# Stage and commit
git add -A
git commit -m "fix: description of change"

# Push
git push -u origin fix/description
```

## Create a Pull Request

```bash
cd /workspace/host/REPOS/REPO
gh pr create --title "Fix: description" --body "Details of the change"
```

## Other GitHub Operations

```bash
# List open PRs
gh pr list

# View PR details
gh pr view 123

# List issues
gh issue list

# Create an issue
gh issue create --title "Bug: ..." --body "..."

# Review a PR
gh pr diff 123
gh pr review 123 --approve

# Merge a PR
gh pr merge 123 --squash
```

## Git Identity

The default git identity is "NanoClaw Agent <agent@nanoclaw.local>". Override per-repo if needed:

```bash
cd /workspace/host/REPOS/REPO
git config user.name "Andrii Panasenko"
git config user.email "your@email.com"
```

## Important Notes

1. **Always work on branches** — never commit directly to `main`
2. **Pull before editing** — `git pull` to get latest changes
3. **Repos persist** on the host at `~/REPOS/` (inside container: `/workspace/host/REPOS/`)
4. **Use `gh` CLI** for GitHub operations (PRs, issues, reviews)
5. **GITHUB_TOKEN** must be set in NanoClaw's `.env` file on the host
