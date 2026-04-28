import { els } from './shared/dom-refs';
import { updateSaveButtonState } from './save-settings';
import type { DebugLogger } from '../shared/logger';

export function initOllamaListeners(debugLogger: DebugLogger): void {
  if (els.ollamaUrlInput) {
    els.ollamaUrlInput.addEventListener('input', () => {
      const url = els.ollamaUrlInput!.value.trim() || 'http://localhost:11434';
      const chatEndpoint = document.getElementById('ollama-chat-endpoint');
      const pullEndpoint = document.getElementById('ollama-pull-endpoint');
      const tagsEndpoint = document.getElementById('ollama-tags-endpoint');

      if (chatEndpoint)
        chatEndpoint.textContent = `${url}/api/chat`;
      if (pullEndpoint)
        pullEndpoint.textContent = `${url}/api/pull`;
      if (tagsEndpoint)
        tagsEndpoint.textContent = `${url}/api/tags`;

      updateSaveButtonState();
    });
  }

  if (els.ollamaModelSelect) {
    els.ollamaModelSelect.addEventListener('change', () => {
      if (els.ollamaCustomModelInput) {
        els.ollamaCustomModelInput.style.display =
          els.ollamaModelSelect!.value === 'custom' ? 'block' : 'none';
      }
      updateSaveButtonState();
    });
  }

  if (els.ollamaCustomModelInput) {
    els.ollamaCustomModelInput.addEventListener('input', updateSaveButtonState);
  }

  if (els.testOllamaButton) {
    els.testOllamaButton.addEventListener('click', async () => {
      const ollamaUrl =
        els.ollamaUrlInput?.value.trim() || 'http://localhost:11434';
      let selectedModel = els.ollamaModelSelect?.value || '';

      if (selectedModel === 'custom') {
        selectedModel = els.ollamaCustomModelInput?.value.trim() || '';
        if (!selectedModel) {
          if (els.ollamaTestResult) {
            els.ollamaTestResult.textContent =
              '⚠️ Please enter a custom model name first';
            els.ollamaTestResult.className = 'api-test-result error';
          }
          return;
        }
      }

      try {
        if (els.ollamaTestResult) {
          els.ollamaTestResult.textContent =
            'Testing connection and checking model...';
          els.ollamaTestResult.className = 'api-test-result';
        }

        const testUrl = `${ollamaUrl}/api/tags`;
        debugLogger.info('[Ollama]', 'Test connecting to: ' + testUrl);

        const headers: Record<string, string> = {};
        if (els.ollamaAuthTokenInput?.value.trim()) {
          headers['Authorization'] = `Bearer ${els.ollamaAuthTokenInput.value.trim()}`;
        }

        const response = await fetch(testUrl, {
          method: 'GET',
          headers,
        });

        debugLogger.info(
          '[Ollama]',
          'Response status: ' + response.status
        );

        if (response.ok) {
          const data = await response.json();
          debugLogger.info('[Ollama]', 'Success:', data);
          const installedModels: string[] =
            data.models && data.models.length > 0
              ? data.models.map((m: { name: string }) => m.name)
              : [];

          if (installedModels.length === 0) {
            if (els.ollamaTestResult) {
              els.ollamaTestResult.textContent =
                '⚠️ Ollama is running but no models installed. Enter a model name in "Download Model" and click "Download" to get started.';
              els.ollamaTestResult.className = 'api-test-result error';
            }
          } else {
            const selectedBase = selectedModel.split(':')[0].toLowerCase();
            const installedBases = installedModels.map((m: string) =>
              m.split(':')[0].toLowerCase()
            );
            const modelFound = installedBases.some(
              (base: string) => base === selectedBase
            );
            if (modelFound) {
              if (els.ollamaTestResult) {
                els.ollamaTestResult.textContent = `✓ Connected! Model "${selectedModel}" is installed and ready. Available: ${installedModels.join(', ')}`;
                els.ollamaTestResult.className = 'api-test-result success';
              }
            } else {
              if (els.ollamaTestResult) {
                els.ollamaTestResult.textContent = `✗ Model "${selectedModel}" not installed. Available models: ${installedModels.join(', ')}. Use "Download Model" to install it.`;
                els.ollamaTestResult.className = 'api-test-result error';
              }
            }
          }
        } else {
          const errorText = await response.text();
          console.error('[Ollama Test] Error response:', errorText);
          let errorMsg = 'Connection failed';
          if (response.status === 403) {
            errorMsg =
              'Access denied (403). Check if Ollama is running and the URL is correct.';
          } else if (response.status === 404) {
            errorMsg = 'Ollama not found (404). Check the server URL.';
          } else {
            try {
              const errorData = JSON.parse(errorText);
              errorMsg = errorData.error || errorText;
            } catch {
              errorMsg = errorText || `HTTP ${response.status}`;
            }
          }
          if (els.ollamaTestResult) {
            els.ollamaTestResult.textContent = `✗ Error: ${errorMsg}`;
            els.ollamaTestResult.className = 'api-test-result error';
          }
        }
      } catch (error: unknown) {
        console.error('[Ollama Test] Exception:', error);
        const msg =
          error instanceof Error ? error.message : String(error);
        if (els.ollamaTestResult) {
          els.ollamaTestResult.textContent = `✗ Connection failed: ${msg}. Make sure Ollama is running (try: ollama serve)`;
          els.ollamaTestResult.className = 'api-test-result error';
        }
      }
    });
  }

  if (els.listOllamaModelsButton && els.ollamaTestResult) {
    els.listOllamaModelsButton.addEventListener('click', async () => {
      const ollamaUrl =
        els.ollamaUrlInput?.value.trim() || 'http://localhost:11434';

      try {
        els.ollamaTestResult!.textContent = 'Fetching models...';
        els.ollamaTestResult!.className = 'api-test-result';

        const response = await fetch(`${ollamaUrl}/api/tags`);

        if (response.ok) {
          const data = await response.json();
          if (data.models && data.models.length > 0) {
            const modelNames = data.models
              .map((m: { name: string }) => m.name)
              .join(', ');
            els.ollamaTestResult!.textContent = `✓ Available models: ${modelNames}`;
            els.ollamaTestResult!.className = 'api-test-result success';
          } else {
            els.ollamaTestResult!.textContent =
              '⚠️ No models installed. Run "ollama pull llama3.2" to download one.';
            els.ollamaTestResult!.className = 'api-test-result error';
          }
        } else {
          els.ollamaTestResult!.textContent = '✗ Failed to fetch models';
          els.ollamaTestResult!.className = 'api-test-result error';
        }
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : String(error);
        els.ollamaTestResult!.textContent = `✗ Connection failed: ${msg}. Is Ollama running?`;
        els.ollamaTestResult!.className = 'api-test-result error';
      }
    });
  }

  if (els.downloadOllamaModelButton && els.ollamaDownloadModelInput && els.ollamaDownloadStatus) {
    els.downloadOllamaModelButton.addEventListener('click', async () => {
      const ollamaUrl = (
        els.ollamaUrlInput?.value.trim() || 'http://localhost:11434'
      ).replace(/\/$/, '');
      const modelName = els.ollamaDownloadModelInput!.value.trim();
      const token = els.ollamaAuthTokenInput?.value.trim();

      if (!modelName) {
        els.ollamaDownloadStatus!.textContent =
          '⚠️ Please enter a model name to download';
        els.ollamaDownloadStatus!.className = 'api-test-result error';
        els.ollamaDownloadStatus!.style.display = 'block';
        return;
      }

      try {
        els.downloadOllamaModelButton!.disabled = true;
        els.ollamaDownloadStatus!.textContent = `Starting download of ${modelName}...`;
        els.ollamaDownloadStatus!.className = 'api-test-result';
        els.ollamaDownloadStatus!.style.display = 'block';

        const headers: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        await browser.runtime.sendMessage({
          action: 'startOllamaPull',
          ollamaUrl,
          model: modelName,
          headers,
        });
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : String(error);
        els.ollamaDownloadStatus!.textContent = `✗ Failed to start: ${msg}`;
        els.ollamaDownloadStatus!.className = 'api-test-result error';
      } finally {
        els.downloadOllamaModelButton!.disabled = false;
      }
    });

    // Listen for pull progress messages
    browser.runtime.onMessage.addListener(
      (msg: { action: string; status?: string; percent?: number; ok?: boolean; error?: string }) => {
        if (msg.action === 'ollamaPullProgress') {
          const parts: string[] = [];
          if (msg.status) parts.push(msg.status);
          if (typeof msg.percent === 'number')
            parts.push(`${msg.percent}%`);
          if (els.ollamaDownloadStatus) {
            els.ollamaDownloadStatus.textContent = parts.join(' — ');
            els.ollamaDownloadStatus.className = 'api-test-result';
            els.ollamaDownloadStatus.style.display = 'block';
          }
        } else if (msg.action === 'ollamaPullComplete') {
          if (els.ollamaDownloadStatus) {
            if (msg.ok) {
              els.ollamaDownloadStatus.textContent = '✓ Download complete';
              els.ollamaDownloadStatus.className = 'api-test-result success';
            } else {
              els.ollamaDownloadStatus.textContent = `✗ Download failed: ${msg.error || 'unknown error'}`;
              els.ollamaDownloadStatus.className = 'api-test-result error';
            }
            els.ollamaDownloadStatus.style.display = 'block';
          }
        }
      }
    );
  }

  if (els.diagnoseOllamaButton && els.ollamaDiagnostics) {
    els.diagnoseOllamaButton.addEventListener('click', async () => {
      const ollamaUrl =
        els.ollamaUrlInput?.value.trim() || 'http://localhost:11434';
      let diagnosticOutput =
        '🔍 OLLAMA DIAGNOSTICS\n' + '='.repeat(50) + '\n\n';

      els.ollamaDiagnostics!.style.display = 'block';
      els.ollamaDiagnostics!.className = 'diagnostics-result';
      els.ollamaDiagnostics!.textContent =
        diagnosticOutput + 'Running tests...\n';

      try {
        diagnosticOutput += '📋 Test 1: List Models Endpoint\n';
        diagnosticOutput += `   URL: ${ollamaUrl}/api/tags\n`;
        try {
          const tagsResponse = await fetch(`${ollamaUrl}/api/tags`);
          diagnosticOutput += `   Status: ${tagsResponse.status} ${tagsResponse.statusText}\n`;

          if (tagsResponse.ok) {
            const data = await tagsResponse.json();
            diagnosticOutput += `   ✓ SUCCESS - Found ${data.models?.length || 0} models\n`;
            if (data.models && data.models.length > 0) {
              diagnosticOutput +=
                '   Installed models: ' +
                data.models.map((m: { name: string }) => m.name).join(', ') +
                '\n';
            } else {
              diagnosticOutput += '   ⚠️ No models installed\n';
            }
          } else {
            diagnosticOutput += '   ✗ FAILED\n';
          }
        } catch (error: unknown) {
          const msg =
            error instanceof Error ? error.message : String(error);
          diagnosticOutput += `   ✗ ERROR: ${msg}\n`;
        }

        diagnosticOutput += '\n🔢 Test 2: Version Endpoint\n';
        diagnosticOutput += `   URL: ${ollamaUrl}/api/version\n`;
        try {
          const versionResponse = await fetch(
            `${ollamaUrl}/api/version`
          );
          diagnosticOutput += `   Status: ${versionResponse.status} ${versionResponse.statusText}\n`;

          if (versionResponse.ok) {
            const data = await versionResponse.json();
            diagnosticOutput += `   ✓ SUCCESS - Ollama version: ${data.version || 'unknown'}\n`;
          } else {
            diagnosticOutput +=
              '   ⚠️ Endpoint not available (older Ollama version)\n';
          }
        } catch (error: unknown) {
          const msg =
            error instanceof Error ? error.message : String(error);
          diagnosticOutput += `   ✗ ERROR: ${msg}\n`;
        }

        diagnosticOutput += '\n⬇️ Test 3: Pull Endpoint Check\n';
        diagnosticOutput += `   URL: ${ollamaUrl}/api/pull\n`;
        diagnosticOutput +=
          '   Note: This endpoint is used for downloading models\n';

        diagnosticOutput += '\n' + '='.repeat(50) + '\n';
        diagnosticOutput += '📊 SUMMARY:\n\n';

        if (diagnosticOutput.includes('✓ SUCCESS - Found')) {
          diagnosticOutput += '✓ Ollama is running and accessible\n';
          diagnosticOutput += `✓ API base URL: ${ollamaUrl}\n`;
          els.ollamaDiagnostics!.className = 'diagnostics-result success';
        } else {
          diagnosticOutput += '✗ Cannot connect to Ollama\n';
          diagnosticOutput += '\nTroubleshooting:\n';
          diagnosticOutput +=
            '1. Check if Ollama is running: ps aux | grep ollama\n';
          diagnosticOutput += '2. Start Ollama: ollama serve\n';
          diagnosticOutput += `3. Test manually: curl ${ollamaUrl}/api/tags\n`;
          diagnosticOutput +=
            '4. Check if port 11434 is in use: lsof -i :11434\n';
          els.ollamaDiagnostics!.className = 'diagnostics-result error';
        }
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : String(error);
        diagnosticOutput += '\n❌ CRITICAL ERROR:\n';
        diagnosticOutput += msg + '\n';
        els.ollamaDiagnostics!.className = 'diagnostics-result error';
      }

      els.ollamaDiagnostics!.textContent = diagnosticOutput;
    });
  }
}
