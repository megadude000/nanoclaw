---
name: host-management
description: |
  Manage the host PC, Claude Code configuration, skills, agents, commands, and system settings.
  Triggers: "add a skill", "install a skill", "add an agent", "set up email", "configure",
  "install on the host", "add to claude", "update settings", "restart nanoclaw",
  "systemctl", "add command", "global config".
---

# Host PC & Claude Configuration Management

As the main group agent, you have **full writable access to the host PC** via `/workspace/host` (which maps to `~` on the host).

## Key Paths

| What | Container Path | Host Path |
|------|---------------|-----------|
| Host home | `/workspace/host` | `~` |
| Global Claude settings | `/workspace/host/.claude/settings.json` | `~/.claude/settings.json` |
| Global agents | `/workspace/host/.claude/agents/` | `~/.claude/agents/` |
| Global skills | `/workspace/host/.claude/skills/` | `~/.claude/skills/` |
| Global commands | `/workspace/host/.claude/commands/` | `~/.claude/commands/` |
| NanoClaw project | `/workspace/project` (read-only) | `~/nanoclaw/` |
| NanoClaw container skills | `/workspace/host/nanoclaw/container/skills/` | `~/nanoclaw/container/skills/` |
| NanoClaw container agents | `/workspace/host/nanoclaw/container/agents/` → symlink | `~/nanoclaw/container/agents/` |
| SSH config | `/workspace/host/.ssh/` | `~/.ssh/` |
| Email/system configs | `/workspace/host/.config/` | `~/.config/` |

## Adding a Skill to Claude Code (globally)

```bash
mkdir -p /workspace/host/.claude/skills/MY-SKILL
cat > /workspace/host/.claude/skills/MY-SKILL/SKILL.md << 'EOF'
---
name: my-skill
description: What triggers this skill
---
# Skill content here
EOF
```

**To also make it available in nanoclaw containers**, copy to nanoclaw's container/skills/:
```bash
cp -r /workspace/host/.claude/skills/MY-SKILL \
      /workspace/host/nanoclaw/container/skills/MY-SKILL
```

## Adding an Agent

```bash
cat > /workspace/host/.claude/agents/my-agent.md << 'EOF'
---
name: My Agent
description: When to use this agent
---
# Agent personality here
EOF
```

Nanoclaw picks it up automatically on next spawn (container/agents/ symlinks to ~/.claude/agents/).

## Restarting NanoClaw

```bash
systemctl --user restart nanoclaw
```

Or via IPC (from within a container message):
```bash
echo '{"type":"restart","chatJid":"CHAT_JID"}' > /workspace/ipc/messages/restart-$(date +%s%N).json
```

## System Configuration

For email, environment variables, or other system-level config:

```bash
# Edit nanoclaw .env (credentials)
nano /workspace/host/nanoclaw/.env

# Edit systemd service
systemctl --user edit nanoclaw

# Install a package
sudo apt-get install PACKAGE  # requires sudo access
```

## NanoClaw Self-Update

```bash
cd /workspace/host/nanoclaw
git pull
export PATH="$HOME/.local/share/fnm:$PATH"
eval "$(fnm env --shell bash)"
npm install && npm run build
systemctl --user restart nanoclaw
```

## Critical Rules

1. **Be careful with `/workspace/host`** — this is the real home directory. Changes are permanent.
2. **Never delete** `~/.claude/.credentials.json` or `~/.claude.json`
3. **After modifying nanoclaw source**, always rebuild: `npm run build` then `systemctl --user restart nanoclaw`
4. **After adding global skills/agents**, they take effect on the next nanoclaw container spawn (no restart needed)
