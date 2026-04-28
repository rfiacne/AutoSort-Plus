import { describe, it, expect } from 'vitest';

describe('auto-sort/processor', () => {
  it('should export processWithConcurrency', async () => {
    const mod = await import('../../../src/background/auto-sort/processor');
    expect(typeof mod.processWithConcurrency).toBe('function');
    expect(typeof mod.classifyAndMove).toBe('function');
    expect(typeof mod.handleNewMail).toBe('function');
  });

  it('processWithConcurrency should process all items', async () => {
    const { processWithConcurrency } = await import('../../../src/background/auto-sort/processor');
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];

    await processWithConcurrency(items, async (n) => {
      processed.push(n);
      return n * 2;
    }, 2);

    expect(processed).toHaveLength(5);
    expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('processWithConcurrency should respect concurrency limit', async () => {
    const { processWithConcurrency } = await import('../../../src/background/auto-sort/processor');
    let maxConcurrent = 0;
    let current = 0;

    const items = [1, 2, 3, 4, 5, 6];
    await processWithConcurrency(items, async () => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise(r => setTimeout(r, 10));
      current--;
      return null;
    }, 2);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
