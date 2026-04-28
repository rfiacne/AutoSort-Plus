export const PROVIDERS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GROQ: 'groq',
  MISTRAL: 'mistral',
  OLLAMA: 'ollama',
  OPENAI_COMPATIBLE: 'openai-compatible',
} as const;

export type ProviderId = (typeof PROVIDERS)[keyof typeof PROVIDERS];

export interface BatchConfig {
  concurrency: number;
  delayMs: number;
}

export interface ProviderConfig {
  name: string;
  signupUrl: string | null;
  isFree: boolean;
  endpoint: string | null;
  requiresAuth: 'query' | 'header' | 'optional';
  batchConfig: BatchConfig;
  isLocal?: boolean;
}

export type ProviderConfigMap = Record<ProviderId, ProviderConfig>;

export function getProviderBatchConfig(
  provider: ProviderId,
  configs: ProviderConfigMap
): BatchConfig {
  return configs[provider]?.batchConfig || { concurrency: 1, delayMs: 0 };
}

export function isValidProvider(provider: string): provider is ProviderId {
  return Object.values(PROVIDERS).includes(provider as ProviderId);
}
