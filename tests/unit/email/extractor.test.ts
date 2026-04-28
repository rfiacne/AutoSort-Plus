import { describe, it, expect } from 'vitest';
import '../../helpers/mock-messenger';

describe('email/extractor', () => {
  it('should export extractEmailContext function', async () => {
    const mod = await import('../../../src/background/email/extractor');
    expect(typeof mod.extractEmailContext).toBe('function');
    expect(typeof mod.extractTextFromParts).toBe('function');
  });

  it('should handle null inputs', async () => {
    const { extractEmailContext } = await import('../../../src/background/email/extractor');
    const result = await extractEmailContext({}, {});
    expect(result).toEqual({
      subject: '',
      author: '',
      attachments: [],
      body: '',
    });
  });

  it('should extract basic headers', async () => {
    const { extractEmailContext } = await import('../../../src/background/email/extractor');
    const fullMessage = {
      headers: {
        Subject: ['Hello World'],
        From: ['alice@example.com'],
      },
    };
    const result = await extractEmailContext(fullMessage, {});
    expect(result.subject).toBe('Hello World');
    expect(result.author).toBe('alice@example.com');
  });
});
