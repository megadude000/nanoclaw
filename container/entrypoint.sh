#!/bin/bash
set -e

# Compile agent-runner TypeScript
cd /app && npx tsc --outDir /tmp/dist 2>&1 >&2
ln -s /app/node_modules /tmp/dist/node_modules
chmod -R a-w /tmp/dist

# Configure git identity (sensible defaults, agent can override)
git config --global user.name "NanoClaw Agent" 2>/dev/null || true
git config --global user.email "agent@nanoclaw.local" 2>/dev/null || true
git config --global init.defaultBranch main 2>/dev/null || true

# Configure GitHub token for HTTPS git operations and gh CLI
if [ -n "$GITHUB_TOKEN" ]; then
  # Git credential helper: uses GITHUB_TOKEN for any github.com HTTPS request
  git config --global credential.https://github.com.helper \
    '!f() { echo "username=x-access-token"; echo "password='$GITHUB_TOKEN'"; }; f' 2>/dev/null || true

  # Authenticate gh CLI
  echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
fi

# Configure SSH to use host keys if available (main group mounts host home)
if [ -d "/workspace/host/.ssh" ]; then
  mkdir -p ~/.ssh
  # Use host SSH keys for git operations
  export GIT_SSH_COMMAND="ssh -i /workspace/host/.ssh/id_ed25519 -i /workspace/host/.ssh/id_rsa -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/workspace/host/.ssh/known_hosts 2>/dev/null"
fi

# Set Sonnet as default model (agent can override per-subagent via model param)
mkdir -p ~/.claude && echo '{"model":"claude-sonnet-4-6"}' > ~/.claude/settings.json

# Read input and run agent
cat > /tmp/input.json
node /tmp/dist/index.js < /tmp/input.json
