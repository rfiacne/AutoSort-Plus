declare const browser: any;

import type { BatchState } from './types';
import { DEFAULT_BATCH_CONFIG } from './types';
import { broadcastBatchProgress } from './progress';

function createBatchState(total: number, provider: string): BatchState {
  return {
    running: true,
    cancelled: false,
    paused: false,
    total,
    completed: 0,
    failed: 0,
    skipped: 0,
    provider,
    chunkIndex: 0,
    totalChunks: 0,
  };
}

async function waitWhilePaused(state: BatchState): Promise<boolean> {
  while (state.paused && !state.cancelled) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return !state.cancelled;
}

export interface BatchDependencies {
  getFullMessage: (id: number) => Promise<any>;
  extractEmailContext: (fullMsg: any, header: any) => Promise<{ body: string }>;
  analyzeEmailContent: (content: string, context: any) => Promise<string | null>;
  applyLabels: (msgs: any[], label: string) => Promise<Array<{ status: string; destination: string; error?: string }>>;
  showNotification: (title: string, message: string) => Promise<string>;
  debugLogger?: any;
}

export async function batchAnalyzeEmails(
  messages: any[],
  deps: BatchDependencies,
  externalState?: BatchState
): Promise<void> {
  const settingsData = (await browser.storage.local.get(['aiProvider', 'batchChunkSize'])) as {
    aiProvider?: string;
    batchChunkSize?: number;
  };
  const provider = settingsData.aiProvider || 'gemini';
  const chunkSize = settingsData.batchChunkSize || 5;

  const state = externalState || createBatchState(messages.length, provider);
  // When using external state, ensure it's initialized for this run
  if (externalState) {
    state.running = true;
    state.cancelled = false;
    state.paused = false;
    state.total = messages.length;
    state.completed = 0;
    state.failed = 0;
    state.skipped = 0;
    state.provider = provider;
    state.chunkIndex = 0;
    state.totalChunks = 0;
  }
  await broadcastBatchProgress(state, 'running');

  if (deps.debugLogger) {
    deps.debugLogger.info('[Batch]', `Starting batch: ${messages.length} emails, provider=${provider}, chunkSize=${chunkSize}`);
  }

  async function processOne(message: any): Promise<void> {
    if (state.cancelled) return;
    if (state.paused) {
      const resumed = await waitWhilePaused(state);
      if (!resumed) return;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const fullMessage = await deps.getFullMessage(message.id);
        if (!fullMessage) {
          state.skipped++;
          return;
        }

        const emailContext = await deps.extractEmailContext(fullMessage, message);
        const emailContent = emailContext.body;
        if (!emailContent || !emailContent.trim()) {
          state.skipped++;
          return;
        }

        const label = await deps.analyzeEmailContent(emailContent, emailContext);

        if (!label || String(label).trim().toLowerCase() === 'null') {
          state.skipped++;
          return;
        }

        const results = await deps.applyLabels([message], label);
        // Check if the move actually succeeded
        const failed = results.filter((r) => r.status === 'Error');
        if (failed.length > 0) {
          state.failed += failed.length;
          state.completed += results.length - failed.length;
          for (const f of failed) {
            console.error(`[Batch] Move failed: ${f.destination}${f.error ? ' - ' + f.error : ''}`);
          }
        } else {
          state.completed += results.length;
        }
        return;
      } catch (err: any) {
        if (deps.debugLogger) {
          deps.debugLogger.warn('[Batch]', `Attempt ${attempt} failed for msg ${message.id}: ${err.message}`);
        }
        if (attempt === 2) {
          state.failed++;
          console.error(`[Batch] Message ${message.id} failed after retry:`, err.message);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }
  }

  const totalChunks = Math.ceil(messages.length / chunkSize);
  state.totalChunks = totalChunks;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    if (state.cancelled) break;

    while (state.paused && !state.cancelled) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (state.cancelled) break;

    const chunkStart = chunkIndex * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, messages.length);
    const chunkMessages = messages.slice(chunkStart, chunkEnd);

    const chunkPromises = chunkMessages.map((msg) => processOne(msg));
    await Promise.allSettled(chunkPromises);

    state.chunkIndex = chunkIndex + 1;
    await broadcastBatchProgress(state, 'running');
  }

  const finalStatus = state.cancelled ? 'cancelled' : 'done';
  state.running = false;
  await broadcastBatchProgress(state, finalStatus);

  setTimeout(async () => {
    await browser.storage.local.remove('currentBatch').catch(() => {});
  }, 6000);

  if (deps.debugLogger) {
    deps.debugLogger.info('[Batch]', `Batch ${finalStatus}: completed=${state.completed}, failed=${state.failed}, skipped=${state.skipped}`);
  }

  const { completed, failed, skipped, total } = state;
  if (finalStatus === 'cancelled') {
    await deps.showNotification('AutoSort+ Batch Cancelled',
      `Stopped after ${completed + failed + skipped}/${total} emails. Sorted: ${completed}, failed: ${failed}.`);
  } else if (failed === 0 && skipped === 0) {
    await deps.showNotification('AutoSort+ Batch Complete',
      `Successfully sorted all ${completed} emails.`);
  } else {
    await deps.showNotification('AutoSort+ Batch Complete',
      `Processed ${total} emails — sorted: ${completed}, skipped: ${skipped}, failed: ${failed}.`);
  }
}
