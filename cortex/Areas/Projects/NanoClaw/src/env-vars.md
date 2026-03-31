---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: environment variables across all modules
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - config
  - env
created: '2026-03-31'
project: nanoclaw
---
# Environment Variables

> All environment variables referenced across the NanoClaw codebase.

## Variables

- `ANTHROPIC_API_KEY` -- referenced in: container-runner.ts
- `ASSISTANT_HAS_OWN_NUMBER` -- referenced in: config.ts
- `ASSISTANT_NAME` -- referenced in: config.ts
- `CLAUDE_CODE_OAUTH_TOKEN` -- referenced in: container-runner.ts
- `CLOUDFLARE_TUNNEL_NAME` -- referenced in: health-monitor.ts
- `CONTAINER_IMAGE` -- referenced in: config.ts
- `CONTAINER_MAX_OUTPUT_SIZE` -- referenced in: config.ts
- `CONTAINER_TIMEOUT` -- referenced in: config.ts
- `CREDENTIAL_PROXY_PORT` -- referenced in: config.ts
- `DISCORD_BOT_TOKEN` -- referenced in: channels/discord.ts
- `DISCORD_MAIN_CHANNEL_ID` -- referenced in: channels/discord.ts
- `GITHUB_TOKEN` -- referenced in: github-issues-webhook.ts
- `HEALTH_CHECK_INTERVAL_MS` -- referenced in: health-monitor.ts
- `HEALTH_MONITOR_SERVICES` -- referenced in: health-monitor.ts
- `HOME` -- referenced in: config.ts, container-runner.ts, mount-security.ts
- `IDLE_TIMEOUT` -- referenced in: config.ts
- `LOG_LEVEL` -- referenced in: container-runner.ts, logger.ts
- `MAX_CONCURRENT_CONTAINERS` -- referenced in: config.ts
- `MAX_MESSAGES_PER_PROMPT` -- referenced in: config.ts
- `NOTION_API_KEY` -- referenced in: notion-webhook.ts
- `NOTION_WEBHOOK_PORT` -- referenced in: config.ts
- `ONECLI_URL` -- referenced in: config.ts
- `PROXY_BIND_HOST` -- referenced in: container-runtime.ts
- `SUDO_PASS` -- referenced in: channels/discord.ts
- `TELEGRAM_BOT_POOL` -- referenced in: config.ts
- `TELEGRAM_BOT_TOKEN` -- referenced in: channels/telegram.ts
- `TZ` -- referenced in: config.ts
- `WHISPER_MODEL` -- referenced in: transcription.ts
- `XDG_RUNTIME_DIR` -- referenced in: container-runner.ts
