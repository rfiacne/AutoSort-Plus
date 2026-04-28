import { describe, it, expect, vi } from 'vitest';
import '../../helpers/mock-messenger';

// Ensure window is available before logger module loads (node environment)
(globalThis as Record<string, unknown>).window = globalThis;

const { DebugLogger } = await import('../../../src/shared/logger');

describe('DebugLogger', () => {
  it('should expose window.debugLogger singleton', () => {
    expect((window as Record<string, unknown>).debugLogger).toBeDefined();
    expect((window as Record<string, unknown>).debugLogger).toBeInstanceOf(DebugLogger);
  });

  it('should have all expected methods', () => {
    const logger = new DebugLogger();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.apiRequest).toBe('function');
    expect(typeof logger.apiResponse).toBe('function');
  });

  it('should queue logs when not ready', () => {
    const logger = new DebugLogger();
    expect(() => logger.info('Tag', 'queued message')).not.toThrow();
    expect(() => logger.error('Tag', 'error message')).not.toThrow();
  });

  it('should init without throwing', async () => {
    const logger = new DebugLogger();
    await expect(logger.init()).resolves.toBeUndefined();
  });
});
