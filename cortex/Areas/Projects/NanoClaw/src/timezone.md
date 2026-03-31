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
source_hash: 42e0412780808c48fc51b20d0028a04052a75936c1c0b7893e3145dcdd7a82e8
embedding_model: text-embedding-3-small
---
# timezone.ts

> Check whether a timezone string is a valid IANA identifier

## Exports

### Functions

- `isValidTimezone(tz: string)` -- Check whether a timezone string is a valid IANA identifier
- `resolveTimezone(tz: string)` -- Return the given timezone if valid IANA, otherwise fall back to UTC.
- `formatLocalTime(utcIso: string, timezone: string)` -- Convert a UTC ISO timestamp to a localized display string.
