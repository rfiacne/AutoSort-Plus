/**
 * Background script entry point — bundles all TypeScript modules and registers
 * them under `window._ts` for migration from legacy background.js.
 *
 * Migration path: legacy JS calls `win.debugLogger` → change to `window._ts.logger`.
 * Each function moved to `_ts` can then be deleted from background.js.
 */

import { DebugLogger, getStorage, setStorage, i18n, applyTranslations } from '../shared';
import { analyzeEmail, injectPlaceholders, DEFAULT_PROMPT, stripCodeFences, matchLabelFromResponse } from './ai';
import { analyze as geminiAnalyze } from './ai/providers/gemini';
import { analyze as openaiAnalyze } from './ai/providers/openai';
import { analyze as anthropicAnalyze } from './ai/providers/anthropic';
import { analyze as groqAnalyze } from './ai/providers/groq';
import { analyze as mistralAnalyze } from './ai/providers/mistral';
import { analyze as ollamaAnalyze } from './ai/providers/ollama';
import { analyze as openaiCompatAnalyze } from './ai/providers/openai-compat';
import { checkAndTrackGeminiRateLimit as _checkRateLimit } from './ai/rate-limiter';
import { extractEmailContext, extractTextFromParts } from './email/extractor';
import { applyLabelsToMessages } from './folders/operations';
import { storeMoveHistory, getMoveHistory, clearMoveHistory } from './folders/history';
import { batchAnalyzeEmails } from './batch/engine';
import { broadcastBatchProgress } from './batch/progress';
import { DEFAULT_BATCH_CONFIG } from './batch/types';
import { processWithConcurrency, classifyAndMove, handleNewMail } from './auto-sort/processor';
import { registerAutoSortListener } from './auto-sort/listener';

// ── Initialize logger ──────────────────────────────────────────────────────
const logger = new DebugLogger();
logger.init().catch(() => {});

// ── Register all TS modules on window._ts ──────────────────────────────────

interface TSModules {
  logger: DebugLogger;
  storage: { get: typeof getStorage; set: typeof setStorage };
  i18n: typeof i18n;
  applyTranslations: typeof applyTranslations;
  analyzeEmail: typeof analyzeEmail;
  injectPlaceholders: typeof injectPlaceholders;
  DEFAULT_PROMPT: string;
  stripCodeFences: typeof stripCodeFences;
  matchLabelFromResponse: typeof matchLabelFromResponse;
  providers: {
    gemini: typeof geminiAnalyze;
    openai: typeof openaiAnalyze;
    anthropic: typeof anthropicAnalyze;
    groq: typeof groqAnalyze;
    mistral: typeof mistralAnalyze;
    ollama: typeof ollamaAnalyze;
    openaiCompat: typeof openaiCompatAnalyze;
  };
  checkRateLimit: typeof checkAndTrackGeminiRateLimit;
  extractEmailContext: typeof extractEmailContext;
  extractTextFromParts: typeof extractTextFromParts;
  applyLabelsToMessages: typeof applyLabelsToMessages;
  storeMoveHistory: typeof storeMoveHistory;
  getMoveHistory: typeof getMoveHistory;
  clearMoveHistory: typeof clearMoveHistory;
  batchAnalyzeEmails: typeof batchAnalyzeEmails;
  broadcastBatchProgress: typeof broadcastBatchProgress;
  BATCH_CONFIG: typeof DEFAULT_BATCH_CONFIG;
  processWithConcurrency: typeof processWithConcurrency;
  classifyAndMove: typeof classifyAndMove;
  handleNewMail: typeof handleNewMail;
  registerAutoSortListener: typeof registerAutoSortListener;
}

