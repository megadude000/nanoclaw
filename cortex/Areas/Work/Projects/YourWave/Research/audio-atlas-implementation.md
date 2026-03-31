# Audio Atlas Implementation Plan
## YourWave Coffee Atlas — Article Audio Versions

**Date:** 2026-03-31
**Scope:** 82 articles across EN / CS / UK languages
**Goal:** Visitor hits Play on an article, listens to a natural-sounding audio version

---

## Table of Contents

1. [TTS / Audio Generation Options](#1-tts--audio-generation-options)
2. [Recommended Pipeline](#2-recommended-pipeline)
3. [NotebookLM Manual Workflow](#3-notebooklm-manual-workflow)
4. [Astro Implementation](#4-astro-implementation)
5. [Generation Script](#5-generation-script)
6. [Phased Rollout Plan](#6-phased-rollout-plan)
7. [File Size & Storage Estimates](#7-file-size--storage-estimates)
8. [Cost Summary](#8-cost-summary)

---

## 1. TTS / Audio Generation Options

### 1.1 NotebookLM (Google) — Audio Overview

NotebookLM's "Audio Overview" generates a podcast-style two-host dialogue from your uploaded sources. The two AI hosts analyse the document, write a conversational script, and record natural-sounding audio with emphasis, hesitation, and filler words — far more engaging than standard TTS.

**How it works:**
1. Upload a source (URL, PDF, plain text, Google Doc)
2. In the Studio panel, click "Audio Overview"
3. Optionally set format: Brief (2–3 min), Standard (5–6 min), Extended (8–10 min)
4. Generation runs in the background (~2–5 minutes)
5. Download — files are saved as **WAV** (not MP3)

**API access:**
- **Consumer NotebookLM (free/Plus):** No API. Manual only.
- **NotebookLM Enterprise:** `notebooks.audioOverviews.create` API method. One overview per notebook.
- **Google Cloud Podcast API (standalone):** `POST https://discoveryengine.googleapis.com/v1/projects/PROJECT_ID/locations/global/podcasts`. Accepts text, image, audio, or video as context (≤100,000 tokens total). Output is MP3. Currently **GA with allowlist** — requires contacting Google Cloud sales.

**Quality:** Best-in-class for naturalness. The two-host format is genuinely engaging, not robotic. Good for flagship content where human-like audio matters most.

**Cost:**
- Free tier: 3 Audio Overview downloads/day
- Plus ($14/month): 20 downloads/day
- Enterprise/Cloud Podcast API: pricing not publicly listed; requires a Google Cloud account and sales contact

**Automation:** Not feasible without the Enterprise API or browser automation (community tools like `notebooklm-podcast-automator` use Playwright). For 82 articles this is impractical at the free tier.

**Verdict:** Ideal for a small set of flagship articles. Not suitable for batch-generating all 82.

---

### 1.2 OpenAI TTS API

**Endpoint:** `POST https://api.openai.com/v1/audio/speech`

**Models:**

| Model | Use case | Quality |
|---|---|---|
| `tts-1` | Real-time, low latency | Good, slightly compressed |
| `tts-1-hd` | Pre-generated, stored | High quality, warmer |
| `gpt-4o-mini-tts` | Instructable voice | Best expressiveness |

**Voices (13 total):** alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar

**Pricing:**
- `tts-1`: **$0.015 per 1,000 characters** ($15 per 1M chars)
- `tts-1-hd`: **$0.030 per 1,000 characters** ($30 per 1M chars)
- `gpt-4o-mini-tts`: $0.60/1M input tokens + $12/1M audio output tokens

**Output formats:** mp3 (default), opus, aac, flac, wav, pcm

**Character limit per request:** 4,096 characters — articles must be chunked and concatenated

**Rate limits:** Tier-dependent. Free/Tier 1 accounts have very low RPM (~3 RPM for TTS-1). Tier 2+ is sufficient for batch work. Retry logic is essential.

**Language support:** Follows Whisper — broad multilingual support including Czech and Ukrainian.

**Cost estimate for 82 EN articles:**
- Average article: 900 words ≈ 6,000 characters
- 82 articles × 6,000 chars = 492,000 characters
- `tts-1-hd`: 492,000 × $0.030/1,000 = **~$14.76**
- `tts-1`: **~$7.38**

**API call example (Node.js):**
```typescript
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.audio.speech.create({
  model: 'tts-1-hd',
  voice: 'nova',        // warm, clear female voice
  input: articleText,   // max 4096 chars per call
  response_format: 'mp3',
  speed: 1.0,
});

const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync('output.mp3', buffer);
```

**Verdict:** Best choice for automation. Reliable API, good quality, very reasonable cost, simple auth.

---

### 1.3 ElevenLabs

**Free tier:** 10,000 characters/month (~10 minutes of audio). No commercial rights.

**Starter ($5/mo):** 30,000 characters/month. Commercial license. Instant voice cloning.

**Creator ($22/mo):** 100,000 characters/month. 192 kbps audio. Professional voice cloning.

**API pricing (standalone):**
- Flash/Turbo models: $0.06 per 1,000 characters
- Multilingual v2/v3: $0.12 per 1,000 characters

**Cost estimate for 82 EN articles (492,000 chars):**
- Flash: 492,000 × $0.06/1,000 = **$29.52**
- Multilingual v2: **$59.04**

**Voice quality:** Outstanding — arguably the best for expressive, natural-sounding speech. Particularly good for specialty/educational content. 1,000+ premade voices.

**CS/UK language support:** Excellent multilingual support via Multilingual v2/v3 models.

**Verdict:** Higher quality than OpenAI, but ~4× the cost for the same output. Worth considering if premium voice quality is a differentiator. Overkill for a first pass.

---

### 1.4 Google Cloud Text-to-Speech

**Voice tiers:**

| Voice type | Price per 1M characters | Free tier/month |
|---|---|---|
| Standard | $4 | 4M chars free |
| WaveNet | $16 | 1M chars free |
| Neural2 | $16 | 1M chars free |
| Studio / Chirp 3 HD | $30 | — |

**Cost estimate for 82 articles (492,000 chars):**
- WaveNet/Neural2: 492,000 chars is within the free 1M/month tier → **$0** for first month, ~$7.88/month ongoing
- New accounts also receive $300 in trial credits

**Quality:** WaveNet/Neural2 are excellent — natural-sounding, consistent. Studio voices are the premium tier (Chirp 3 HD).

**Czech/Ukrainian support:** Google Cloud TTS has good Czech (`cs-CZ`) voices. Ukrainian (`uk-UA`) support exists but voice selection is limited.

**Verdict:** Most cost-effective option. The 1M free characters/month covers all 82 EN articles in the first run. Good option if budget is the primary constraint.

---

### 1.5 Azure Neural TTS

**Pricing (2026):**

| Voice type | Price per 1M characters |
|---|---|
| Standard / Neural | ~$15–$16 |
| Neural HD | $22 (reduced from $30 in March 2026) |
| Custom Neural | $24 |
| Free tier (F0) | 5M chars/month |

**Cost estimate for 82 articles:** Within the 5M char/month free tier → **$0** ongoing at this scale.

**Voice portfolio:** 600+ neural voices, 150+ languages. Strong Czech and Ukrainian coverage.

**Quality:** Excellent. Azure Neural HD voices are competitive with ElevenLabs for many use cases.

**Verdict:** Excellent free tier (5M chars/month is very generous), strong multilingual support. Slightly more complex setup (requires Azure subscription) but very cost-efficient long-term.

---

### Comparison Table

| Service | Quality | EN Cost (82 articles) | CS/UK support | API | Automation |
|---|---|---|---|---|---|
| NotebookLM (consumer) | Best (podcast-style) | Free (manual only) | 50+ languages | None | No |
| **OpenAI tts-1-hd** | **Very good** | **~$15** | **Yes** | **Yes** | **Yes** |
| ElevenLabs (Multilingual v2) | Best (TTS) | ~$59 | Excellent | Yes | Yes |
| Google Cloud Neural2 | Very good | ~$0 (free tier) | Good (CS limited) | Yes | Yes |
| Azure Neural | Very good | ~$0 (free tier) | Excellent | Yes | Yes |

---

## 2. Recommended Pipeline

### Primary recommendation: OpenAI tts-1-hd

**Rationale:**
- One API key, no additional cloud account setup
- `tts-1-hd` produces warm, natural speech suitable for coffee educational content
- Voice `nova` (warm female) or `onyx` (deep male) suit the Atlas's editorial tone
- ~$15 total to generate all 82 EN articles is negligible
- Czech is supported; Ukrainian is supported
- Straightforward Node.js/TypeScript integration
- No vendor lock-in; easy to switch later

**Secondary option for budget-zero:** Azure Neural TTS — 5M char/month free tier easily covers all articles. Use if OpenAI budget is unavailable.

### Audio generation pipeline

```
src/content/atlas/en/*.mdx
         │
    [generation script]
         │
    ┌────┴────────────────┐
    │ 1. Parse MDX text   │
    │ 2. Strip MDX syntax │
    │ 3. Chunk to ≤4096   │
    │ 4. Call OpenAI TTS  │
    │ 5. Concatenate MP3  │
    │ 6. Save to public/  │
    │ 7. Update frontmatter│
    └─────────────────────┘
         │
  public/audio/atlas/en/{slug}.mp3
```

### Language voices

| Language | OpenAI voice recommendation |
|---|---|
| English (EN) | `nova` (warm, clear) or `onyx` (authoritative) |
| Czech (CS) | Input Czech text → OpenAI handles it natively |
| Ukrainian (UK) | Input Ukrainian text → OpenAI handles it natively |

OpenAI TTS uses the input text's language to auto-select pronunciation — no separate voice per language needed. The same voice can read Czech or Ukrainian text naturally.

### File storage

**Recommended: `public/audio/atlas/` (local, Git-LFS or not tracked)**

For 82 articles at ~3.5 MB each = ~287 MB total. Options:

| Option | Pros | Cons |
|---|---|---|
| `public/audio/atlas/` (local) | Zero config, works with Astro's static output | Inflates repo size |
| `public/audio/atlas/` + `.gitignore` | Clean repo, deploy separately | Manual deploy step |
| Cloudflare R2 | Free egress, $0.015/GB/month, CDN-native | Requires R2 setup |
| Bunny CDN | Cheap storage, global CDN | Another paid account |

**Decision:** Start with `public/audio/atlas/` excluded from Git (add to `.gitignore`). In CI/CD, upload audio files to Cloudflare R2 and reference them via CDN URLs in frontmatter. This keeps the repo clean and audio delivery fast globally.

**Cloudflare R2 cost estimate:**
- Storage: ~300 MB = 0.3 GB × $0.015 = **$0.0045/month** (essentially free)
- Egress: **$0** (R2 has no egress fees)
- Operations: negligible

### File format

**Use MP3 at 128 kbps mono.** Reasoning:
- Universal browser support (unlike OGG which needs a fallback)
- ~1 MB/minute → 8-minute article ≈ 8 MB per file
- Acceptable quality for speech
- OGG adds complexity for marginal benefit on modern browsers

Optionally generate OGG as a `<source>` fallback, but it's not necessary in 2026.

### File naming convention

```
public/audio/atlas/{lang}/{slug}.mp3

Examples:
  public/audio/atlas/en/ethiopia.mp3
  public/audio/atlas/cs/ethiopie.mp3
  public/audio/atlas/uk/efiopiya.mp3
```

Or with CDN:
```
https://audio.yourwave.uk/atlas/en/ethiopia.mp3
```

---

## 3. NotebookLM Manual Workflow

Use this for Phase 1 flagship articles where podcast quality is worth the manual effort.

### Step-by-step

**1. Prepare the article text**
Copy the full article text (strip MDX imports/components, keep headings and body). Optionally add a brief intro line: "This is an audio guide to [topic] from the YourWave Coffee Atlas."

**2. Create a NotebookLM notebook**
Go to [notebooklm.google.com](https://notebooklm.google.com). Create a new notebook named e.g. "Atlas – Ethiopia".

**3. Add the source**
Click "Add source" → "Copied text" → paste the article. Or add the live URL if the article is publicly accessible.

**4. Customize the Audio Overview**
In the Studio panel, before generating, click "Customize":
- **Format:** Extended (8–10 min) for flagship articles, Standard (5–6 min) for shorter pieces
- **Focus prompt:** Use something like:
  > "Create an engaging educational podcast about this coffee origin/processing method. The hosts should speak as knowledgeable coffee enthusiasts explaining specialty coffee to curious beginners. Use specific facts, sensory descriptions, and practical tips. Avoid generic filler. End with a key takeaway."

**5. Generate**
Click "Generate Audio Overview". Wait 2–5 minutes.

**6. Listen and evaluate**
Play through the audio. If it misses key points or is too generic, delete it and regenerate with a more specific focus prompt.

**7. Download**
Click the three-dot menu → "Download". The file saves as a **WAV file**.

**8. Convert to MP3**
WAV files are uncompressed and large (~50 MB for 8 minutes). Convert to MP3:
```bash
# Using ffmpeg (install once: brew install ffmpeg)
ffmpeg -i ethiopia.wav -codec:a libmp3lame -b:a 128k -ac 1 ethiopia.mp3
```
Or use an online converter (CloudConvert, etc.).

**9. Get duration**
```bash
ffprobe -v quiet -show_entries format=duration -of csv=p=0 ethiopia.mp3
# Returns seconds, e.g. 487.3 → convert to "8:07"
```

**10. Save to project**
Move the file to `public/audio/atlas/en/{slug}.mp3` and update the article's frontmatter.

### Time estimate per article

| Step | Time |
|---|---|
| Prepare text | 3 min |
| Create notebook + add source | 2 min |
| Set focus prompt + generate | 5–7 min wait |
| Listen + quality check | 5–8 min |
| Regenerate if needed | +5 min |
| Download + convert + save | 3 min |
| Update frontmatter | 2 min |
| **Total** | **~20–30 min per article** |

For 5 flagship articles: **~2–2.5 hours**

### Is it worth it vs automated TTS?

**Yes, for flagship articles** that represent the Atlas's best content (Ethiopia, Colombia, Gesha, etc.). The two-host dialogue format is:
- More engaging for first-time visitors
- Suitable for social sharing ("listen to our podcast on Gesha")
- Differentiated from generic AI voice

**No, for the bulk of 82 articles.** The manual effort (30 min × 77 articles = ~38 hours) is not justified. Use automated TTS for the long tail.

---

## 4. Astro Implementation

### 4.1 Content Collection Schema Update

In `src/content.config.ts` (or `src/content/config.ts` depending on project structure):

```typescript
import { z, defineCollection } from 'astro:content';

const atlasCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    publishDate: z.coerce.date(),
    // ... existing fields ...

    // Audio fields — both optional; player only renders when audioUrl is set
    audioUrl: z.string().url().optional(),
    audioDuration: z.string().optional(), // Format: "8:32" or "10:05"
  }),
});

export const collections = {
  atlas: atlasCollection,
};
```

### 4.2 Frontmatter Example

```yaml
---
title: "Ethiopia: The Birthplace of Coffee"
description: "Explore the origins, terroir, and processing methods..."
publishDate: 2024-11-15
audioUrl: /audio/atlas/en/ethiopia.mp3
audioDuration: "9:14"
---
```

Or with CDN:
```yaml
audioUrl: https://audio.yourwave.uk/atlas/en/ethiopia.mp3
audioDuration: "9:14"
```

### 4.3 AudioPlayer Component

Create `src/components/AudioPlayer.astro`:

```astro
---
interface Props {
  src: string;
  duration?: string;
  title?: string;
}

const { src, duration, title = 'Listen to this article' } = Astro.props;
---

<div class="audio-player" role="region" aria-label="Article audio player">
  <div class="audio-player__header">
    <svg
      class="audio-player__icon"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
    <span class="audio-player__label">{title}</span>
    {duration && <span class="audio-player__duration" aria-label={`Duration: ${duration}`}>{duration}</span>}
  </div>

  <audio
    class="audio-player__element"
    controls
    preload="metadata"
    aria-label={title}
  >
    <source src={src} type="audio/mpeg" />
    <p>Your browser does not support audio playback.
      <a href={src} download>Download the audio file</a>.
    </p>
  </audio>
</div>

<style>
  .audio-player {
    background: var(--color-surface, #f8f4f0);
    border: 1px solid var(--color-border, #e2d9d0);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    margin-block: 1.5rem;
    font-family: inherit;
  }

  .audio-player__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    color: var(--color-text-secondary, #6b5e52);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .audio-player__icon {
    flex-shrink: 0;
    color: var(--color-accent, #8b5e3c);
  }

  .audio-player__label {
    flex: 1;
  }

  .audio-player__duration {
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    color: var(--color-text-tertiary, #9b8e84);
  }

  .audio-player__element {
    width: 100%;
    height: 36px;
    accent-color: var(--color-accent, #8b5e3c);
  }

  /* Mobile */
  @media (max-width: 640px) {
    .audio-player {
      padding: 0.875rem 1rem;
    }
  }
</style>
```

**Note:** The native HTML5 `<audio controls>` element handles the progress bar, play/pause button, scrubbing, and keyboard shortcuts (Space, arrow keys) out of the box. This avoids a heavy custom player while remaining accessible. Browsers style it differently, but `accent-color` brings it in line with the brand. For a more custom look later, a small JS-based player (e.g. Howler.js or Plyr) can replace it.

### 4.4 Article Layout Integration

In the article layout (e.g. `src/layouts/AtlasArticle.astro`):

```astro
---
import AudioPlayer from '../components/AudioPlayer.astro';

const { entry } = Astro.props;
const { title, audioUrl, audioDuration } = entry.data;
---

<!-- Hero / article header area -->
<header class="article-header">
  <h1>{title}</h1>
  <!-- ... other meta ... -->

  {audioUrl && (
    <AudioPlayer
      src={audioUrl}
      duration={audioDuration}
      title="Listen to this article"
    />
  )}
</header>

<!-- Article body -->
<div class="prose">
  <Content />
</div>
```

The `{audioUrl && ...}` conditional ensures the player is completely absent from the DOM for articles without audio — no empty space, no broken UI.

### 4.5 Placement

Place the player **above the fold in the hero section**, directly below the article title and before the first paragraph. Research on audio players in editorial contexts shows users engage with audio more when it's visible immediately, not buried mid-article or at the bottom.

Suggested layout order:
1. Breadcrumb (Atlas > Origin > Ethiopia)
2. `<h1>` title
3. Meta line (publish date, read time, audio duration if available)
4. **AudioPlayer** ← here
5. Hero image
6. Article body

---

## 5. Generation Script

### 5.1 Setup

```bash
cd /path/to/atlas-project
npm install openai gray-matter fluent-ffmpeg @ffprobe-installer/ffprobe
# or: pnpm add openai gray-matter
```

### 5.2 Full Script: `scripts/generate-audio.ts`

```typescript
#!/usr/bin/env tsx
/**
 * generate-audio.ts
 * Batch-generates MP3 audio for Atlas articles using OpenAI TTS.
 *
 * Usage:
 *   tsx scripts/generate-audio.ts                    # all EN articles
 *   tsx scripts/generate-audio.ts --lang cs          # Czech articles
 *   tsx scripts/generate-audio.ts --slug ethiopia    # single article
 *   tsx scripts/generate-audio.ts --dry-run          # preview only
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import matter from 'gray-matter';
import OpenAI from 'openai';

// ─── Config ──────────────────────────────────────────────────────────────────

const LANG = process.argv.includes('--lang')
  ? process.argv[process.argv.indexOf('--lang') + 1]
  : 'en';

const SLUG_FILTER = process.argv.includes('--slug')
  ? process.argv[process.argv.indexOf('--slug') + 1]
  : null;

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_EXISTING = !process.argv.includes('--force');

const CONTENT_DIR = path.resolve(`src/content/atlas/${LANG}`);
const AUDIO_DIR = path.resolve(`public/audio/atlas/${LANG}`);
const MODEL = 'tts-1-hd';
const VOICE = 'nova'; // Change to 'onyx' for a male voice
const BITRATE = '128k';
const MAX_CHARS_PER_CHUNK = 4000; // OpenAI limit is 4096; leave headroom

// Delay between API calls (ms) to respect rate limits
const INTER_REQUEST_DELAY = 2000;
const MAX_RETRIES = 3;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Text processing ──────────────────────────────────────────────────────────

function stripMdx(content: string): string {
  return content
    // Remove import/export statements
    .replace(/^(import|export)\s+.+$/gm, '')
    // Remove JSX components (<ComponentName ... /> and <ComponentName>...</ComponentName>)
    .replace(/<[A-Z][a-zA-Z]*[^>]*\/>/g, '')
    .replace(/<[A-Z][a-zA-Z]*[^>]*>[\s\S]*?<\/[A-Z][a-zA-Z]*>/g, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove markdown images
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove heading hashes
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  // Split on sentence boundaries to avoid cutting mid-sentence
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];

  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── Audio utilities ──────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callTtsWithRetry(
  text: string,
  attempt = 1
): Promise<Buffer> {
  try {
    const response = await openai.audio.speech.create({
      model: MODEL,
      voice: VOICE as any,
      input: text,
      response_format: 'mp3',
      speed: 1.0,
    });
    return Buffer.from(await response.arrayBuffer());
  } catch (err: any) {
    if (attempt >= MAX_RETRIES) throw err;
    const isRateLimit = err?.status === 429;
    const delay = isRateLimit ? 30_000 : 5_000 * attempt;
    console.log(`  ⚠ Error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay / 1000}s...`);
    await sleep(delay);
    return callTtsWithRetry(text, attempt + 1);
  }
}

function concatenateMp3Files(inputFiles: string[], outputFile: string): void {
  if (inputFiles.length === 1) {
    fs.copyFileSync(inputFiles[0], outputFile);
    return;
  }
  // Use ffmpeg to concat audio without re-encoding
  const listFile = `${outputFile}.concat.txt`;
  fs.writeFileSync(listFile, inputFiles.map(f => `file '${f}'`).join('\n'));
  execSync(
    `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputFile}" -y 2>/dev/null`
  );
  fs.unlinkSync(listFile);
}

function getAudioDuration(filePath: string): string {
  try {
    const output = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf8' }
    ).trim();
    const totalSeconds = Math.round(parseFloat(output));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } catch {
    return ''; // ffprobe not available
  }
}

// ─── Frontmatter update ───────────────────────────────────────────────────────

function updateFrontmatter(
  filePath: string,
  audioUrl: string,
  audioDuration: string
): void {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  parsed.data.audioUrl = audioUrl;
  if (audioDuration) parsed.data.audioDuration = audioDuration;
  const updated = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(filePath, updated);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function processArticle(mdxFile: string): Promise<void> {
  const slug = path.basename(mdxFile, '.mdx');
  const outputMp3 = path.join(AUDIO_DIR, `${slug}.mp3`);
  const audioUrl = `/audio/atlas/${LANG}/${slug}.mp3`;

  console.log(`\n📄 ${slug}`);

  if (SKIP_EXISTING && fs.existsSync(outputMp3)) {
    console.log(`  ✓ Already exists, skipping (use --force to regenerate)`);
    return;
  }

  // Parse MDX
  const raw = fs.readFileSync(mdxFile, 'utf8');
  const { data: frontmatter, content } = matter(raw);
  const plainText = stripMdx(content);

  if (plainText.length < 100) {
    console.log(`  ⚠ Too short (${plainText.length} chars), skipping`);
    return;
  }

  // Estimate cost
  const charCount = plainText.length;
  const estimatedCost = (charCount / 1000) * 0.030;
  console.log(`  ℹ ${charCount} chars, ~$${estimatedCost.toFixed(4)} (tts-1-hd)`);

  if (DRY_RUN) {
    console.log(`  [dry-run] Would generate audio`);
    return;
  }

  // Chunk if needed
  const chunks = chunkText(plainText, MAX_CHARS_PER_CHUNK);
  console.log(`  → ${chunks.length} chunk(s)`);

  // Generate audio for each chunk
  const tmpFiles: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`  ⟳ Chunk ${i + 1}/${chunks.length}...`);
    const buffer = await callTtsWithRetry(chunks[i]);
    const tmpFile = path.join(AUDIO_DIR, `${slug}_chunk${i}.mp3`);
    fs.writeFileSync(tmpFile, buffer);
    tmpFiles.push(tmpFile);

    if (i < chunks.length - 1) {
      await sleep(INTER_REQUEST_DELAY);
    }
  }

  // Concatenate chunks
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  concatenateMp3Files(tmpFiles, outputMp3);

  // Cleanup tmp files
  tmpFiles.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));

  // Get duration
  const duration = getAudioDuration(outputMp3);
  if (duration) console.log(`  ✓ Duration: ${duration}`);

  // Update frontmatter
  updateFrontmatter(mdxFile, audioUrl, duration);
  console.log(`  ✓ Saved: ${outputMp3}`);
  console.log(`  ✓ Frontmatter updated`);
}

async function main(): Promise<void> {
  console.log(`\n🎙 YourWave Atlas Audio Generator`);
  console.log(`   Lang: ${LANG} | Model: ${MODEL} | Voice: ${VOICE}`);
  console.log(`   Source: ${CONTENT_DIR}`);
  console.log(`   Output: ${AUDIO_DIR}\n`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }

  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.mdx'))
    .filter(f => !SLUG_FILTER || f === `${SLUG_FILTER}.mdx`)
    .map(f => path.join(CONTENT_DIR, f))
    .sort();

  if (files.length === 0) {
    console.log('No MDX files found.');
    return;
  }

  console.log(`Found ${files.length} article(s) to process\n`);
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await processArticle(file);
      success++;
    } catch (err: any) {
      console.error(`  ✗ Failed: ${err.message}`);
      failed++;
    }
    // Brief pause between articles
    await sleep(500);
  }

  console.log(`\n─────────────────────────────`);
  console.log(`Done. ✓ ${success} | ↷ ${skipped} | ✗ ${failed}`);
}

