---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/timezone.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - core
created: '2026-03-31'
project: nanoclaw
---
# timezone.ts

> Check whether a timezone string is a valid IANA identifier

## Exports

### Functions

- `isValidTimezone(tz: string)` -- Check whether a timezone string is a valid IANA identifier
- `resolveTimezone(tz: string)` -- Return the given timezone if valid IANA, otherwise fall back to UTC.
- `formatLocalTime(utcIso: string, timezone: string)` -- Convert a UTC ISO timestamp to a localized display string.
