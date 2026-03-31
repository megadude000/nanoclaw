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
source_hash: d27eaa191864f1e37624c68dbe3971a30b4b2ffdeba6252ea3050620b142c4ae
embedding_model: text-embedding-3-small
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