main();
```

### 5.3 Usage Examples

```bash
# Install tsx if not already available
npm install -g tsx

# Preview without generating (dry run)
OPENAI_API_KEY=sk-... tsx scripts/generate-audio.ts --dry-run

# Generate all English articles
OPENAI_API_KEY=sk-... tsx scripts/generate-audio.ts

# Generate a single article
OPENAI_API_KEY=sk-... tsx scripts/generate-audio.ts --slug ethiopia

# Generate Czech articles (different voice if desired)
OPENAI_API_KEY=sk-... tsx scripts/generate-audio.ts --lang cs

# Force regenerate (overwrite existing)
OPENAI_API_KEY=sk-... tsx scripts/generate-audio.ts --force
```

### 5.4 Add to package.json

```json
{
  "scripts": {
    "audio:generate": "tsx scripts/generate-audio.ts",
    "audio:generate:cs": "tsx scripts/generate-audio.ts --lang cs",
    "audio:generate:uk": "tsx scripts/generate-audio.ts --lang uk",
    "audio:preview": "tsx scripts/generate-audio.ts --dry-run"
  }
}
```

### 5.5 Dependencies required

```bash
npm install openai gray-matter
# ffmpeg must be installed on the system (for multi-chunk concatenation and duration)
# macOS: brew install ffmpeg
# Ubuntu: sudo apt install ffmpeg
# Alpine (Docker): apk add ffmpeg
```

**Note:** If articles are short enough to fit in a single 4,096-char chunk (most 600-word articles ≈ 3,600 chars), ffmpeg is only needed for duration detection, not concatenation.

---

## 6. Phased Rollout Plan

### Phase 1 — Manual NotebookLM for 5 Flagship Articles

**Timeline:** 1 day

**Articles:**
- Ethiopia (`ethiopia.mdx`)
- Colombia (`colombia.mdx`)
- Kenya (`kenya.mdx`)
- Gesha / Geisha (`gesha.mdx`)
- Espresso Method (`espresso-method.mdx`)

**Process:** Follow the NotebookLM manual workflow in Section 3.
- Use Extended format (8–10 min) for origin articles
- Use Standard format (5–6 min) for method articles
- Convert WAV → MP3 with ffmpeg
- Place in `public/audio/atlas/en/`
- Update frontmatter manually

**Goal:** Validate that audio adds value to the user experience before investing in full automation. Get feedback from the founder and early readers.

**QA checklist:**
- [ ] Audio plays on desktop Chrome/Firefox/Safari
- [ ] Audio plays on mobile iOS/Android
- [ ] Player is visible above the fold
- [ ] Duration shows correctly
- [ ] No layout shift when player loads
- [ ] Articles without audio show no player or empty space

---

### Phase 2 — Automated TTS for All 82 EN Articles

**Timeline:** 1–2 days (setup) + ~2 hours for generation

**Steps:**

1. Install dependencies: `npm install openai gray-matter`
2. Install ffmpeg system-wide
3. Add the generation script at `scripts/generate-audio.ts`
4. Update the content collection schema to add optional `audioUrl` / `audioDuration`
5. Add the `AudioPlayer` component
6. Update the article layout to conditionally render the player
7. Run dry-run to verify text extraction: `npm run audio:preview`
8. Generate the 5 Phase 1 articles first to verify quality: `tsx scripts/generate-audio.ts --slug ethiopia`
9. Run the full batch: `npm run audio:generate`
10. Review 5–10 random articles for audio quality
11. Deploy

**Cost:** ~$15 for all 82 EN articles with `tts-1-hd`

**Storage strategy:** Add `public/audio/` to `.gitignore`. Deploy audio files separately (manual upload to Cloudflare R2 or server). Set `audioUrl` in frontmatter to the CDN URL.

---

### Phase 3 — CS and UK Audio

**Timeline:** 1 day per language (after Phase 2 is stable)

**Czech articles:**
```bash
OPENAI_API_KEY=sk-... tsx scripts/generate-audio.ts --lang cs
```
OpenAI handles Czech natively. Same `nova` voice works. Czech content likely at `src/content/atlas/cs/`.

**Ukrainian articles:**
```bash
OPENAI_API_KEY=sk-... tsx scripts/generate-audio.ts --lang uk
```
OpenAI TTS handles Ukrainian (Cyrillic). Same pipeline applies.

**Cost per language:** Similar to EN — ~$15 if the same article count.

**Possible refinement for Phase 3:** Test whether a different voice works better for Slavic languages. OpenAI's `nova` and `alloy` voices handle multilingual input well but run a quick test with 3 articles before full generation.

---

## 7. File Size & Storage Estimates

Average article: ~900 words → ~8 minutes of audio at a natural speaking pace

| Bitrate | Size/article | Total (82 articles) |
|---|---|---|
| 64 kbps mono | ~4 MB | ~328 MB |
| 128 kbps mono | ~8 MB | ~656 MB |

**Recommendation:** 128 kbps mono. Clear speech, manageable size. For reference:
- Cloudflare R2 would cost: 0.66 GB × $0.015 = **$0.01/month** for storage
- Total with CS and UK: ~2 GB storage = **$0.03/month**

---

## 8. Cost Summary

### One-time generation costs

| Phase | Articles | Characters | Model | Cost |
|---|---|---|---|---|
| Phase 1 (EN flagship, NotebookLM) | 5 | — | NotebookLM free | $0 |
| Phase 2 (EN automated) | 77 | ~462,000 | tts-1-hd | ~$13.86 |
| Phase 3 CS | ~27 | ~162,000 | tts-1-hd | ~$4.86 |
| Phase 3 UK | ~27 | ~162,000 | tts-1-hd | ~$4.86 |
| **Total** | **136** | | | **~$23.58** |

### Ongoing monthly costs

| Item | Cost |
|---|---|
| Cloudflare R2 storage (~2 GB) | ~$0.03/month |
| Regeneration of new articles (e.g. 2/month) | ~$0.36/month |
| OpenAI API key | Pay-as-you-go |
| **Total ongoing** | **~$0.40/month** |

### Summary

The entire audio project for all 82 articles across three languages costs approximately **$24 to generate** and less than **$0.50/month** to maintain. This is an exceptionally low cost for a meaningful content enhancement.

---

## References

- [OpenAI TTS API Reference](https://platform.openai.com/docs/api-reference/audio/createSpeech)
- [OpenAI TTS Guide](https://platform.openai.com/docs/guides/text-to-speech)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [Google Cloud TTS Pricing](https://cloud.google.com/text-to-speech/pricing)
- [Azure Speech Pricing](https://azure.microsoft.com/en-us/pricing/details/speech/)
- [NotebookLM Audio Overview Help](https://support.google.com/notebooklm/answer/16212820)
- [Google Cloud Podcast API](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/podcast-api)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [gray-matter (npm)](https://www.npmjs.com/package/gray-matter)

---

## Monetization & NotebookLM Button Strategy

*Added 2026-03-31*

### Option A — "Open in NotebookLM" Button (Free, Zero Cost)

NotebookLM supports a deep link that pre-adds a URL as a source:

```
https://notebooklm.google.com/?source=https://atlas.yourwave.uk/en/ethiopia
```

**Implementation:** Add a button to every article page (below the title, or in the audio player area):

```astro
<a
  href={`https://notebooklm.google.com/?source=https://atlas.yourwave.uk/en/${slug}`}
  target="_blank"
  rel="noopener"
  class="notebooklm-btn"