const modules: TSModules = {
  logger,
  storage: { get: getStorage, set: setStorage },
  i18n,
  applyTranslations,
  analyzeEmail,
  injectPlaceholders,
  DEFAULT_PROMPT,
  stripCodeFences,
  matchLabelFromResponse,
  providers: {
    gemini: geminiAnalyze,
    openai: openaiAnalyze,
    anthropic: anthropicAnalyze,
    groq: groqAnalyze,
    mistral: mistralAnalyze,
    ollama: ollamaAnalyze,
    openaiCompat: openaiCompatAnalyze,
  },
  checkRateLimit: _checkRateLimit,
  extractEmailContext,
  extractTextFromParts,
  applyLabelsToMessages,
  storeMoveHistory,
  getMoveHistory,
  clearMoveHistory,
  batchAnalyzeEmails,
  broadcastBatchProgress,
  BATCH_CONFIG: DEFAULT_BATCH_CONFIG,
  processWithConcurrency,
  classifyAndMove,
  handleNewMail,
  registerAutoSortListener,
};

const win = window as any;

win._ts = modules;

// Also maintain backward-compatible globals
if (!win.debugLogger) win.debugLogger = logger;
if (!win.applyTranslations) win.applyTranslations = applyTranslations;
if (!win.extractEmailContext) win.extractEmailContext = extractEmailContext;

// ── Runtime helpers ─────────────────────────────────────────────────────────

const _batchState = {
  running: false,
  cancelled: false,
  paused: false,
  total: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  provider: '',
  chunkIndex: 0,
  totalChunks: 0,
};

async function _broadcastBatchProgress(status = 'running'): Promise<void> {
  const payload = {
    action: 'batchProgress',
    status,
    total: _batchState.total,
    completed: _batchState.completed,
    failed: _batchState.failed,
    skipped: _batchState.skipped,
    provider: _batchState.provider,
    chunkIndex: _batchState.chunkIndex,
    totalChunks: _batchState.totalChunks,
  };
  try {
    await browser.storage.local.set({ currentBatch: { ...payload, startTime: Date.now() } });
    await browser.runtime.sendMessage(payload).catch(() => {});
  } catch {
    // options page may not be open
  }
}

async function _waitWhilePaused(): Promise<boolean> {
  while (_batchState.paused && !_batchState.cancelled) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return !_batchState.cancelled;
}

async function showNotification(
  title: string,
  message: string,
  type = 'basic'
): Promise<string | null> {
  if (win.debugLogger) {
    win.debugLogger.info(
      '[AutoSort+]',
      `${title}: ${message}`
    );
  }
  try {
    if (browser.notifications?.create) {
      const id = `autosort-${Date.now()}`;
      await browser.notifications.create(id, {
        type,
        iconUrl: browser.runtime.getURL('icons/icon-48.png'),
        title,
        message,
        eventTime: Date.now(),
        priority: 2,
        requireInteraction: true,
      });
      return id;
    }
  } catch {
    // notifications not supported
  }
  return null;
}

async function updateNotification(
  id: string | null,
  title: string,
  message: string
): Promise<string | null> {
  if (win.debugLogger) {
    win.debugLogger.info(
      '[AutoSort+]',
      `${title}: ${message}`
    );
  }
  try {
    if (browser.notifications?.clear && id) {
      await browser.notifications.clear(id);
    }
  } catch {
    // notifications not supported
  }
  return showNotification(title, message);
}

// ── Thin delegation wrappers ────────────────────────────────────────────────

async function checkAndTrackGeminiRateLimit(keyIndex: number | null = null) {
  return _checkRateLimit(keyIndex);
}

async function analyzeEmailContent(emailContent: string, emailContext = null) {
  const settings = await browser.storage.local.get([
    'apiKey', 'geminiApiKeys', 'currentGeminiKeyIndex',
    'aiProvider', 'labels', 'enableAi', 'geminiPaidPlan',
    'geminiRateLimit', 'geminiRateLimits', 'ollamaUrl', 'ollamaModel',
    'ollamaCustomModel', 'ollamaAuthToken', 'ollamaCpuOnly', 'ollamaNumCtx',
    'customBaseUrl', 'customModel', 'customPrompt',
  ]);
  const provider: string = settings.aiProvider || 'gemini';

  if (provider === 'gemini' && !settings.geminiPaidPlan) {
    const rateLimit = await checkAndTrackGeminiRateLimit();
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.message || 'Gemini rate limit reached');
    }
    if (rateLimit.waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, rateLimit.waitTime * 1000));
    }
  }

  if (settings.enableAi === false) {
    console.warn('AI is disabled');
    return null;
  }

  const result = await analyzeEmail(
    {
      emailContent,
      emailContext: emailContext || null,
      labels: settings.labels || [],
      customPrompt: settings.customPrompt,
    },
    provider,
    settings
  );

  if (result?.suggestedLabel) {
    if (String(result.suggestedLabel).trim().toLowerCase() === 'null') return null;
    return result.suggestedLabel;
  }
  return null;
}

