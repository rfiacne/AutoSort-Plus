interface OllamaAnalyzeMessage {
  command: 'ollama_analyze';
  ollama_host: string;
  ollama_model: string;
  ollama_num_ctx: number;
  ollama_auth_token: string;
  prompt: string;
}

interface OllamaErrorMessage {
  command: 'ollama_error';
  error: string;
}

type PopupMessage = OllamaAnalyzeMessage | OllamaErrorMessage;

let statusEl: HTMLElement | null = null;
let messagesEl: HTMLElement | null = null;
let responseEl: HTMLElement | null = null;
let analysisResult: string | null = null;

const urlParams = new URLSearchParams(window.location.search);
const callId = urlParams.get('call_id');

document.addEventListener('DOMContentLoaded', async () => {
  statusEl = document.getElementById('status');
  messagesEl = document.getElementById('messages');
  responseEl = document.getElementById('response');

  if (statusEl) statusEl.textContent = 'Ready';

  const currentWindow = await browser.windows.getCurrent();
  browser.runtime
    .sendMessage({
      command: `ollama_popup_ready_${callId}`,
      window_id: currentWindow.id,
    })
    .catch((err: Error) => console.log('Ready message error (expected):', err.message));
});

browser.runtime.onMessage.addListener(
  (message: PopupMessage, _sender: unknown, _sendResponse: unknown) => {
    switch (message.command) {
      case 'ollama_analyze':
        handleOllamaAnalyze(message);
        break;
      case 'ollama_error':
        if (statusEl) statusEl.textContent = `Error: ${message.error}`;
        if (responseEl) responseEl.textContent = message.error;
        analysisResult = null;
        sendResultToBackground();
        break;
      default:
        console.log('Unknown command:', (message as { command: string }).command);
    }
  }
);

async function handleOllamaAnalyze(message: OllamaAnalyzeMessage): Promise<void> {
  const { ollama_host, ollama_model, ollama_num_ctx, ollama_auth_token, prompt } = message;

  try {
    if (statusEl) statusEl.textContent = 'Connecting to Ollama...';
    if (responseEl) responseEl.textContent = '';
    analysisResult = null;

    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'message user-message';
    userMsgEl.textContent = `Analyzing: ${prompt.substring(0, 100)}...`;
    if (messagesEl) messagesEl.appendChild(userMsgEl);

    if (statusEl) statusEl.textContent = 'Processing with Ollama...';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ollama_auth_token) {
      headers['Authorization'] = `Bearer ${ollama_auth_token}`;
    }

    const requestBody: Record<string, unknown> = {
      model: ollama_model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    };

    if (ollama_num_ctx > 0) {
      requestBody.options = { num_ctx: parseInt(String(ollama_num_ctx), 10) };
    }

    console.log(`[Ollama Popup] Sending POST to: ${ollama_host}/api/chat`);
    console.log(`[Ollama Popup] Model: ${ollama_model}`);

    const response = await fetch(`${ollama_host}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      mode: 'cors',
      credentials: 'omit',
    });

    console.log(`[Ollama Popup] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Ollama Popup] Error response: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    console.log(`[Ollama Popup] Response data: ${JSON.stringify(data).substring(0, 300)}`);

    if (data.message?.content) {
      analysisResult = data.message.content;
      if (responseEl) responseEl.textContent = analysisResult;
      if (statusEl) statusEl.textContent = 'Analysis complete ✓';
    } else {
      throw new Error('Invalid response format: missing message.content');
    }

    setTimeout(sendResultToBackground, 1000);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Ollama Popup] Error: ${msg}`);
    if (statusEl) statusEl.textContent = `Error: ${msg}`;
    if (responseEl) responseEl.textContent = `Error: ${msg}`;
    analysisResult = null;
    sendResultToBackground();
  }
}

function sendResultToBackground(): void {
  browser.runtime
    .sendMessage({
      command: `ollama_analysis_result_${callId}`,
      result: analysisResult,
      error: analysisResult === null ? 'Analysis failed' : null,
    })
    .catch((err: Error) => console.log('Result message error:', err.message));
}
