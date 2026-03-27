import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidGroupFolder } from './group-folder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = resolve(__dirname, '..', 'config', 'channel-templates');

const MAX_FOLDER_LENGTH = 64;
const PREFIX = 'dc-';
const SUFFIX_LENGTH = 6; // last 6 chars of channelId per D-03

/**
 * Sanitize a Discord channel name into a valid group folder name.
 * - Lowercases, strips non-alphanumeric/hyphen chars, collapses hyphens
 * - Prefixes with "dc-"
 * - Falls back to "dc-channel" if result would be empty/invalid
 * - Truncates to 64 chars (GROUP_FOLDER_PATTERN max)
 */
export function sanitizeDiscordChannelName(channelName: string): string {
  let base = channelName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (!base || !/^[a-z0-9]/.test(base)) {
    base = 'channel';
  }

  const full = PREFIX + base;
  const result = full.slice(0, MAX_FOLDER_LENGTH);

  // Trim any trailing hyphen left after truncation
  return result.replace(/-+$/, '');
}

/**
 * Sanitize with collision detection: if the base name already exists,
 * append the last 6 characters of the channel ID as a suffix.
 */
export function sanitizeWithCollisionCheck(
  channelName: string,
  channelId: string,
  existingFolders: Set<string>,
): string {
  const base = sanitizeDiscordChannelName(channelName);

  if (!existingFolders.has(base)) {
    return base;
  }

  const suffix = channelId.slice(-SUFFIX_LENGTH);
  // Truncate base to leave room for '-' + suffix
  const maxBase = MAX_FOLDER_LENGTH - 1 - suffix.length;
  const truncatedBase = base.slice(0, maxBase).replace(/-+$/, '');
  return `${truncatedBase}-${suffix}`;
}

/**
 * Create a CLAUDE.md for a new Discord group folder.
 * Loads a channel-specific template from config/channel-templates/ if one exists,
 * otherwise falls back to a generic stub.
 */
export function createGroupStub(channelName: string, isMain: boolean): string {
  const templatePath = resolve(TEMPLATES_DIR, `${channelName}.md`);
  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf-8');
  }

  // Fallback to generic stub for channels without a template
  return `# ${channelName}

Discord channel group.${isMain ? ' This is the main channel.' : ''}

## Instructions

Respond helpfully to messages in this channel.
`;
}