async function storeMoveHistoryFn(result: Record<string, unknown>) {
  return storeMoveHistory(result as { subject: string; status: string; destination: string; error?: string });
}

async function applyLabelsToMessagesFn(messages: unknown[], label: string) {
  return applyLabelsToMessages(messages, label);
}

async function processWithConcurrencyFn<T>(items: T[], processor: (item: T) => Promise<unknown>, limit = 3) {
  return processWithConcurrency(items, processor, limit);
}

function registerAutoSortListenerFn() {
  registerAutoSortListener(
    analyzeEmailContent,
    applyLabelsToMessagesFn,
    async () => {
      const s = await browser.storage.local.get(['autoSortEnabled', 'enableAi', 'aiProvider']);
      return s;
    },
    (provider: string) => DEFAULT_BATCH_CONFIG[provider]?.concurrency || 3,
    win.debugLogger
  );
}

async function batchAnalyzeEmailsFn(messages: unknown[]) {
  const settingsData = await browser.storage.local.get(['aiProvider', 'batchChunkSize']);
  const provider: string = settingsData.aiProvider || 'gemini';

  await _broadcastBatchProgress('running');

  if (win.debugLogger) {
    win.debugLogger.info(
      '[Batch]',
      `Starting batch via _ts: ${(messages as unknown[]).length} emails`
    );
  }

  await batchAnalyzeEmails(
    messages as unknown[],
    {
      getFullMessage: (id) => browser.messages.getFull(id as number),
      extractEmailContext,
      analyzeEmailContent,
      applyLabels: (msgs: unknown[], label: string) => applyLabelsToMessages(msgs as unknown[], label),
      showNotification: showNotification as (t: string, m: string) => Promise<string>,
      debugLogger: win.debugLogger,
    },
    _batchState  // Shared state — engine reads/writes same object as UI controls
  );
}

// ── Message Routing ──────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (message: Record<string, unknown>, _sender: unknown, sendResponse: (r: unknown) => void) => {
    if (message.action === 'applyLabels') {
      applyLabelsToMessagesFn(message.messages as unknown[], message.label as string)
        .then(() => sendResponse({ ok: true }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    if (message.action === 'analyzeEmail') {
      analyzeEmailContent(message.emailContent as string)
        .then((label) => sendResponse({ label }))
        .catch((err: Error) => sendResponse({ label: null, error: err.message }));
      return true;
    }
    if (message.action === 'startOllamaPull') {
      (async () => {
        try {
          const { ollamaUrl, model, headers } = message as Record<string, unknown>;
          const ollamaHeaders = Object.assign({}, headers as Record<string, string>, {
            'Content-Type': 'application/json',
          });
          const res = await fetch(`${ollamaUrl}/api/pull`, {
            method: 'POST',
            headers: ollamaHeaders,
            body: JSON.stringify({ name: model, stream: true }),
          });
          const text = await res.text();
          sendResponse({ ok: true, data: text });
        } catch (e: unknown) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
      })();
      return true;
    }
    if (message.action === 'batchControl') {
      if (message.command === 'pause') {
        _batchState.paused = true;
      } else if (message.command === 'resume') {
        _batchState.paused = false;
      } else if (message.command === 'cancel') {
        _batchState.cancelled = true;
        _batchState.paused = false;
      }
      sendResponse({ ok: true });
    }
  }
);

browser.browserAction.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});

registerAutoSortListenerFn();

