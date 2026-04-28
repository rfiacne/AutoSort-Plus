/**
 * Options page main entry point.
 * Bundled by esbuild into dist/options.js as a single IIFE.
 */

import { i18n } from '../shared/i18n';
import { DebugLogger } from '../shared/logger';
import { loadSettings } from './settings';
import { showProviderSections, getProviderInfo } from './providers';
import type { ProviderUIInfo } from './providers';
import type { AutoSortSettings } from '../types/settings';

import { addLabelInput, loadFoldersFromImap, importLabelsFromBulk } from './labels';
import {
  addGeminiKeyInput,
  getGeminiKeys,
  setGeminiKeys,
  updateGeminiUsageDisplay,
  initGeminiKeysFromStorage,
} from './gemini-keys';
import { applyBatchProgress, initBatchPanel } from './batch-panel';

import { els } from './shared/dom-refs';
import { showMessage, formatTimestamp } from './shared/ui';
import { updateSaveButtonState, collectSettings, handleSave } from './save-settings';
import { handleTestApi } from './api-test';
import { initOllamaListeners } from './ollama-config';
import { initOpenAICompatListeners } from './openai-compat';

// ── Logger singleton ─────────────────────────────────────────────

const debugLogger = new DebugLogger();

// ── i18n Key Map for Providers ────────────────────────────────────

const PROVIDER_I18N_REFS: Record<string, { nameKey: string; infoKey: string }> = {
  gemini: { nameKey: 'providerGemini', infoKey: 'providerInfoGemini' },
  openai: { nameKey: 'providerOpenAI', infoKey: 'providerInfoOpenai' },
  anthropic: { nameKey: 'providerAnthropic', infoKey: 'providerInfoAnthropic' },
  groq: { nameKey: 'providerGroq', infoKey: 'providerInfoGroq' },
  mistral: { nameKey: 'providerMistral', infoKey: 'providerInfoMistral' },
  ollama: { nameKey: 'providerOllama', infoKey: 'providerInfoOllama' },
  'openai-compatible': {
    nameKey: 'providerOpenAICompatible',
    infoKey: 'providerInfoOpenaiCompatible',
  },
};

// ── Provider Info ─────────────────────────────────────────────────

function updateProviderInfo(): void {
  const provider = els.aiProviderSelect.value;
  const config = getProviderInfo(provider);
  const i18nRef = PROVIDER_I18N_REFS[provider];

  showProviderSections(provider);

  if (els.providerInfo && config && i18nRef) {
    const displayName = i18n.get(i18nRef.nameKey);
    const infoText = i18n.get(i18nRef.infoKey);
    const badgeHtml = config.isFree
      ? `<span class="free-badge">${i18n.get('freeBadge', 'FREE')}</span>`
      : `<span class="paid-badge">${i18n.get('paidBadge', 'PAID')}</span>`;

    els.providerInfo.innerHTML = `
      <div class="provider-details">
        <strong>${displayName}</strong> ${badgeHtml}
        <p>${infoText}</p>
      </div>
    `;
  }

  // Show/hide rate-limit warning for Gemini
  const rateLimitWarning = document.getElementById('rate-limit-warning');
  if (rateLimitWarning) {
    rateLimitWarning.style.display = provider === 'gemini' ? 'block' : 'none';
  }

  // Update Gemini usage display when Gemini is selected
  if (provider === 'gemini') {
    updateGeminiUsageDisplay();
  }

  if (provider !== 'ollama' && provider !== 'openai-compatible') {
    els.apiKeyInput.placeholder = i18n.get('apiKeyPlaceholder');
  }

  updateSaveButtonState();
}

// ── Move History ──────────────────────────────────────────────────

