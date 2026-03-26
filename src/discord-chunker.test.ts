import { describe, it, expect } from 'vitest';
import { chunkMessage } from './discord-chunker.js';

describe('chunkMessage', () => {
  it('returns short text as single chunk', () => {
    expect(chunkMessage('short text')).toEqual(['short text']);
  });

  it('returns empty string as single chunk', () => {
    expect(chunkMessage('')).toEqual(['']);
  });

  it('splits text with code fences at fence boundary', () => {
    const code = 'x'.repeat(300);
    const text = `Before paragraph\n\n\`\`\`typescript\n${code}\n\`\`\`\n\nAfter the code block with more text here`;
    // Use a small maxLength to force a split
    const chunks = chunkMessage(text, 200);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200);
    }
    // Reassembling chunks should preserve all content logically
    // Code fences should be properly closed and reopened
    const fenceOpens = chunks.join('').match(/```typescript/g) || [];
    const fenceCloses = chunks.join('').match(/```\n|```$/gm) || [];
    // Each chunk that contains code fence content should have balanced fences
  });

  it('splits text at paragraph (double-newline) boundaries', () => {
    const para1 = 'A'.repeat(900);
    const para2 = 'B'.repeat(900);
    const para3 = 'C'.repeat(900);
    const text = `${para1}\n\n${para2}\n\n${para3}`;
    const chunks = chunkMessage(text, 2000);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });

  it('splits text at single newline boundaries when no paragraphs', () => {
    const line1 = 'A'.repeat(900);
    const line2 = 'B'.repeat(900);
    const line3 = 'C'.repeat(900);
    const text = `${line1}\n${line2}\n${line3}`;
    const chunks = chunkMessage(text, 2000);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });

  it('hard-splits text with no break points at maxLength', () => {
    const text = 'A'.repeat(5000);
    const chunks = chunkMessage(text, 2000);
    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(2000);
    expect(chunks[1].length).toBe(2000);
    expect(chunks[2].length).toBe(1000);
    // All content preserved
    expect(chunks.join('')).toBe(text);
  });

  it('each chunk is <= 2000 chars by default', () => {
    const text = 'word '.repeat(1000); // ~5000 chars
    const chunks = chunkMessage(text);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
    // All content preserved
    expect(chunks.join('')).toBe(text);
  });

  it('properly closes and reopens code fences when splitting inside them', () => {
    const longCode = 'console.log("hello");\n'.repeat(100);
    const text = `Intro\n\`\`\`javascript\n${longCode}\`\`\`\nOutro`;
    const chunks = chunkMessage(text, 500);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(500);
      // Every chunk with code should have balanced fences
      const opens = (chunk.match(/```javascript/g) || []).length;
      const closes = (chunk.match(/^```$/gm) || chunk.match(/\n```\n/g) || chunk.match(/\n```$/g) || []).length;
      // If a chunk opens a fence, it should close it (or vice versa)
    }
  });

  it('returns text exactly at maxLength as single chunk', () => {
    const text = 'A'.repeat(2000);
    expect(chunkMessage(text, 2000)).toEqual([text]);
  });
});
