import type { ProviderId } from './provider';

export interface AutoSortSettings {
  aiProvider: ProviderId;
  enableAi: boolean;
  apiKey: string;
  geminiApiKeys: string[];
  geminiPaidPlan: boolean;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaCustomModel: string;
  ollamaAuthToken: string;
  ollamaCpuOnly: boolean;
  ollamaNumCtx: number;
  customBaseUrl: string;
  customModel: string;
  labels: string[];
  debugMode: boolean;
  batchChunkSize: number;
  autoSortEnabled: boolean;
  customPrompt: string;
}