// ── Context Menus ────────────────────────────────────────────────────────────

const PROVIDER_BATCH_CONFIG = DEFAULT_BATCH_CONFIG;

let _rebuildQueue: Promise<void> = Promise.resolve();

async function rebuildAllMenus(labels: string[]): Promise<void> {
  // Chain onto the previous rebuild to prevent concurrent runs racing
  let resolve!: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  const prev = _rebuildQueue;
  _rebuildQueue = next;
  await prev;

  try {
    // Remove all extension menus, then recreate from scratch.
    // Individual browser.menus.remove() is unreliable in Thunderbird.
    try { await browser.menus.removeAll(); } catch { /* ok */ }
  } catch {
    // Ignore errors
  }

  // ── Parent menu ──
  browser.menus.create({
    id: 'autosort-label',
    title: 'AutoSort+ Label',
    contexts: ['message_list'],
  });

  // ── Label submenu items ──
  if (labels?.length > 0) {
    for (const label of labels) {
      try {
        browser.menus.create({
          id: `label-${label}`,
          parentId: 'autosort-label',
          title: label,
          contexts: ['message_list'],
        });
      } catch {
        // Ignore
      }
    }
  }

  // ── Analyze action ──
  browser.menus.create({
    id: 'autosort-analyze',
    title: 'AutoSort+ Analyze with AI',
    contexts: ['message_list'],
  });

  resolve();
}

browser.storage.local.get(['labels']).then((result: Record<string, unknown>) => {
  rebuildAllMenus(result.labels as string[]);
});

browser.storage.onChanged.addListener((changes: Record<string, { newValue?: unknown }>) => {
  if (changes.labels) {
    rebuildAllMenus(changes.labels.newValue as string[]);
  }
});

browser.menus.onClicked.addListener(async (info: Record<string, unknown>, tab: unknown) => {
  if (info.parentMenuItemId === 'autosort-label') {
    const label = (info.menuItemId as string).replace('label-', '');
    if (win.debugLogger) {
      win.debugLogger.info(
        '[AutoSort+]',
        `Manual label selected: ${label}`
      );
    }
    await showNotification('AutoSort+', `Applying label: ${label}`);
    try {
      const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
      if (mailTabs?.[0]) {
        const messages = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
        if (messages?.messages?.length > 0) {
          await applyLabelsToMessages(messages.messages, label);
        } else {
          await showNotification('AutoSort+ Error', 'No messages selected for labeling.');
        }
      } else {
        await showNotification('AutoSort+ Error', 'No active mail tab found.');
      }
    } catch (error: unknown) {
      console.error('Error applying manual label:', error);
      await showNotification('AutoSort+ Error', `Error applying label: ${(error as Error).message}`);
    }
  } else if (info.menuItemId === 'autosort-analyze') {
    if (win.debugLogger) {
      win.debugLogger.info(
        '[AutoSort+]',
        'AI analysis selected - starting batch process'
      );
    }
    try {
      if (_batchState.running) {
        await showNotification(
          'AutoSort+ Busy',
          'A batch is already in progress. Please wait or cancel it from the settings page.'
        );
        return;
      }
      const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
      if (!mailTabs?.[0]) {
        await showNotification('AutoSort+ Error', 'No active mail tab found');
        return;
      }
      const selectedMessageList = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
      if (!selectedMessageList?.messages?.length) {
        await showNotification('AutoSort+ Error', 'No messages selected for analysis');
        return;
      }
      const messages = selectedMessageList.messages;
      await showNotification(
        'AutoSort+ Batch',
        `Starting AI analysis of ${messages.length} email${messages.length > 1 ? 's' : ''}...`
      );
      batchAnalyzeEmailsFn(messages).catch((err: Error) => {
        console.error('[Batch] Unhandled batch error:', err);
        showNotification('AutoSort+ Error', `Batch processing failed: ${err.message}`);
      });
    } catch (error: unknown) {
      console.error('Error starting batch analysis:', error);
      await showNotification('AutoSort+ Error', `Error: ${(error as Error).message}`);
    }
  }
});
