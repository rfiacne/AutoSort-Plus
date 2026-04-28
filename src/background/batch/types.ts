import type { BatchStatus } from '../../types/batch';

export interface BatchState {
  running: boolean;
  cancelled: boolean;
  paused: boolean;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  provider: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface BatchProgressPayload {
  action: string;
  status: BatchStatus | 'done' | 'cancelled';
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  provider: string;
  chunkIndex: number;
  totalChunks: number;
}

export const DEFAULT_BATCH_CONFIG: Record<string, { concurrency: number; delayMs: number }> = {
  gemini:              { concurrency: 1, delayMs: 0 },
  openai:              { concurrency: 3, delayMs: 500 },
  anthropic:           { concurrency: 2, delayMs: 500 },
  groq:                { concurrency: 5, delayMs: 200 },
  mistral:             { concurrency: 2, delayMs: 500 },
  ollama:              { concurrency: 1, delayMs: 0 },
  'openai-compatible': { concurrency: 2, delayMs: 500 },
};
