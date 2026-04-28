import { describe, it, expect, beforeEach } from 'vitest';
import '../../helpers/mock-messenger';
import { resetStorage, seedStorage } from '../../helpers/mock-messenger';

// We can't easily test the full rate limiter without complex timing,
// but we can test the module exports and basic behavior
describe('rate-limiter', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('should export checkAndTrackGeminiRateLimit function', async () => {
    const module = await import(
      '../../../src/background/ai/rate-limiter'
    );
    expect(typeof module.checkAndTrackGeminiRateLimit).toBe('function');
  });

  it('should export legacy checkGeminiRateLimit function', async () => {
    const module = await import(
      '../../../src/background/ai/rate-limiter'
    );
    expect(typeof module.checkGeminiRateLimit).toBe('function');
  });

  it('should export deprecated trackGeminiRequest function', async () => {
    const module = await import(
      '../../../src/background/ai/rate-limiter'
    );
    expect(typeof module.trackGeminiRequest).toBe('function');
  });

  it('should allow request when paid plan is enabled', async () => {
    seedStorage({ geminiPaidPlan: true });
    const { checkAndTrackGeminiRateLimit } = await import(
      '../../../src/background/ai/rate-limiter'
    );
    const result = await checkAndTrackGeminiRateLimit();
    expect(result.allowed).toBe(true);
    expect(result.waitTime).toBe(0);
  });

  it('should allow request in legacy mode with fresh storage', async () => {
    const { checkAndTrackGeminiRateLimit } = await import(
      '../../../src/background/ai/rate-limiter'
    );
    const result = await checkAndTrackGeminiRateLimit();
    expect(result.allowed).toBe(true);
    expect(result.waitTime).toBe(0);
    expect(result.keyIndex).toBeNull();
  });
});
