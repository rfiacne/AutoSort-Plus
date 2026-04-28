import { describe, it, expect } from 'vitest';
import '../../helpers/mock-messenger';

// In Node test environment, window is not defined.
// The module uses `typeof window !== 'undefined'` guard, so we must
// define window before importing for the singleton to be attached.
(globalThis as Record<string, unknown>).window = globalThis;

describe('tab-fetch', () => {
  it('should export window.tabFetchUtils after import', async () => {
    await import('../../../src/shared/tab-fetch');
    const utils = (window as unknown as Record<string, unknown>).tabFetchUtils as Record<string, unknown>;
    expect(utils).toBeDefined();
    expect(typeof utils.fetchViaTab).toBe('function');
    expect(typeof utils.ollamaChatViaTabUtil).toBe('function');
    expect(typeof utils.openaiCompatChatViaTabUtil).toBe('function');
  });
});
