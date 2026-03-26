import { Channel, NewMessage } from './types.js';
import { formatLocalTime } from './timezone.js';

export function escapeXml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMessages(
  messages: NewMessage[],
  timezone: string,
): string {
  const lines = messages.map((m) => {
    const displayTime = formatLocalTime(m.timestamp, timezone);
    return `<message sender="${escapeXml(m.sender_name)}" time="${escapeXml(displayTime)}">${escapeXml(m.content)}</message>`;
  });

  const header = `<context timezone="${escapeXml(timezone)}" />\n`;

  return `${header}<messages>\n${lines.join('\n')}\n</messages>`;
}

export function stripInternalTags(text: string): string {
  return text.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();
}

export function formatOutbound(rawText: string): string {
  const text = stripInternalTags(rawText);
  if (!text) return '';
  return text;
}

export async function routeOutbound(
  channels: Channel[],
  jid: string,
  text: string,
  originJid?: string,
): Promise<void> {
  const channel = channels.find((c) => c.ownsJid(jid) && c.isConnected());
  if (!channel) {
    // If we know where the request came from, notify that channel about the failure
    if (originJid && originJid !== jid) {
      const originChannel = channels.find((c) => c.ownsJid(originJid) && c.isConnected());
      if (originChannel) {
        await originChannel.sendMessage(originJid, `[Error] Failed to deliver message to ${jid}: no connected channel found`);
      }
    }
    throw new Error(`No channel for JID: ${jid}`);
  }
  try {
    await channel.sendMessage(jid, text);
  } catch (err) {
    if (originJid && originJid !== jid) {
      const originChannel = channels.find((c) => c.ownsJid(originJid) && c.isConnected());
      if (originChannel) {
        try {
          await originChannel.sendMessage(originJid, `[Error] Failed to send message to ${jid}: ${err instanceof Error ? err.message : 'unknown error'}`);
        } catch {
          // Avoid infinite error loops
        }
      }
    }
    throw err;
  }
}

export function findChannel(
  channels: Channel[],
  jid: string,
): Channel | undefined {
  return channels.find((c) => c.ownsJid(jid));
}
