import type { EmailContext, Attachment } from '../../types/email';

declare const browser: any;
declare const messenger: any;

export async function extractEmailContext(
  fullMessage: any,
  messageHeader: any
): Promise<EmailContext> {
  const subject = fullMessage.headers?.Subject?.[0] || messageHeader?.subject || '';
  const author = fullMessage.headers?.From?.[0] || messageHeader?.author || '';

  const attachments: Attachment[] = [];
  async function collectAttachments(parts: any[]): Promise<void> {
    if (!parts) return;
    for (const part of parts) {
      if (part.parts) await collectAttachments(part.parts);
      if (part.name) {
        const isInlineText =
          (part.contentType === 'text/plain' || part.contentType === 'text/html') &&
          !part.contentDisposition;
        if (!isInlineText) {
          attachments.push({
            name: part.name as string,
            contentType: (part.contentType as string) || 'unknown',
            size: (part.size as number) || 0,
          });
        }
      }
    }
  }
  if (fullMessage.parts) await collectAttachments(fullMessage.parts);

  async function extractBodyText(parts: any[]): Promise<string> {
    if (!parts) return '';
    let text = '';
    for (const part of parts) {
      if (part.parts) text += await extractBodyText(part.parts);
      if (part.contentType === 'text/plain') {
        text += part.body + '\n';
      } else if (part.contentType === 'text/html' && !text) {
        text = await browser.messengerUtilities.convertToPlainText(part.body);
      } else if (part.contentType === 'message/rfc822' && part.body) {
        text += part.body + '\n';
      }
    }
    return text;
  }

  const body = fullMessage.parts
    ? await extractBodyText(fullMessage.parts)
    : fullMessage.body || '';

  return { subject, author, attachments, body };
}

export async function extractTextFromParts(fullMessage: any): Promise<string> {
  const context = await extractEmailContext(fullMessage, null);
  return context.body;
}
