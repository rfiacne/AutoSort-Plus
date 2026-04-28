import { els } from './shared/dom-refs';
import { updateSaveButtonState } from './save-settings';
import type { DebugLogger } from '../shared/logger';

async function fetchModelsViaTab(
  baseUrl: string,
  apiKey: string
): Promise<unknown> {
  const tab = await browser.tabs.create({ url: baseUrl, active: false });
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const scriptCode = `
      (async () => {
        try {
          const headers = ${JSON.stringify(headers)};
          const response = await fetch(window.location.origin + '/v1/models', {
            method: 'GET',
            headers
          });
          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }
          const data = await response.json();
          window.__models_result = { ok: true, data };
        } catch (error) {
          window.__models_result = { ok: false, error: error.message };
        }
      })();
    `;

    await browser.tabs.executeScript(tab.id, {
      code: scriptCode,
    });

    let result: { ok: boolean; data?: unknown; error?: string } | null = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const results = await browser.tabs.executeScript(tab.id, {
          code: 'window.__models_result || null',
        });
        if (results && results[0]) {
          result = results[0];
          break;
        }
      } catch {
        continue;
      }
    }

    if (!result || !result.ok) {
      throw new Error(result?.error || 'Timeout fetching models');
    }

    return result.data;
  } finally {
    try {
      await browser.tabs.remove(tab.id);
    } catch {
      // tab may already be closed
    }
  }
}

export function initOpenAICompatListeners(debugLogger: DebugLogger): void {
  if (els.customModelSelect) {
    els.customModelSelect.addEventListener('change', () => {
      if (els.customModelCustomInput) {
        els.customModelCustomInput.style.display =
          els.customModelSelect!.value === 'custom' ? 'block' : 'none';
      }
      updateSaveButtonState();
    });
  }

  if (els.customBaseUrlInput) {
    els.customBaseUrlInput.addEventListener('input', updateSaveButtonState);
  }
  if (els.customModelCustomInput) {
    els.customModelCustomInput.addEventListener('input', updateSaveButtonState);
  }

  if (els.fetchCustomModelsButton && els.customTestResult) {
    els.fetchCustomModelsButton.addEventListener('click', async () => {
      const baseUrl = els.customBaseUrlInput?.value.trim().replace(/\/$/, '') || '';
      const apiKey = els.customApiKeyInput?.value.trim() || '';

      if (!baseUrl) {
        els.customTestResult!.textContent =
          '⚠️ Please enter a base URL first';
        els.customTestResult!.className = 'api-test-result error';
        return;
      }

      try {
        els.customTestResult!.textContent = 'Fetching models from endpoint...';
        els.customTestResult!.className = 'api-test-result';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const isLocalhost =
          baseUrl.startsWith('http://localhost') ||
          baseUrl.startsWith('http://127.0.0.1');

        let modelsData: { data?: Array<{ id?: string; name?: string }>; models?: Array<{ id?: string; name?: string }> };

        if (isLocalhost) {
          modelsData = (await fetchModelsViaTab(
            baseUrl,
            apiKey
          )) as typeof modelsData;
        } else {
          const response = await fetch(baseUrl + '/models', { headers });
          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status}: ${response.statusText}`
            );
          }
          modelsData = await response.json();
        }

        const models: Array<{ id?: string; name?: string }> =
          modelsData.data || modelsData.models || [];

        if (models.length === 0) {
          els.customTestResult!.textContent =
            '⚠️ No models found at this endpoint';
          els.customTestResult!.className = 'api-test-result error';
          return;
        }

        if (els.customModelSelect) {
          els.customModelSelect.innerHTML =
            '<option value="">-- Select model --</option>';
          models.forEach((m) => {
            const modelId = m.id || m.name || String(m);
            const option = document.createElement('option');
            option.value = modelId;
            option.textContent = modelId;
            els.customModelSelect!.appendChild(option);
          });
          const customOpt = document.createElement('option');
          customOpt.value = 'custom';
          customOpt.textContent = 'Custom (enter manually)';
          els.customModelSelect.appendChild(customOpt);
        }

        els.customTestResult!.textContent = `✓ Found ${models.length} models. Select from dropdown or use "Custom" option.`;
        els.customTestResult!.className = 'api-test-result success';
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : String(error);
        console.error('[Fetch Models] Error:', error);
        els.customTestResult!.textContent = `✗ Failed to fetch models: ${msg}`;
        els.customTestResult!.className = 'api-test-result error';
      }
    });
  }

  if (els.testCustomEndpointButton && els.customTestResult) {
    els.testCustomEndpointButton.addEventListener('click', async () => {
      const baseUrl = els.customBaseUrlInput?.value.trim() || '';
      let model = els.customModelSelect?.value || '';
      const apiKey = els.customApiKeyInput?.value.trim() || '';

      if (model === 'custom' && els.customModelCustomInput) {
        model = els.customModelCustomInput.value.trim();
      }

      if (!baseUrl) {
        els.customTestResult!.textContent = '⚠️ Please enter a base URL';
        els.customTestResult!.className = 'api-test-result error';
        return;
      }
      if (!model) {
        els.customTestResult!.textContent = '⚠️ Please enter a model name';
        els.customTestResult!.className = 'api-test-result error';
        return;
      }

      try {
        els.customTestResult!.textContent = 'Testing connection...';
        els.customTestResult!.className = 'api-test-result';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const normalizedUrl = baseUrl.replace(/\/$/, '');
        debugLogger.info(
          '[Custom]',
          'Test connecting to: ' + normalizedUrl + '/chat/completions'
        );

        const response = await fetch(
          normalizedUrl + '/chat/completions',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Test' }],
              max_tokens: 10,
            }),
          }
        );

        debugLogger.info(
          '[Custom]',
          'Response status: ' + response.status
        );

        if (response.ok) {
          els.customTestResult!.textContent = `✓ Connected successfully! Model "${model}" is ready at ${normalizedUrl}`;
          els.customTestResult!.className = 'api-test-result success';
        } else {
          const errorText = await response.text();
          console.error(
            '[Custom Endpoint Test] Error response:',
            errorText
          );
          let errorMsg = 'Connection failed';
          try {
            const errorData = JSON.parse(errorText);
            errorMsg =
              errorData.error?.message ||
              errorData.error ||
              errorText;
          } catch {
            errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          }
          els.customTestResult!.textContent = `✗ Error: ${errorMsg}`;
          els.customTestResult!.className = 'api-test-result error';
        }
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : String(error);
        console.error('[Custom Endpoint Test] Exception:', error);
        els.customTestResult!.textContent = `✗ Connection failed: ${msg}. Check the base URL and ensure the endpoint is running.`;
        els.customTestResult!.className = 'api-test-result error';
      }
    });
  }
}
