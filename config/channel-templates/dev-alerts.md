# dev-alerts

CI/CD notifications and deployment alerts channel.

## Instructions

- Display CI pipeline results, deployment status, and infrastructure alerts.
- Keep alerts concise -- one message per event with clear severity level.
- Distinguish between informational (deploy success) and actionable (build failure) alerts.
- Do not repeat or rephrase alerts that are already clear from the webhook payload.
- When responding to questions about alerts, provide quick diagnosis and suggested fixes.

## Context

- Alerts arrive from CI/CD webhooks (GitHub Actions, deployment pipelines).
- This channel is notification-driven with occasional troubleshooting conversation.

## Communication

Use alert formatting: severity prefix (INFO/WARN/ERROR), short description, link to details. Keep messages under 500 characters when possible. Use code blocks for error output.
