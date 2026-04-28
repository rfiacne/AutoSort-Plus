import { describe, it, expect } from 'vitest';
import {
  injectPlaceholders,
  stripCodeFences,
  matchLabelFromResponse,
} from '../../../src/background/ai/prompt';
import type { EmailContext } from '../../../src/types/email';

describe('AI provider utilities', () => {
  const labels = ['Work', 'Personal', 'Finance', 'Shopping'];

  describe('matchLabelFromResponse edge cases', () => {
    it('should handle labels with special characters', () => {
      expect(matchLabelFromResponse('Finance/Invoices', ['Finance/Invoices', 'Work'])).toBe('Finance/Invoices');
    });

    it('should match first label when multiple match via substring', () => {
      const result = matchLabelFromResponse('work stuff', ['Work', 'Work-From-Home']);
      expect(result).toBe('Work');
    });

    it('should handle very long response text', () => {
      const longText = 'A'.repeat(10000) + ' Finance ' + 'B'.repeat(10000);
      expect(matchLabelFromResponse(longText, labels)).toBe('Finance');
    });

    it('should return cleaned text when no match and input is not null', () => {
      expect(matchLabelFromResponse('  Random Text  ', labels)).toBe('Random Text');
    });
  });

  describe('injectPlaceholders edge cases', () => {
    const template = 'Labels: {labels}. Subject: {subject}. Body: {body}.';

    it('should handle empty labels array', () => {
      const ctx: EmailContext = { subject: 'Test', author: 'a@b.com', attachments: [], body: 'hello' };
      const result = injectPlaceholders(template, ctx, []);
      expect(result).toContain('Labels: .');
    });

    it('should handle special regex characters in context', () => {
      const ctx: EmailContext = { subject: 'Price $50 (urgent)', author: 'a@b.com', attachments: [], body: 'Check this: http://example.com?a=1&b=2' };
      const result = injectPlaceholders(template, ctx, labels);
      expect(result).toContain('Price $50 (urgent)');
      expect(result).toContain('http://example.com?a=1&b=2');
    });

    it('should handle Unicode characters', () => {
      const unicodeTemplate = 'Subject: {subject}. Author: {author}. Body: {body}.';
      const ctx: EmailContext = { subject: '中文测试', author: 'テスト@example.com', attachments: [], body: 'Élève übersetzung' };
      const result = injectPlaceholders(unicodeTemplate, ctx, labels);
      expect(result).toContain('中文测试');
      expect(result).toContain('テスト@example.com');
      expect(result).toContain('Élève übersetzung');
    });
  });

  describe('stripCodeFences edge cases', () => {
    it('should handle markdown code block with language specifier', () => {
      expect(stripCodeFences('```json\n{"key": "value"}\n```')).toBe('{"key": "value"}');
    });

    it('should handle only opening fence', () => {
      expect(stripCodeFences('```\nwork in progress')).toBe('work in progress');
    });

    it('should handle only closing fence', () => {
      expect(stripCodeFences('work in progress\n```')).toBe('work in progress');
    });

    it('should handle backtick characters in content', () => {
      expect(stripCodeFences('```\nUse `const` for variables\n```')).toBe('Use `const` for variables');
    });
  });
});
