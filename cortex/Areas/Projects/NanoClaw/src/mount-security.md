---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/mount-security.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - core
created: '2026-03-31'
project: nanoclaw
source_hash: a511506dcfca439c0d248f8142ef07f0507d6c54084a1b127841d18e1096b6b5
embedding_model: text-embedding-3-small
---
# mount-security.ts

> Mount Security Module for NanoClaw

## Exports

### Functions

- `loadMountAllowlist()` -- Load the mount allowlist from the external config location.
- `validateMount(mount: AdditionalMount, isMain: boolean,)` -- Validate a single additional mount against the allowlist.
- `validateAdditionalMounts(mounts: AdditionalMount[], groupName: string, isMain: boolean,)` -- Validate all additional mounts for a group.
- `generateAllowlistTemplate()` -- Generate a template allowlist file for users to customize

### Interfaces

- `MountValidationResult`

## Environment Variables

- `HOME` -- referenced in this module
