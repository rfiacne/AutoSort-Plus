import type { EmailContext } from '../../types/email';

export const DEFAULT_PROMPT = `You are an email classification assistant. Analyze this email and choose the most appropriate label from: {labels}.

**Email Metadata:**
- Subject: {subject}
- From: {author}
- Attachments: {attachments}

**Email Body:**
{body}

Consider the subject line, sender context, attachment filenames, and body content to determine the most appropriate category. Respond with only the exact label name, or "null" if no label fits well.`;

export function injectPlaceholders(
  template: string,
  context: EmailContext,
  labels: string[]
): string {
  const labelsStr = labels.join(', ');
  const attachmentsStr =
    context.attachments.length > 0
      ? context.attachments.map((a) => a.name).join(', ')
      : 'None';

  return template
    .replace(/{labels}/g, labelsStr)
    .replace(/{subject}/g, context.subject || '(No subject)')
    .replace(/{author}/g, context.author || '')
    .replace(/{attachments}/g, attachmentsStr)
    .replace(/{body}/g, context.body || '');
}

export function stripCodeFences(text: string): string {
  return text
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

export function matchLabelFromResponse(
  responseText: string,
  labels: string[]
): string {
  const cleaned = stripCodeFences(responseText).trim();

  // Exact match first
  for (const label of labels) {
    if (cleaned === label) return label;
  }

  // Case-insensitive match
  const lowerCleaned = cleaned.toLowerCase();
  for (const label of labels) {
    if (label.toLowerCase() === lowerCleaned) return label;
  }

  // Substring match (label appears anywhere in response)
  for (const label of labels) {
    if (lowerCleaned.includes(label.toLowerCase())) return label;
  }

  return cleaned || 'null';
}
