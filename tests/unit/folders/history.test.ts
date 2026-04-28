import { describe, it, expect, beforeEach } from 'vitest';
import '../../helpers/mock-messenger';
import { resetStorage, seedStorage } from '../../helpers/mock-messenger';

describe('folders/history', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('should store and retrieve move history', async () => {
    const { storeMoveHistory, getMoveHistory } = await import('../../../src/background/folders/history');

    await storeMoveHistory({ subject: 'Test Email', status: 'Success', destination: 'Work' });

    const history = await getMoveHistory();
    expect(history).toHaveLength(1);
    expect(history[0].subject).toBe('Test Email');
    expect(history[0].status).toBe('Success');
    expect(history[0].timestamp).toBeDefined();
  });

  it('should limit history to 100 entries', async () => {
    const { storeMoveHistory, getMoveHistory } = await import('../../../src/background/folders/history');

    for (let i = 0; i < 150; i++) {
      await storeMoveHistory({ subject: `Email ${i}`, status: 'Success', destination: 'Work' });
    }

    const history = await getMoveHistory();
    expect(history).toHaveLength(100);
    expect(history[0].subject).toBe('Email 149');
  });

  it('should clear history', async () => {
    const { storeMoveHistory, getMoveHistory, clearMoveHistory } = await import('../../../src/background/folders/history');

    await storeMoveHistory({ subject: 'Test', status: 'Success', destination: 'Work' });
    await clearMoveHistory();

    const history = await getMoveHistory();
    expect(history).toHaveLength(0);
  });
});
