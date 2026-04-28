declare const browser: any;

interface FetchViaTabOptions {
  endpoint?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  resultKey?: string;
}

interface TabFetchResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export async function fetchViaTab(
  baseUrl: string,
  options: FetchViaTabOptions = {}
): Promise<unknown> {
  const {
    endpoint = '',
    body = {},
    headers = {},
    timeoutMs = 30000,
    resultKey = '__tab_fetch_result',
  } = options;

  const tab = await browser.tabs.create({ url: baseUrl, active: false });

  let tabLoaded = false;
  await new Promise<void>((resolve) => {
    const listener = (
      tabId: number,
      changeInfo: { status?: string }
    ): void => {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        browser.tabs.onUpdated.removeListener(listener);
        tabLoaded = true;
        resolve();
      }
    };
    browser.tabs.onUpdated.addListener(listener);
    // 10 s timeout — Ollama can be slow to respond, especially on first request
    // after idle when the model needs to warm up.
    setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 10000);
  });

  try {
    const headersJson = JSON.stringify({
      'Content-Type': 'application/json',
      ...headers,
    });
    const bodyJson = JSON.stringify(body);

    const scriptCode = `
(async () => {
    try {
        const headers = ${headersJson};
        const response = await fetch(window.location.origin + '${endpoint}', {
            method: 'POST',
            headers,
            body: ${bodyJson}
        });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        const data = await response.json();
        window.${resultKey} = { ok: true, data };
    } catch (error) {
        window.${resultKey} = { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
})();
`;

    if (!tabLoaded) {
      console.warn('[TabFetch] Tab did not finish loading within 10 s, attempting executeScript anyway');
    }

    await browser.tabs.executeScript(tab.id, { code: scriptCode });

    const maxIterations = Math.ceil(timeoutMs / 500);
    let result: TabFetchResult | null = null;

    for (let i = 0; i < maxIterations; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const results = await browser.tabs.executeScript(tab.id, {
          code: `window.${resultKey} || null`,
        });
        if (results?.[0]) {
          result = results[0] as TabFetchResult;
          break;
        }
      } catch (e) {
        // Transient error (tab may still be initializing) — retry a few times
        if (i < 3) {
          console.warn('[TabFetch] executeScript retry', i + 1, ':', (e as Error).message);
          continue;
        }
        console.warn('[TabFetch] executeScript error:', (e as Error).message);
        break;
      }
    }

    if (!result) {
      throw new Error(`Tab fetch timed out (${timeoutMs}ms)`);
    }

    if (!result.ok) {
      throw new Error(result.error || 'Unknown error');
    }

    return result.data;
  } finally {
    try {
      await browser.tabs.remove(tab.id);
    } catch {
      /* tab may already be closed */
    }
  }
}

export async function ollamaChatViaTabUtil(
  ollamaUrl: string,
  model: string,
  prompt: string,
  authToken?: string
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetchViaTab(ollamaUrl, {
    endpoint: '/api/chat',
    body: {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    },
    headers,
    resultKey: '__ollama_result',
  });
}

export async function openaiCompatChatViaTabUtil(
  baseUrl: string,
  model: string,
  prompt: string,
  apiKey?: string
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return fetchViaTab(baseUrl, {
    endpoint: '/v1/chat/completions',
    body: {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      stream: false,
    },
    headers,
    resultKey: '__openai_compat_result',
  });
}

// Global singleton for backward compatibility with existing JS
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).tabFetchUtils = {
    fetchViaTab,
    ollamaChatViaTabUtil,
    openaiCompatChatViaTabUtil,
  };
}
