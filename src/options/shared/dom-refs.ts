import { getElement, getElementOrNull } from './dom';

export const els = {
  // Always-present core elements
  labelsContainer: getElement<HTMLElement>('labels-container'),
  addLabelButton: getElement<HTMLButtonElement>('add-label'),
  saveButton: getElement<HTMLButtonElement>('save-settings'),
  apiKeyInput: getElement<HTMLInputElement>('api-key'),
  aiProviderSelect: getElement<HTMLSelectElement>('ai-provider'),
  providerInfo: getElement<HTMLElement>('provider-info'),
  getApiKeyButton: getElement<HTMLButtonElement>('get-api-key'),
  testApiButton: getElement<HTMLButtonElement>('test-api'),
  apiTestResult: getElement<HTMLElement>('api-test-result'),
  geminiPaidContainer: getElement<HTMLElement>('gemini-paid-container'),
  geminiPaidCheckbox: getElement<HTMLInputElement>('gemini-paid-plan'),
  importLabelsButton: getElement<HTMLButtonElement>('import-labels'),
  bulkImportTextarea: getElement<HTMLTextAreaElement>('bulk-import-text'),
  loadImapFoldersButton: getElement<HTMLButtonElement>('load-imap-folders'),
  folderLoadingIndicator: getElement<HTMLElement>('folder-loading'),
  folderSelection: getElement<HTMLElement>('folder-selection'),
  foldersPreview: getElement<HTMLElement>('folders-preview'),
  folderCount: getElement<HTMLElement>('folder-count'),
  useImapFoldersButton: getElement<HTMLButtonElement>('use-imap-folders'),
  useCustomFoldersButton: getElement<HTMLButtonElement>('use-custom-folders'),
  geminiMultiKeysContainer: getElement<HTMLElement>('gemini-multi-keys-subsection'),
  geminiKeysList: getElement<HTMLElement>('gemini-keys-list'),
  addGeminiKeyButton: getElement<HTMLButtonElement>('add-gemini-key'),

  // Ollama-specific elements (hidden unless provider=ollama)
  ollamaModelSelect: getElementOrNull<HTMLSelectElement>('ollama-model'),
  ollamaCustomModelInput: getElementOrNull<HTMLInputElement>('ollama-custom-model'),
  ollamaUrlInput: getElementOrNull<HTMLInputElement>('ollama-url'),
  ollamaAuthTokenInput: getElementOrNull<HTMLInputElement>('ollama-auth-token'),
  ollamaCpuOnlyCheckbox: getElementOrNull<HTMLInputElement>('ollama-cpu-only'),
  testOllamaButton: getElementOrNull<HTMLButtonElement>('test-ollama'),
  listOllamaModelsButton: getElementOrNull<HTMLButtonElement>('list-ollama-models'),
  downloadOllamaModelButton: getElementOrNull<HTMLButtonElement>('download-ollama-model'),
  ollamaDownloadModelInput: getElementOrNull<HTMLInputElement>('ollama-download-model'),
  ollamaDownloadStatus: getElementOrNull<HTMLElement>('ollama-download-status'),
  ollamaTestResult: getElementOrNull<HTMLElement>('ollama-test-result'),
  diagnoseOllamaButton: getElementOrNull<HTMLButtonElement>('diagnose-ollama'),
  ollamaDiagnostics: getElementOrNull<HTMLElement>('ollama-diagnostics'),

  // OpenAI-Compatible elements (hidden unless provider=openai-compatible)
  customBaseUrlInput: getElementOrNull<HTMLInputElement>('custom-base-url'),
  customModelSelect: getElementOrNull<HTMLSelectElement>('custom-model-select'),
  customModelCustomInput: getElementOrNull<HTMLInputElement>('custom-model-custom'),
  customApiKeyInput: getElementOrNull<HTMLInputElement>('custom-api-key'),
  fetchCustomModelsButton: getElementOrNull<HTMLButtonElement>('fetch-custom-models'),
  testCustomEndpointButton: getElementOrNull<HTMLButtonElement>('test-custom-endpoint'),
  customTestResult: getElementOrNull<HTMLElement>('custom-test-result'),

  // AI enable
  enableAiCheckbox: getElement<HTMLInputElement>('enable-ai'),

  // Debug mode
  enableDebugCheckbox: getElement<HTMLInputElement>('enable-debug'),

  // Batch progress
  batchChunkSizeInput: getElement<HTMLInputElement>('batch-chunk-size'),
  autoSortCheckbox: getElement<HTMLInputElement>('enable-auto-sort'),
  customPromptTextarea: getElement<HTMLTextAreaElement>('custom-prompt-text'),

  // History
  historyBody: getElement<HTMLElement>('history-body'),
  historyTable: getElement<HTMLElement>('history-table'),
  resetPromptButton: getElement<HTMLButtonElement>('reset-prompt'),
};
