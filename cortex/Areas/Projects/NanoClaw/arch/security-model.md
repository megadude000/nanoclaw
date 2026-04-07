---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  NanoClaw security model - IPC authorization, mount allowlist, sender
  allowlist, credential proxy, attack surface
project: nanoclaw
tags:
  - nanoclaw
  - security
  - ipc-auth
  - mount-security
  - sender-allowlist
  - credential-proxy
created: 2026-03-31T00:00:00.000Z
source_hash: 4728578dbd4b65429b049d1e0ce9ad602bfbb643498f20dc49e35223f3ed7d5b
embedding_model: text-embedding-3-small
---

# NanoClaw — Security Model

## Overview

NanoClaw's security model is layered: each layer closes a specific attack vector that exists because containers run Claude agents with broad tool access. The threat model is: a compromised or misbehaving agent attempts to escalate its privileges, exfiltrate secrets, impersonate another group, or modify host system configuration.

## Layer 1: IPC Authorization — Per-Group Namespace

Agents communicate with the host via file-based IPC. The authorization rule is strict:
- A non-main group agent can only send `message` IPC messages to its own registered JID
- Attempting to send a message to another group's JID is logged as a warning and blocked
- The main group (identified by `group.isMain === true`) can send to any JID

Why: without this, a compromised non-main group agent could impersonate another group or send messages to channels it has no business touching.

The host determines the source group from the IPC directory path (`{DATA_DIR}/ipc/{sourceGroup}/`), not from any field in the JSON payload itself. This prevents a group from forging its identity in the JSON.

## Layer 2: IPC Path Traversal Protection

For `cortex_write` IPC messages, the target path is resolved against the vault root and validated:
```
targetPath = path.resolve(vaultRoot, data.path)
if (!targetPath.startsWith(vaultRoot + path.sep)) { BLOCKED }
```
This prevents path traversal attacks (`../../etc/passwd`, `../../src/index.ts`) that would let an agent overwrite files outside the Cortex vault.

## Layer 3: Mount Security Allowlist

When a group requests additional filesystem mounts beyond the standard set, the requested paths are validated against an allowlist at `~/.config/nanoclaw/mount-allowlist.json`. This file is stored outside the project root deliberately — an agent with write access to the project root cannot modify its own mount allowlist.

Hard-blocked patterns regardless of allowlist: `.ssh`, `.gnupg`, `.gpg`, `.aws`, `.azure`, `.gcloud`, `.kube`, `.docker`, `credentials`, `.env`, `.netrc`, `.npmrc`, `.pypirc`, `id_rsa`, `id_ed25519`, `private_key`, `.secret`. These patterns match any path segment, so `/home/user/.ssh/authorized_keys` is blocked even if `/home/user/` is in the allowlist.

## Layer 4: .env Shadow Mount

The project root is mounted read-only into the main group container at `/workspace/project`. However, the `.env` file (which contains API keys) is shadowed by mounting `/dev/null` over `/workspace/project/.env`. This means the agent can see all source code but cannot read secrets.

Why: without the shadow, the main group agent could `cat /workspace/project/.env` and exfiltrate all API keys.

## Layer 5: Sender Allowlist

The sender allowlist (`src/sender-allowlist.ts`) controls who can trigger agent responses in non-main groups. Only whitelisted senders or messages from the bot itself can trigger processing. This prevents unauthorized users who know a group's JID from sending messages that would invoke an agent.

The allowlist is configurable per JID and supports wildcard patterns. It is loaded from disk on each message evaluation (not cached) so updates take effect immediately without restart.

## Layer 6: Credential Proxy (OneCLI)

API credentials (ANTHROPIC_API_KEY, etc.) are never injected into container environment variables. Containers authenticate via OneCLI, which acts as a credential proxy:
- Containers receive scoped, time-limited tokens
- If OneCLI is unavailable, containers have no credentials and fail gracefully
- Rotating credentials requires no container restarts

Why: environment variables can be read by any process inside the container. OneCLI tokens can be revoked; raw API keys cannot be selectively revoked without key rotation.

## Layer 7: Cortex Vault Read-Only

The Cortex vault is mounted read-only into all containers. Agents can read entries but cannot write directly to the filesystem — all vault writes must go through the `cortex_write` IPC channel, which applies the path traversal validation and routes through the host.

This ensures all Cortex writes are auditable (logged) and cannot bypass the vault boundary.

## What These Layers Prevent

| Attack | Layer(s) That Block It |
|--------|----------------------|
| Agent sends messages to another group | IPC authorization (Layer 1) |
| Agent overwrites host system files | IPC path traversal (Layer 2) |
| Agent mounts `/root/.ssh` | Mount allowlist + hard-blocked patterns (Layer 3) |
| Agent reads API keys from .env | .env shadow mount (Layer 4) |
| External user impersonates trusted sender | Sender allowlist (Layer 5) |
| Container exfiltrates credentials via env | OneCLI credential proxy (Layer 6) |
| Agent directly modifies Cortex vault | Read-only mount (Layer 7) |

## Known Gaps

The Cortex consistency layer (reconciliation, embedding freshness) is not a security concern but is a reliability concern — it is checked by the health monitor but not by the security model. Vault write integrity (validating that cortex_write content is semantically coherent) relies on the schema validation in `cortex-mcp-tools.ts`, not on any cryptographic mechanism.
