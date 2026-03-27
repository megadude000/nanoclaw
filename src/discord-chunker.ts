/**
 * Markdown-aware message chunker for Discord's 2000-char limit.
 *
 * Split priority: code fence boundary > paragraph (double newline) >
 * single newline > hard split at maxLength.
 *
 * When splitting inside a code fence, the current chunk gets a closing
 * ``` and the next chunk gets an opening ```{lang}.
 */

export function chunkMessage(text: string, maxLength = 2000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;
  let insideFence = false;
  let fenceLang = '';

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Calculate overhead for fence close/open
    const closeTag = '\n```';
    const openTag = `\`\`\`${fenceLang}\n`;

    // We need to figure out if a chunk carved from remaining will end
    // inside a fence. To do that conservatively, reserve space for
    // fence close in case we need it.
    const reserve = insideFence
      ? closeTag.length
      : fenceCloseReserve(remaining, maxLength);
    const effectiveMax = Math.max(
      maxLength - reserve,
      Math.floor(maxLength * 0.3),
    );

    const effectiveSlice = remaining.slice(0, effectiveMax);

    // Try split points in priority order
    let splitAt = trySplitAtFenceBoundary(effectiveSlice);
    if (splitAt === -1) splitAt = trySplitAtParagraph(effectiveSlice);
    if (splitAt === -1) splitAt = trySplitAtNewline(effectiveSlice);
    if (splitAt === -1) splitAt = effectiveMax; // hard split

    let chunk = remaining.slice(0, splitAt);
    remaining = remaining.slice(splitAt);

    // Determine fence state at end of this chunk
    const endState = computeFenceState(chunk, insideFence, fenceLang);

    if (endState.insideFence) {
      // Close fence in current chunk, reopen in next
      chunk = chunk + closeTag;
      const reopenTag = `\`\`\`${endState.lang}\n`;
      remaining = reopenTag + remaining;
      // Next iteration starts inside a fence
      insideFence = true;
      fenceLang = endState.lang;
    } else {
      insideFence = false;
      fenceLang = '';
    }

    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Check if carving up to maxLength chars from text would enter a code fence.
 * If so, return space needed for a closing fence tag.
 */
function fenceCloseReserve(text: string, maxLength: number): number {
  const slice = text.slice(0, maxLength);
  const state = computeFenceState(slice, false, '');
  return state.insideFence ? 4 : 0; // '\n```' = 4 chars
}

/**
 * Walk through text tracking fence open/close state.
 */
function computeFenceState(
  text: string,
  startInside: boolean,
  startLang: string,
): { insideFence: boolean; lang: string } {
  let inside = startInside;
  let lang = startLang;

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (inside) {
      if (trimmed === '```') {
        inside = false;
        lang = '';
      }
    } else {
      const match = trimmed.match(/^```(\w*)$/);
      if (match) {
        inside = true;
        lang = match[1] || '';
      }
    }
  }

  return { insideFence: inside, lang };
}

/**
 * Try to find a code fence boundary to split at.
 * Look for ``` on its own line, preferring the last occurrence.
 */
function trySplitAtFenceBoundary(text: string): number {
  const minSplit = Math.floor(text.length * 0.3);

  // Look for closing fence followed by newline
  const idx = text.lastIndexOf('\n```\n');
  if (idx >= minSplit) return idx + 4; // after \n```\n

  // Also check if text ends with \n```
  if (text.endsWith('\n```') && text.length - 4 >= minSplit) {
    return text.length;
  }

  return -1;
}

/**
 * Try to split at a paragraph boundary (double newline).
 */
function trySplitAtParagraph(text: string): number {
  const minSplit = Math.floor(text.length * 0.3);
  const idx = text.lastIndexOf('\n\n');
  if (idx >= minSplit) return idx + 2;
  return -1;
}

/**
 * Try to split at a single newline.
 */
function trySplitAtNewline(text: string): number {
  const minSplit = Math.floor(text.length * 0.3);
  const idx = text.lastIndexOf('\n');
  if (idx >= minSplit) return idx + 1;
  return -1;
}
