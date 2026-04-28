declare const browser: any;

import type { BatchState, BatchProgressPayload } from './types';
import type { BatchStatus } from '../../types/batch';

export async function broadcastBatchProgress(
  state: BatchState,
  status: BatchStatus | 'done' | 'cancelled' = 'running'
): Promise<void> {
  const payload: BatchProgressPayload = {
    action: 'batchProgress',
    status,
    total: state.total,
    completed: state.completed,
    failed: state.failed,
    skipped: state.skipped,
    provider: state.provider,
    chunkIndex: state.chunkIndex,
    totalChunks: state.totalChunks,
  };
  try {
    await browser.storage.local.set({ currentBatch: { ...payload, startTime: Date.now() } });
    await browser.runtime.sendMessage(payload).catch(() => {});
  } catch {
    // options page may not be open
  }
}
