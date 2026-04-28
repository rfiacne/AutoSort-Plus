import { els } from './shared/dom-refs';
import { showMessage } from './shared/ui';
import { getGeminiKeys } from './gemini-keys';
import { SETTINGS_KEYS } from './settings';
import type { AutoSortSettings } from '../types/settings';

// ── Save Button State ─────────────────────────────────────────────

export function updateSaveButtonState(): void {
  const labels = Array.from(
    els.labelsContainer.querySelectorAll<HTMLInputElement>('.label-input')
  )
    .map((input) => input.value.trim())
    .filter((label) => label !== '');

  const provider = els.aiProviderSelect.value;
  let hasValidApiKey = true;

  if (provider === 'gemini') {
    const keys = getGeminiKeys();
    const validKeys = keys.filter((k) => k && k.trim() !== '');
    hasValidApiKey = validKeys.length > 0;
  } else if (provider === 'ollama') {
    const ollamaUrl = els.ollamaUrlInput ? els.ollamaUrlInput.value.trim() : '';
    let ollamaModel = els.ollamaModelSelect ? els.ollamaModelSelect.value : '';
    const ollamaCustomModel = els.ollamaCustomModelInput
      ? els.ollamaCustomModelInput.value.trim()
      : '';
    hasValidApiKey =
      !!ollamaUrl &&
      (!!ollamaModel ||
        (!!ollamaCustomModel && ollamaModel === 'custom'));
  } else if (provider === 'openai-compatible') {
    const baseUrl = els.customBaseUrlInput ? els.customBaseUrlInput.value.trim() : '';
    const model = els.customModelSelect ? els.customModelSelect.value : '';
    const customModel = els.customModelCustomInput
      ? els.customModelCustomInput.value.trim()
      : '';
    hasValidApiKey =
      !!baseUrl && (!!model || (!!customModel && model === 'custom'));
  } else {
    const apiKey = els.apiKeyInput.value.trim();
    hasValidApiKey = !!apiKey;
  }

  if (labels.length === 0 || !hasValidApiKey) {
    els.saveButton.disabled = true;
    els.saveButton.classList.add('disabled');
    const missingItems: string[] = [];
    if (labels.length === 0) missingItems.push('folders/labels');
    if (!hasValidApiKey) {
      if (provider === 'ollama') missingItems.push('Ollama URL/model');
      else if (provider === 'openai-compatible')
        missingItems.push('endpoint URL/model');
      else if (provider === 'gemini')
        missingItems.push('Gemini API key');
      else missingItems.push('API key');
    }
    els.saveButton.title = `Please configure: ${missingItems.join(' and ')}`;
  } else {
    els.saveButton.disabled = false;
    els.saveButton.classList.remove('disabled');
    els.saveButton.title = '';
  }
}

// ── Collect Settings ──────────────────────────────────────────────

export function collectSettings(): Partial<AutoSortSettings> {
  const labels = Array.from(
    document.querySelectorAll<HTMLInputElement>('.label-input')
  )
    .map((input) => input.value.trim())
    .filter((label) => label !== '');

  const provider = els.aiProviderSelect.value;
  const batchChunkSizeEl = document.getElementById('batch-chunk-size') as HTMLInputElement | null;
  const batchChunkSize = Math.max(
    1,
    Math.min(20, parseInt(batchChunkSizeEl?.value || '5') || 5)
  );

  const autoSortEl = document.getElementById('enable-auto-sort') as HTMLInputElement | null;
  const autoSortEnabled = autoSortEl ? autoSortEl.checked : false;

  const promptEl = document.getElementById('custom-prompt-text') as HTMLTextAreaElement | null;
  const customPrompt = promptEl ? promptEl.value.trim() : '';

  const enableAiEl = document.getElementById('enable-ai') as HTMLInputElement | null;
  const enableAi = enableAiEl ? enableAiEl.checked : true;

  const debugMode = els.enableDebugCheckbox ? els.enableDebugCheckbox.checked : false;

  return {
    labels,
    aiProvider: provider as AutoSortSettings['aiProvider'],
    enableAi,
    debugMode,
    batchChunkSize,
    autoSortEnabled,
    customPrompt,
  };
}

