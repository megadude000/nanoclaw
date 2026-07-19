import { Channel, NewMessage } from './types.js';
import { formatLocalTime } from './timezone.js';
import { logger } from './logger.js';

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
    const replyAttr = m.reply_to_message_id
      ? ` reply_to="${escapeXml(m.reply_to_message_id)}"`
      : '';
    const replySnippet =
      m.reply_to_message_content && m.reply_to_sender_name
        ? `\n  <quoted_message from="${escapeXml(m.reply_to_sender_name)}">${escapeXml(m.reply_to_message_content)}</quoted_message>`
        : '';
    return `<message sender="${escapeXml(m.sender_name)}" time="${escapeXml(displayTime)}"${replyAttr}>${replySnippet}${escapeXml(m.content)}</message>`;
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

/**
 * Send text to whichever channel owns `jid`, verifying connection state first.
 *
 * This is the single outbound path for fire-and-forget sends (scheduled tasks,
 * IPC messages). Returns true only when the channel confirmed delivery, so
 * callers can surface or persist failures instead of silently losing output.
 */
export async function sendOutbound(
  channels: Channel[],
  jid: string,
  text: string,
  sender?: string,
): Promise<boolean> {
  const channel = findChannel(channels, jid);
  if (!channel) {
    logger.warn({ jid }, 'sendOutbound: no channel owns JID');
    return false;
  }
  if (!channel.isConnected()) {
    logger.warn(
      { jid, channel: channel.name },
      'sendOutbound: channel not connected, refusing send',
    );
    return false;
  }
  return channel.sendMessage(jid, text, sender);
}

export function findChannel(
  channels: Channel[],
  jid: string,
): Channel | undefined {
  return channels.find((c) => c.ownsJid(jid));
}
