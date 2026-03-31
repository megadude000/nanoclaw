---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/image.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - core
created: '2026-03-31'
project: nanoclaw
---
# image.ts

> Exports from image.ts

## Exports

### Functions

- `processImage(buffer: Buffer, groupDir: string, caption: string,)` -- Resize an image buffer and save it to the group's attachments directory.
- `parseImageReferences(messages: Array<{ content: string }>,)` -- Scan an array of messages for [Image: attachments/...] references

### Interfaces

- `ProcessedImage`
- `ImageAttachment`
