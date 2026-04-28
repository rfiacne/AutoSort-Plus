import type { ProviderId } from '../types/provider';

export interface ProviderUIInfo {
  id: ProviderId;
  name: string;
  signupUrl: string | null;
  isFree: boolean;
  isLocal: boolean;
}

export const PROVIDER_UI_LIST: ProviderUIInfo[] = [
  { id: 'gemini', name: 'Google Gemini', signupUrl: 'https://aistudio.google.com/app/apikey', isFree: true, isLocal: false },
  { id: 'openai', name: 'OpenAI ChatGPT', signupUrl: 'https://platform.openai.com/api-keys', isFree: false, isLocal: false },
  { id: 'anthropic', name: 'Anthropic Claude', signupUrl: 'https://console.anthropic.com/', isFree: false, isLocal: false },
  { id: 'groq', name: 'Groq', signupUrl: 'https://console.groq.com/keys', isFree: true, isLocal: false },
  { id: 'mistral', name: 'Mistral AI', signupUrl: 'https://console.mistral.ai/', isFree: false, isLocal: false },
  { id: 'ollama', name: 'Ollama (Local)', signupUrl: null, isFree: true, isLocal: true },
  { id: 'openai-compatible', name: 'OpenAI-Compatible', signupUrl: null, isFree: true, isLocal: true },
];

export function getProviderInfo(id: string): ProviderUIInfo | undefined {
  return PROVIDER_UI_LIST.find((p) => p.id === id);
}

export function showProviderSections(provider: string): void {
  const ollamaSection = document.getElementById('ollama-settings-subsection');
  const apiKeySection = document.getElementById('api-key-subsection');
  const geminiMultiSection = document.getElementById('gemini-multi-keys-subsection');
  const geminiUsageSection = document.getElementById('gemini-usage-subsection');
  const rateLimitWarning = document.getElementById('rate-limit-warning');
  const openaiCompatSection = document.getElementById('openai-compatible-settings-subsection');
  const geminiPaidContainer = document.getElementById('gemini-paid-container');

  const isOllama = provider === 'ollama';
  const isOpenAICompat = provider === 'openai-compatible';
  const isGemini = provider === 'gemini';
  const isLocal = isOllama || isOpenAICompat;

  if (ollamaSection) ollamaSection.style.display = isOllama ? 'block' : 'none';
  if (apiKeySection) apiKeySection.style.display = isLocal ? 'none' : 'block';
  if (geminiMultiSection) geminiMultiSection.style.display = isGemini ? 'block' : 'none';
  if (geminiUsageSection) geminiUsageSection.style.display = isGemini ? 'block' : 'none';
  if (rateLimitWarning) rateLimitWarning.style.display = isGemini ? 'block' : 'none';
  if (openaiCompatSection) openaiCompatSection.style.display = isOpenAICompat ? 'block' : 'none';
  if (geminiPaidContainer) geminiPaidContainer.style.display = isGemini ? 'block' : 'none';
}