>
  🎧 Open in NotebookLM — generate your own podcast
</a>
```

**Why this works:**
- Zero cost to YourWave
- User generates their own Audio Overview (2-host conversational format) for free
- Drives brand awareness with Google NotebookLM users
- Users return to Atlas for more articles (traffic loop)
- Differentiator: no Czech specialty coffee brand does this

---

### Option B — Premium Podcast ($0.99 per article)

Pre-generated, high-quality ElevenLabs podcast version (2 voices, conversational format) sold per article or in bundles.

**Pricing ideas:**
- Single article: €0.99
- Full Atlas bundle (82 EN articles): €9.99
- Subscription: included in YourWave coffee subscription

**Tech stack needed:**
- Stripe payment link per article (or Stripe Checkout)
- Gated audio URL (signed S3/R2 URL with expiry, or simple token in DB)
- No DRM needed for €0.99 — friction would kill conversion

**Production cost:**
- ElevenLabs Multilingual v2: ~$0.12/1,000 chars
- Per 900-word article (~6,000 chars): ~$0.72 cost → sell at €0.99 → ~27% margin
- Or: use OpenAI tts-1-hd ($0.18/article) → sell at €0.99 → ~82% margin

---

### Recommended Phased Approach

| Phase | Action | Cost | Revenue |
|-------|--------|------|---------|
| 1 | "Open in NotebookLM" button on all articles | $0 | Brand awareness |
| 2 | OpenAI TTS for all 82 EN articles (auto-generated) | ~$15 | Free tier / waitlist perk |
| 3 | Premium ElevenLabs podcast for top 10 articles | ~$7 | Test €0.99 paywall |
| 4 | Full monetized audio library | ~$50 total | Subscription upsell |

**A/B test:** Show "NotebookLM" button to 50% of users, "€0.99 podcast" to other 50%. Measure which drives more email signups and conversion.
