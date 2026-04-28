import { describe, it, expect } from 'vitest';
import '../../helpers/mock-messenger';
import { resetStorage } from '../../helpers/mock-messenger';

describe('folders/operations', () => {
  it('should export applyLabelsToMessages', async () => {
    const mod = await import('../../../src/background/folders/operations');
    expect(typeof mod.applyLabelsToMessages).toBe('function');
  });
});
