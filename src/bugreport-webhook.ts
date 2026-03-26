/**
 * Bug report webhook handler.
 *
 * Receives visual bug reports from the YourWave site's BugReporter widget.
 * Creates a page in the Notion "🐛 Bugs" database with all report data.
 * Notion webhook then triggers the agent to investigate and fix.
 */
import { IncomingMessage, ServerResponse } from 'http';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

import { logger } from './logger.js';

export interface BugReportHandlerConfig {
  githubToken: string;
  githubRepo: string;
}

interface BugReport {
  description: string;
  screenshot?: string; // base64 data URL
  url: string;
  viewport?: { w: number; h: number };
  selection?: { x: number; y: number; w: number; h: number };
  cssPath?: string;
  fixMode: 'immediate' | 'nightshift';
  userAgent: string;
  timestamp: string;
}

export function handleBugReportWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  rawBody: Buffer,
  config: BugReportHandlerConfig,
): void {
  // CORS headers for cross-origin requests from the site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  let report: BugReport;
  try {
    report = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    logger.warn('Bug report webhook: invalid JSON body');
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (!report.description || !report.url) {
    res.writeHead(400);
    res.end('Missing description or url');
    return;
  }

  // Acknowledge immediately
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));

  // Process async
  handleReport(report, config).catch((err) => {
    logger.error({ err }, 'Bug report processing failed');
  });
}

async function handleReport(
  report: BugReport,
  config: BugReportHandlerConfig,
): Promise<void> {
  const reportId = `bug-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // Normalize viewport - widget sends {w, h} but manual tests may send string
  if (typeof report.viewport === 'string') {
    const parts = (report.viewport as string).split('x');
    report.viewport = {
      w: parseInt(parts[0]) || 0,
      h: parseInt(parts[1]) || 0,
    };
  }

  // Save screenshot to disk
  let screenshotPath = '';
  if (report.screenshot?.startsWith('data:image/')) {
    const dir = path.join(process.cwd(), 'bug-reports');
    mkdirSync(dir, { recursive: true });
    const base64Data = report.screenshot.replace(
      /^data:image\/\w+;base64,/,
      '',
    );
    screenshotPath = path.join(dir, `${reportId}.png`);
    writeFileSync(screenshotPath, Buffer.from(base64Data, 'base64'));
    logger.info({ screenshotPath }, 'Bug report screenshot saved');
  }

  // Create a GitHub Issue in YW_Core
  const issue = await createGitHubIssue(
    report,
    reportId,
    screenshotPath,
    config,
  );

  if (issue) {
    logger.info(
      {
        reportId,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        url: report.url,
        fixMode: report.fixMode,
      },
      'Bug report created as GitHub Issue',
    );
  }
}

interface GitHubIssueResult {
  number: number;
  html_url: string;
}

async function createGitHubIssue(
  report: BugReport,
  reportId: string,
  screenshotPath: string,
  config: BugReportHandlerConfig,
): Promise<GitHubIssueResult | null> {
  const browserShort = extractBrowser(report.userAgent);
  const viewportStr = report.viewport
    ? `${report.viewport.w}x${report.viewport.h}`
    : 'N/A';
  const selectorStr = report.cssPath || 'N/A';

  const title = report.description.slice(0, 100);

  const body = `## Bug Report

**Affected Page URL:** ${report.url}
**Fix Mode:** ${report.fixMode}
**Browser:** ${browserShort}
**Viewport:** ${viewportStr}
**CSS Selector:** \`${selectorStr}\`

## Description

${report.description}

## Debug Info

- Report ID: ${reportId}
- Screenshot: ${screenshotPath || 'N/A'}
- Reported At: ${report.timestamp || new Date().toISOString()}
- User Agent: ${report.userAgent}`;

  const labels = ['bug', report.fixMode === 'immediate' ? 'immediate' : 'nightshift'];

  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.githubRepo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, body, labels }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        'GitHub API error creating issue',
      );
      return null;
    }

    const data = (await response.json()) as { number: number; html_url: string };
    return { number: data.number, html_url: data.html_url };
  } catch (err) {
    logger.error({ err, url: report.url }, 'Failed to create GitHub Issue');
    return null;
  }
}

function extractBrowser(ua: string): string {
  if (ua.includes('Chrome/')) {
    const m = ua.match(/Chrome\/(\d+)/);
    return `Chrome ${m?.[1] ?? ''}`;
  }
  if (ua.includes('Firefox/')) {
    const m = ua.match(/Firefox\/(\d+)/);
    return `Firefox ${m?.[1] ?? ''}`;
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    return 'Safari';
  }
  return ua.slice(0, 50);
}

