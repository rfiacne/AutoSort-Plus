import { describe, it, expect } from 'vitest';
import {
  injectPlaceholders,
  stripCodeFences,
  matchLabelFromResponse,
  DEFAULT_PROMPT,
} from '../../../src/background/ai/prompt';
import type { EmailContext } from '../../../src/types/email';

const makeContext = (overrides?: Partial<EmailContext>): EmailContext => ({
  subject: 'Test Subject',
  author: 'test@example.com',
  attachments: [],
  body: 'This is a test email body.',
  ...overrides,
});

const testLabels = ['Work', 'Personal', 'Finance', 'Newsletters'];

describe('DEFAULT_PROMPT', () => {
  it('should contain all placeholder markers', () => {
    expect(DEFAULT_PROMPT).toContain('{labels}');
    expect(DEFAULT_PROMPT).toContain('{subject}');
    expect(DEFAULT_PROMPT).toContain('{author}');
    expect(DEFAULT_PROMPT).toContain('{attachments}');
    expect(DEFAULT_PROMPT).toContain('{body}');
  });
});

describe('injectPlaceholders', () => {
  it('should replace all placeholders', () => {
    const ctx = makeContext({
      subject: 'Hello',
      author: 'alice@example.com',
      body: 'Hi there',
    });
    const result = injectPlaceholders(DEFAULT_PROMPT, ctx, testLabels);

    expect(result).toContain('Work, Personal, Finance, Newsletters');
    expect(result).toContain('Hello');
    expect(result).toContain('alice@example.com');
    expect(result).toContain('Hi there');
    expect(result).not.toContain('{labels}');
    expect(result).not.toContain('{subject}');
  });

  it('should show "None" for empty attachments', () => {
    const ctx = makeContext({ attachments: [] });
    const result = injectPlaceholders(DEFAULT_PROMPT, ctx, testLabels);
    expect(result).toContain('None');
  });

  it('should join attachment names', () => {
    const ctx = makeContext({
      attachments: [
        { name: 'report.pdf', contentType: 'application/pdf', size: 1000 },
        { name: 'photo.jpg', contentType: 'image/jpeg', size: 500 },
      ],
    });
    const result = injectPlaceholders(DEFAULT_PROMPT, ctx, testLabels);
    expect(result).toContain('report.pdf, photo.jpg');
  });

  it('should handle missing subject and author with defaults', () => {
    const ctx = makeContext({ subject: '', author: '' });
    const result = injectPlaceholders(DEFAULT_PROMPT, ctx, testLabels);
    expect(result).toContain('(No subject)');
  });
});

describe('stripCodeFences', () => {
  it('should strip markdown code fences', () => {
    expect(stripCodeFences('```\nWork\n```')).toBe('Work');
    expect(stripCodeFences('```json\nFinance\n```')).toBe('Finance');
  });

  it('should return original text if no fences', () => {
    expect(stripCodeFences('Personal')).toBe('Personal');
  });

  it('should handle empty input', () => {
    expect(stripCodeFences('')).toBe('');
  });

  it('should only strip outermost fences', () => {
    expect(stripCodeFences('```\ninner ``` code\n```')).toBe(
      'inner ``` code'
    );
  });
});

describe('matchLabelFromResponse', () => {
  const labels = ['Work', 'Personal', 'Finance', 'Shopping'];

  it('should match exact label', () => {
    expect(matchLabelFromResponse('Work', labels)).toBe('Work');
  });

  it('should match case-insensitive', () => {
    expect(matchLabelFromResponse('WORK', labels)).toBe('Work');
    expect(matchLabelFromResponse('personal', labels)).toBe('Personal');
  });

  it('should match via substring', () => {
    expect(
      matchLabelFromResponse(
        'I think this should be Finance related',
        labels
      )
    ).toBe('Finance');
  });

  it('should strip code fences before matching', () => {
    expect(matchLabelFromResponse('```\nShopping\n```', labels)).toBe(
      'Shopping'
    );
  });

  it('should return cleaned text if no label matches', () => {
    expect(matchLabelFromResponse('Unknown Category', labels)).toBe(
      'Unknown Category'
    );
  });

  it('should return "null" sentinel for empty response', () => {
    // `cleaned || 'null'` returns the string 'null' for falsy values
    expect(matchLabelFromResponse('', labels)).toBe('null');
  });
});
