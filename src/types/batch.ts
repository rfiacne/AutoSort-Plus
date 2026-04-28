export type BatchStatus = 'idle' | 'running' | 'paused' | 'cancelled';

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  status: BatchStatus;
  currentFile?: string;
}

export interface BatchState {
  isRunning: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  totalMessages: number;
  completedCount: number;
  failedCount: number;
  results: BatchResult[];
}

export interface BatchResult {
  messageId: number;
  success: boolean;
  label?: string;
  error?: string;
}
