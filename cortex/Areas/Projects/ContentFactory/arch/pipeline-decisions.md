---
cortex_level: L20
confidence: high
domain: yourwave
scope: >-
  ContentFactory pipeline key decisions - why Claude over n8n, 3-stage approval
  model, image gen tiers, platform selection
project: ContentFactory
tags:
  - contentfactory
  - pipeline
  - decisions
  - approval
  - image-generation
  - claude-orchestration
created: 2026-03-31T00:00:00.000Z
source_hash: 2116ffee2f2ae8dc2c8174e811953b002916049b44ca0f25729419e1ff298816
embedding_model: text-embedding-3-small
---

# ContentFactory — Pipeline Architecture Decisions

## Why Claude as Orchestrator Instead of n8n

The original automation approach for content production was n8n — a visual workflow tool that connects nodes in a fixed graph. It was rejected because n8n is rigid and not responsive: it executes a predetermined sequence but cannot reason about content quality, make cost/quality tradeoffs transparently, or adapt when something in the pipeline produces unexpected results.

Claude as orchestrator is conversational and reasoning-capable. It can evaluate whether a generated image concept matches the tone of the article, explain its cost/quality tradeoff recommendation ("Flux $0.003 vs Midjourney $0.05 — recommend Flux for landscape shots"), and revise based on feedback in natural language. The pipeline is a workflow but the execution is intelligent.

The distinction matters because content production is inherently judgment-heavy — the same "pipeline step" (image generation) requires different tools and approaches depending on the subject matter, target platform, and quality level needed.

## 3-Stage Approval Model: Why Not Fully Automatic

The pipeline has three human approval checkpoints: pre-production (concept approval), production (final asset approval), and post-production (analytics review). This is not just user preference — it reflects the current state of AI content generation.

Pre-prod approval prevents wasted production spend: generating a high-quality final image ($0.05) only makes sense once the concept direction is confirmed. Showing a cheap concept image first (~$0.003) and getting approval before committing to production spend is the cost-efficient path.

Prod approval ensures the final assets meet the brand standard before publishing. AI generation at 95% quality still occasionally produces outputs that need rejection or regeneration.

Post-prod review closes the feedback loop: Instagram Insights data flows back to the same Notion card 48–72 hours after publishing, enabling Claude to recommend adjustments for the next content set.

**Rejected: fully automatic end-to-end pipeline** — insufficient trust in current AI image generation quality for unreviewed publishing. Manual checkpoints are the correct MVP position.

## Approval UI: Notion Comments, Not a Custom Dashboard

Approval triggers are Notion comments. Claude monitors comment content via Notion MCP and advances pipeline stages automatically when explicit approval words appear (`ok`, `approve`, `✅`, `good`, `+`). If there are revision notes, Claude reads and implements them, then waits for re-approval.

**Rejected: custom Telegram bot approval** — Notion provides a persistent record of approvals, revision history, and content assets in one place. A Telegram approval flow loses context between sessions.

**Rejected: email-based approval** — too slow, lacks context.

**Variant B chosen: each card has its own sub-database** (not a shared approval board). Each content card in the pipeline DB has its own inline Pre-prod Approval sub-database with 4 subtasks (Text Draft, Caption, Visual Concept, Cost Plan). This preserves per-content-piece audit trails rather than mixing all approvals in one board.

## Image Generation: Two-Tier Quality Model

| Stage | Tool | Quality | Purpose |
|-------|------|---------|---------|
| Pre-prod concept | DALL-E 3 / Flux cheap | ~80% | Direction confirmation, low spend |
| Production final | Flux standard / Midjourney | ~95% | Publication-ready assets |

The two-tier model is explicit about cost/quality intent. Claude presents the cost plan as part of the pre-prod card: "Flux $0.003 vs Midjourney $0.05 — recommend Flux." The human approves or upgrades. Figma is used only for final polish when AI output reaches 90% but not 100% — the goal is AI-generated assets, not Figma-designed assets.

## Platform Scope: Instagram + Atlas First

MVP platforms: Instagram (Graph API for automatic posting) and atlas.yourwave.coffee (Blog/Atlas CMS API). TikTok, Pinterest, and video generation (Runway/Kling) are Phase 2.

Instagram was chosen first because it is the primary discovery channel for specialty coffee in the target demographic. Atlas was included because Coffee Atlas articles are the content strategy backbone — each new origin becomes an article, a social post, and an email capture trigger.

## Brief Entry Point: Telegram

The workflow starts with a text brief in Telegram ("natural way" — the founder lives in Telegram). The brief is free-form: topic, origin, idea, any format. Claude interprets it and begins the research and planning phase. This contrasts with filling out a form in a web dashboard — conversational entry has lower friction and allows Claude to ask clarifying questions immediately.

## ContentFactory as a Separate Project

ContentFactory (internally: "Zavod") is a standalone project, not a sub-module of YourWave. YourWave is the first client, but the pipeline architecture is designed to serve any content-driven business. The separation ensures the pipeline logic is not coupled to YourWave-specific data structures, allowing future clients with different content types and platforms.
