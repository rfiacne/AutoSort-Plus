import { describe, it, expect, beforeEach } from 'vitest';
import '../../helpers/mock-messenger';
import { resetStorage, seedStorage } from '../../helpers/mock-messenger';

describe('storage (mock-messenger)', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('should set and get a single key', async () => {
    await browser.storage.local.set({ testKey: 'testValue' });
    const result = (await browser.storage.local.get('testKey')) as Record<string, unknown>;
    expect(result.testKey).toBe('testValue');
  });

  it('should get multiple keys', async () => {
    seedStorage({ a: 1, b: 2, c: 3 });
    const result = (await browser.storage.local.get(['a', 'c'])) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect(result.c).toBe(3);
    expect(result.b).toBeUndefined();
  });

  it('should get all keys with null', async () => {
    seedStorage({ x: 1, y: 2 });
    const result = (await browser.storage.local.get(null)) as Record<string, unknown>;
    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
  });

  it('should remove a key', async () => {
    seedStorage({ x: 1, y: 2 });
    await browser.storage.local.remove('x');
    const result = (await browser.storage.local.get(null)) as Record<string, unknown>;
    expect(result.x).toBeUndefined();
    expect(result.y).toBe(2);
  });

  it('should clear all keys', async () => {
    seedStorage({ k1: 'v1', k2: 'v2' });
    await browser.storage.local.clear();
    const result = (await browser.storage.local.get(null)) as Record<string, unknown>;
    expect(Object.keys(result)).toHaveLength(0);
  });
});