async function updateHistoryTable(): Promise<void> {
  if (!els.historyBody) return;

  const data = await browser.storage.local.get('moveHistory');
  const history: Array<{
    timestamp?: unknown;
    subject?: string;
    status?: string;
    destination?: string;
  }> = data.moveHistory || [];

  els.historyBody.innerHTML = history
    .map(
      (entry) => `
        <tr>
          <td class="timestamp">${formatTimestamp(entry.timestamp)}</td>
          <td>${entry.subject || ''}</td>
          <td class="${(entry.status || '').toLowerCase()}">${entry.status || ''}</td>
          <td>${entry.destination || ''}</td>
        </tr>
      `
    )
    .join('');
}

async function clearHistory(): Promise<void> {
  if (confirm('Are you sure you want to clear the move history?')) {
    await browser.storage.local.set({ moveHistory: [] });
    await updateHistoryTable();
  }
}

// ── Main Initialization ───────────────────────────────────────────

async function init(): Promise<void> {
  // Apply i18n translations first
  if (typeof (window as unknown as Record<string, unknown>).applyTranslations === 'function') {
    ((window as unknown as Record<string, unknown>).applyTranslations as () => void)();
  }

  // Initialize debug logger
  await debugLogger.init();

  // Section collapse/expand handlers
  const sectionHeaders = document.querySelectorAll('.section-header');
  sectionHeaders.forEach((header) => {
    header.addEventListener('click', function (this: HTMLElement) {
      const sectionId = this.getAttribute('data-section');
      if (!sectionId) return;
      const content = document.getElementById(sectionId);
      const section = this.parentElement;
      const icon = this.querySelector('.collapse-icon') as HTMLElement | null;

      if (section && content) {
        if (section.classList.contains('collapsed')) {
          section.classList.remove('collapsed');
          content.style.display = 'block';
          if (icon) icon.textContent = '▼';
          setTimeout(() => {
            content.style.animation = 'slideDown 0.3s ease-out';
          }, 0);
        } else {
          section.classList.add('collapsed');
          content.style.display = 'none';
          if (icon) icon.textContent = '▶';
        }
      }
    });
  });

  // Load saved settings and populate UI
  const settings = await loadSettings();

  // Labels
  if (settings.labels && settings.labels.length > 0) {
    els.labelsContainer.innerHTML = '';
    settings.labels.forEach((label) => {
      addLabelInput(label, els.labelsContainer, updateSaveButtonState);
    });
  } else {
    els.labelsContainer.innerHTML =
      '<div class="instruction-message">No folders/labels configured. Click "Load Folders from Mail Account" above or add custom labels below.</div>';
  }

  // Gemini keys
  await initGeminiKeysFromStorage(
    els.geminiKeysList,
    els.apiKeyInput,
    updateSaveButtonState
  );

  // Ollama settings
  if (settings.ollamaUrl && els.ollamaUrlInput) {
    els.ollamaUrlInput.value = settings.ollamaUrl;
  }
  if (settings.ollamaAuthToken && els.ollamaAuthTokenInput) {
    els.ollamaAuthTokenInput.value = settings.ollamaAuthToken;
  }
  if (settings.ollamaModel && els.ollamaModelSelect) {
    els.ollamaModelSelect.value = settings.ollamaModel;
    if (
      settings.ollamaModel === 'custom' &&
      settings.ollamaCustomModel &&
      els.ollamaCustomModelInput
    ) {
      els.ollamaCustomModelInput.value = settings.ollamaCustomModel;
      els.ollamaCustomModelInput.style.display = 'block';
    }
  }
  if (els.ollamaCpuOnlyCheckbox) {
    els.ollamaCpuOnlyCheckbox.checked = settings.ollamaCpuOnly === true;
  }

  // OpenAI-Compatible settings
  if (settings.customBaseUrl && els.customBaseUrlInput) {
    els.customBaseUrlInput.value = settings.customBaseUrl;
  }
  if (settings.customModel) {
    const dropdownOptions = els.customModelSelect
      ? Array.from(els.customModelSelect.options).map((o) => o.value)
      : [];
    if (dropdownOptions.includes(settings.customModel)) {
      if (els.customModelSelect) els.customModelSelect.value = settings.customModel;
    } else {
      if (els.customModelSelect) {
        els.customModelSelect.value = 'custom';
        if (els.customModelCustomInput) {
          els.customModelCustomInput.style.display = 'block';
          els.customModelCustomInput.value = settings.customModel;
        }
      }
    }
  }

  // Provider
  if (settings.aiProvider) {
    els.aiProviderSelect.value = settings.aiProvider;
    updateProviderInfo();
  }

  // Enable AI (default true)
  els.enableAiCheckbox.checked = settings.enableAi !== false;

  // Gemini Paid Plan
  els.geminiPaidCheckbox.checked = settings.geminiPaidPlan === true;

  // Debug mode
  if (els.enableDebugCheckbox && settings.debugMode !== undefined) {
    els.enableDebugCheckbox.checked = settings.debugMode;
  }

  // Batch chunk size
  if (els.batchChunkSizeInput && settings.batchChunkSize) {
    els.batchChunkSizeInput.value = String(settings.batchChunkSize);
  }

  // Auto-sort
  if (els.autoSortCheckbox) {
    els.autoSortCheckbox.checked = settings.autoSortEnabled === true;
  }

  // Custom prompt
  if (els.customPromptTextarea) {
    els.customPromptTextarea.value = settings.customPrompt || '';
  }

  updateSaveButtonState();

  // ── Event Listeners ──────────────────────────────────────────

  els.aiProviderSelect.addEventListener('change', updateProviderInfo);

  // Add label button
  els.addLabelButton.addEventListener('click', () => {
    const instructionMsg =
      els.labelsContainer.querySelector('.instruction-message');
    if (instructionMsg) {
      els.labelsContainer.innerHTML = '';
    }
    addLabelInput('', els.labelsContainer, updateSaveButtonState);
    updateSaveButtonState();
  });

  // Save button
  els.saveButton.addEventListener('click', handleSave);

  // Debug mode toggle
  if (els.enableDebugCheckbox) {
    els.enableDebugCheckbox.addEventListener('change', async () => {
      if (els.enableDebugCheckbox!.checked) {
        await debugLogger.enable();
        showMessage(
          '✓ Debug mode enabled. Open Thunderbird Developer Tools (Ctrl+Shift+I) to view logs.',
          true
        );
      } else {
        await debugLogger.disable();
        showMessage('✓ Debug mode disabled.', true);
      }
    });
  }

  // Reset prompt button
  if (els.resetPromptButton && els.customPromptTextarea) {
    els.resetPromptButton.addEventListener('click', () => {
      els.customPromptTextarea!.value = '';
      showMessage(
        'Custom prompt cleared. Default prompt will be used.',
        true
      );
    });
  }

  // API key input
  els.apiKeyInput.addEventListener('input', updateSaveButtonState);
  els.labelsContainer.addEventListener('input', updateSaveButtonState);

  // Test API button
  els.testApiButton.addEventListener('click', handleTestApi);

  // Get API Key button
  els.getApiKeyButton.addEventListener('click', async () => {
    const provider = els.aiProviderSelect.value;
    const config = getProviderInfo(provider);

    if (!config?.signupUrl) {
      showMessage(
        "This provider doesn't have a signup URL. Configure the endpoint directly in the settings above.",
        false
      );
      return;
    }

    try {
      await browser.tabs.create({ url: config.signupUrl });
    } catch (error: unknown) {
      console.error('Failed to open tab:', error);
      const url = config.signupUrl;
      try {
        await navigator.clipboard.writeText(url);
        showMessage(`URL copied to clipboard:\n${url}`, true);
      } catch {
        alert(`Please visit:\n${url}`);
      }
    }
  });

  // Import labels
  els.importLabelsButton.addEventListener('click', () => {
    const bulkText = els.bulkImportTextarea.value.trim();
    importLabelsFromBulk(
      bulkText,
      els.labelsContainer,
      updateSaveButtonState,
      showMessage
    );
    els.bulkImportTextarea.value = '';
  });

  // Load IMAP folders
  let loadedFolders: string[] = [];

  els.loadImapFoldersButton.addEventListener('click', async () => {
    loadedFolders = await loadFoldersFromImap(
      els.folderLoadingIndicator,
      els.folderSelection,
      els.foldersPreview,
      els.folderCount,
      showMessage
    );
  });

  els.useImapFoldersButton.addEventListener('click', () => {
    if (
      confirm(
        `This will replace any existing folders/labels with ${loadedFolders.length} folders from your mail account. Continue?`
      )
    ) {
      els.labelsContainer.innerHTML = '';
      loadedFolders.forEach((folder) => {
        addLabelInput(folder, els.labelsContainer, updateSaveButtonState);
      });
      els.folderSelection.style.display = 'none';
      updateSaveButtonState();
      showMessage(
        `Loaded ${loadedFolders.length} folders from your mail account. Don't forget to save!`,
        true
      );
    }
  });

  els.useCustomFoldersButton.addEventListener('click', () => {
    els.folderSelection.style.display = 'none';
    showMessage('You can now add custom folders below', true);
  });

  // Gemini multi-key
  els.addGeminiKeyButton.addEventListener('click', () => {
    addGeminiKeyInput('', -1, els.geminiKeysList, updateSaveButtonState);
  });

  // Reset Gemini counter
  const resetGeminiCounterBtn = document.getElementById('reset-gemini-counter');
  if (resetGeminiCounterBtn) {
    resetGeminiCounterBtn.addEventListener('click', async () => {
      if (
        confirm(
          'Reset usage counter? Do this only after switching to a new API key.'
        )
      ) {
        await browser.storage.local.set({
          geminiRateLimit: {
            requests: [],
            dailyCount: 0,
            dailyResetTime: Date.now() + 24 * 60 * 60 * 1000,
          },
        });
        await updateGeminiUsageDisplay();
        const usageMessage = document.getElementById('usage-message');
        if (usageMessage) {
          usageMessage.className = 'usage-message info';
          usageMessage.textContent =
            '✓ Usage counter reset. You can now process up to 20 more emails today with your new API key.';
        }
      }
    });
  }

  // Refresh Gemini usage
  const refreshUsageBtn = document.getElementById('refresh-usage');
  if (refreshUsageBtn) {
    refreshUsageBtn.addEventListener('click', async () => {
      await updateGeminiUsageDisplay();
      const usageMessage = document.getElementById('usage-message');
      if (usageMessage) {
        usageMessage.className = 'usage-message info';
        usageMessage.textContent = '✓ Usage information refreshed.';
        setTimeout(() => {
          if (usageMessage.classList.contains('info')) {
            usageMessage.style.display = 'none';
          }
        }, 3000);
      }
    });
  }

  // Refresh all usage
  const refreshAllUsageBtn = document.getElementById('refresh-all-usage');
  if (refreshAllUsageBtn) {
    refreshAllUsageBtn.addEventListener('click', async () => {
      await updateGeminiUsageDisplay();
      showMessage('✓ All usage information refreshed.', true);
    });
  }

  // Initialize Ollama listeners
  initOllamaListeners(debugLogger);

  // Initialize OpenAI-Compatible listeners
  initOpenAICompatListeners(debugLogger);

  // Initialize batch panel
  initBatchPanel();

  // Move history
  await updateHistoryTable();
  const clearHistoryBtn = document.getElementById('clear-history');
  const refreshHistoryBtn = document.getElementById('refresh-history');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', clearHistory);
  }
  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener('click', updateHistoryTable);
  }
}

// ── Entry Point ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err: unknown) => {
    console.error('Options initialization failed:', err);
  });
});