// ── Handle Save ───────────────────────────────────────────────────

export async function handleSave(): Promise<void> {
  const labels = Array.from(
    document.querySelectorAll<HTMLInputElement>('.label-input')
  )
    .map((input) => input.value.trim())
    .filter((label) => label !== '');

  const provider = els.aiProviderSelect.value;

  const batchChunkSizeEl = document.getElementById('batch-chunk-size') as HTMLInputElement | null;
  const batchChunkSize = Math.max(
    1,
    Math.min(20, parseInt(batchChunkSizeEl?.value || '5') || 5)
  );

  const autoSortEl = document.getElementById('enable-auto-sort') as HTMLInputElement | null;
  const autoSortEnabled = autoSortEl ? autoSortEl.checked : false;

  const promptEl = document.getElementById('custom-prompt-text') as HTMLTextAreaElement | null;
  const customPrompt = promptEl ? promptEl.value.trim() : '';

  if (labels.length === 0) {
    showMessage(
      'Please add at least one folder/label before saving. Use "Load Folders from Mail Account" or add custom labels.',
      false
    );
    return;
  }

  if (provider === 'gemini') {
    const geminiKeys = getGeminiKeys();
    const validGeminiKeys = geminiKeys.filter((k) => k && k.trim() !== '');

    if (validGeminiKeys.length === 0) {
      showMessage(
        'Please add at least one Gemini API key before saving.',
        false
      );
      return;
    }

    const uniqueKeys = new Set(
      validGeminiKeys.map((k) => k.trim().toLowerCase())
    );
    if (uniqueKeys.size !== validGeminiKeys.length) {
      showMessage(
        '⚠️ Duplicate API keys detected! Each key must be unique. Please remove duplicates before saving.',
        false
      );
      return;
    }

    let storageData: Record<string, unknown>;
    try {
      storageData = await browser.storage.local.get([
        'currentGeminiKeyIndex',
        'geminiRateLimits',
      ]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showMessage('Error checking rate limits: ' + msg, false);
      return;
    }

    const settings: Record<string, unknown> = {
      labels,
      geminiApiKeys: validGeminiKeys,
      currentGeminiKeyIndex: storageData.currentGeminiKeyIndex || 0,
      aiProvider: provider,
      enableAi: els.enableAiCheckbox.checked,
      geminiPaidPlan: els.geminiPaidCheckbox.checked,
      debugMode: els.enableDebugCheckbox ? els.enableDebugCheckbox.checked : false,
      batchChunkSize,
      autoSortEnabled,
      customPrompt,
    };

    if (
      !storageData.geminiRateLimits ||
      (storageData.geminiRateLimits as unknown[]).length !==
        validGeminiKeys.length
    ) {
      settings.geminiRateLimits = validGeminiKeys.map(() => ({
        requests: [],
        dailyCount: 0,
        dailyResetTime: Date.now() + 24 * 60 * 60 * 1000,
      }));
    }

    try {
      await browser.storage.local.remove(SETTINGS_KEYS);
      await browser.storage.local.set(settings);
      showMessage(
        '✓ Settings saved successfully! Multiple Gemini API keys configured for automatic rotation.',
        true
      );
      updateSaveButtonState();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showMessage('Error saving settings: ' + msg, false);
    }
  } else if (provider === 'ollama') {
    let ollamaModel = els.ollamaModelSelect ? els.ollamaModelSelect.value : '';
    if (ollamaModel === 'custom') {
      ollamaModel = els.ollamaCustomModelInput
        ? els.ollamaCustomModelInput.value.trim()
        : '';
      if (!ollamaModel) {
        showMessage(
          'Please enter a custom model name for Ollama.',
          false
        );
        return;
      }
    }

    const settings: Record<string, unknown> = {
      labels,
      aiProvider: provider,
      enableAi: els.enableAiCheckbox.checked,
      ollamaUrl:
        (els.ollamaUrlInput ? els.ollamaUrlInput.value.trim() : '') ||
        'http://localhost:11434',
      ollamaModel,
      ollamaCustomModel: els.ollamaCustomModelInput
        ? els.ollamaCustomModelInput.value.trim()
        : '',
      ollamaAuthToken: els.ollamaAuthTokenInput
        ? els.ollamaAuthTokenInput.value.trim()
        : '',
      ollamaCpuOnly: els.ollamaCpuOnlyCheckbox
        ? els.ollamaCpuOnlyCheckbox.checked
        : false,
      debugMode: els.enableDebugCheckbox ? els.enableDebugCheckbox.checked : false,
      batchChunkSize,
      autoSortEnabled,
      customPrompt,
    };

    try {
      await browser.storage.local.remove(SETTINGS_KEYS);
      await browser.storage.local.set(settings);
      const cpuMode = els.ollamaCpuOnlyCheckbox?.checked
        ? ' (CPU-only mode)'
        : '';
      showMessage(
        `✓ Settings saved successfully! Ollama is configured for local email processing${cpuMode}.`,
        true
      );
      updateSaveButtonState();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showMessage('Error saving settings: ' + msg, false);
    }
  } else if (provider === 'openai-compatible') {
    const baseUrl = els.customBaseUrlInput
      ? els.customBaseUrlInput.value.trim()
      : '';
    let model = els.customModelSelect ? els.customModelSelect.value : '';
    const apiKey = els.customApiKeyInput
      ? els.customApiKeyInput.value.trim()
      : '';

    if (model === 'custom' && els.customModelCustomInput) {
      model = els.customModelCustomInput.value.trim();
    }

    if (!baseUrl) {
      showMessage(
        'Please enter a base URL for the custom endpoint.',
        false
      );
      return;
    }
    if (!model) {
      showMessage(
        'Please select or enter a model name for the custom endpoint.',
        false
      );
      return;
    }

    const settings: Record<string, unknown> = {
      labels,
      aiProvider: provider,
      enableAi: els.enableAiCheckbox.checked,
      customBaseUrl: baseUrl.replace(/\/$/, ''),
      customModel: model,
      apiKey,
      debugMode: els.enableDebugCheckbox ? els.enableDebugCheckbox.checked : false,
      batchChunkSize,
      autoSortEnabled,
      customPrompt,
    };

    try {
      await browser.storage.local.remove(SETTINGS_KEYS);
      await browser.storage.local.set(settings);
      showMessage(
        '✓ Settings saved successfully! Custom OpenAI-compatible endpoint configured.',
        true
      );
      updateSaveButtonState();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showMessage('Error saving settings: ' + msg, false);
    }
  } else {
    const apiKey = els.apiKeyInput.value.trim();
    if (!apiKey) {
      showMessage(
        'Please enter your API key before saving. Click "Get API Key" to obtain one.',
        false
      );
      return;
    }

    const settings: Record<string, unknown> = {
      labels,
      apiKey,
      aiProvider: provider,
      enableAi: els.enableAiCheckbox.checked,
      debugMode: els.enableDebugCheckbox ? els.enableDebugCheckbox.checked : false,
      batchChunkSize,
      autoSortEnabled,
      customPrompt,
    };

    try {
      await browser.storage.local.remove(SETTINGS_KEYS);
      await browser.storage.local.set(settings);
      showMessage(
        '✓ Settings saved successfully! You can now use AutoSort+ to analyze emails.',
        true
      );
      updateSaveButtonState();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showMessage('Error saving settings: ' + msg, false);
    }
  }
}
