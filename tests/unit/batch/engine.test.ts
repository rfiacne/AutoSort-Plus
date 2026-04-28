import { describe, it, expect } from 'vitest';
import { DEFAULT_BATCH_CONFIG } from '../../../src/background/batch/types';

describe('batch/config', () => {
  it('should have config for all 7 providers', () => {
    expect(DEFAULT_BATCH_CONFIG).toHaveProperty('gemini');
    expect(DEFAULT_BATCH_CONFIG).toHaveProperty('openai');
    expect(DEFAULT_BATCH_CONFIG).toHaveProperty('anthropic');
    expect(DEFAULT_BATCH_CONFIG).toHaveProperty('groq');
    expect(DEFAULT_BATCH_CONFIG).toHaveProperty('mistral');
    expect(DEFAULT_BATCH_CONFIG).toHaveProperty('ollama');
    expect(DEFAULT_BATCH_CONFIG).toHaveProperty('openai-compatible');
  });

  it('should have valid concurrency values', () => {
    for (const [, config] of Object.entries(DEFAULT_BATCH_CONFIG)) {
      expect(config.concurrency).toBeGreaterThan(0);
      expect(config.concurrency).toBeLessThanOrEqual(10);
    }
  });

  it('gemini should have concurrency 1', () => {
    expect(DEFAULT_BATCH_CONFIG.gemini.concurrency).toBe(1);
  });

  it('groq should have highest concurrency', () => {
    const max = Math.max(...Object.values(DEFAULT_BATCH_CONFIG).map(c => c.concurrency));
    expect(DEFAULT_BATCH_CONFIG.groq.concurrency).toBe(max);
  });
});
