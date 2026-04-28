import type { AutoSortSettings } from '../types/settings';

declare const browser: any;

const SETTINGS_KEYS: (keyof AutoSortSettings)[] = [
  'aiProvider', 'enableAi', 'apiKey', 'geminiApiKeys', 'geminiPaidPlan',
  'ollamaUrl', 'ollamaModel', 'ollamaCustomModel', 'ollamaAuthToken', 'ollamaCpuOnly',
  'ollamaNumCtx',
  'customBaseUrl', 'customModel', 'labels', 'debugMode',
  'batchChunkSize', 'autoSortEnabled', 'customPrompt',
];

// Keys that are managed internally (rate limits, history, batch state, etc.)
// and should NOT be cleared when saving user settings.
const INTERNAL_KEYS = [
  'geminiRateLimits', 'currentGeminiKeyIndex',
  'moveHistory', 'currentBatch',
];

export async function loadSettings(): Promise<AutoSortSettings> {
  return browser.storage.local.get(SETTINGS_KEYS) as Promise<AutoSortSettings>;
}

export async function saveSettings(settings: Partial<AutoSortSettings>): Promise<void> {
  // Preserve internal state that should survive config saves
  const internal = await browser.storage.local.get(INTERNAL_KEYS);
  // Wipe all user-facing keys, then write the full new set atomically
  await browser.storage.local.remove(SETTINGS_KEYS);
  await browser.storage.local.set({ ...settings, ...internal });
}

export async function getSetting<K extends keyof AutoSortSettings>(key: K): Promise<AutoSortSettings[K] | undefined> {
  const data = (await browser.storage.local.get(key)) as Partial<AutoSortSettings>;
  return data[key];
}

export { SETTINGS_KEYS };
