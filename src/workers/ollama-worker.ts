import { Ollama } from '../ollama';

declare const self: Worker;

interface WorkerMessage {
  type: 'init' | 'chatMessage' | 'stop' | 'clearHistory';
  ollama_host?: string;
  ollama_model?: string;
  ollama_num_ctx?: number | string;
  ollama_auth_token?: string;
  message?: string;
}

let ollamaHost: string | null = null;
let ollamaModel = '';
let ollamaNumCtx: number | undefined = undefined;
let ollamaAuthToken = '';
let ollama: Ollama | null = null;
let stopStreaming = false;
let conversationHistory: Array<{ role: string; content: string }> = [];
let assistantResponseAccumulator = '';

self.onmessage = async function (event: MessageEvent<WorkerMessage>) {
  switch (event.data.type) {
    case 'init': {
      ollamaHost = event.data.ollama_host || null;
      ollamaModel = event.data.ollama_model || '';
      ollamaNumCtx = parseInt(String(event.data.ollama_num_ctx), 10) || undefined;
      ollamaAuthToken = event.data.ollama_auth_token || '';
      try {
        ollama = new Ollama({
          host: ollamaHost || '',
          model: ollamaModel,
          stream: true,
          num_ctx: ollamaNumCtx,
          authToken: ollamaAuthToken,
        });
        console.log(`[Ollama Worker] Initialized with host: ${ollamaHost}, model: ${ollamaModel}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        self.postMessage({ type: 'error', payload: msg });
      }
      break;
    }

    case 'chatMessage': {
      if (!ollama) {
        self.postMessage({ type: 'error', payload: 'Worker not initialized' });
        break;
      }
      conversationHistory.push({ role: 'user', content: event.data.message || '' });
      console.log(`[Ollama Worker] Chat message received: ${event.data.message}`);

      try {
        const response = await ollama.fetchResponse(conversationHistory);
        self.postMessage({ type: 'messageSent' });

        if (!response.ok) {
          let errorMessage = response.statusText;
          try {
            const errorJSON = (await response.json()) as { error?: { message?: string } };
            if (errorJSON.error?.message) errorMessage = errorJSON.error.message;
          } catch {
            // Not JSON, use statusText
          }
          console.error(`[Ollama Worker] API Error: ${errorMessage}`);
          self.postMessage({
            type: 'error',
            payload: `Ollama API Error: ${response.status} ${errorMessage}`,
          });
          break;
        }

        if (!response.body) {
          self.postMessage({ type: 'error', payload: 'No response body' });
          break;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        try {
          while (true) {
            if (stopStreaming) {
              stopStreaming = false;
              reader.cancel();
              conversationHistory.push({ role: 'assistant', content: assistantResponseAccumulator });
              assistantResponseAccumulator = '';
              self.postMessage({ type: 'tokensDone' });
              break;
            }

            const { done, value } = await reader.read();
            if (done) {
              conversationHistory.push({ role: 'assistant', content: assistantResponseAccumulator });
              assistantResponseAccumulator = '';
              self.postMessage({ type: 'tokensDone' });
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            const parsedLines = lines
              .map((line) => line.trim())
              .filter((line) => line !== '')
              .map((line) => {
                try {
                  return JSON.parse(line) as { message?: { content?: string } };
                } catch {
                  console.warn(`[Ollama Worker] JSON parse warning, skipped: ${line}`);
                  return null;
                }
              })
              .filter((parsed) => parsed !== null);

            for (const parsedLine of parsedLines) {
              const content = parsedLine?.message?.content;
              if (content) {
                assistantResponseAccumulator += content;
                self.postMessage({ type: 'newToken', payload: { token: content } });
              }
            }
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[Ollama Worker] Stream error: ${msg}`);
          self.postMessage({ type: 'error', payload: `Connection error: ${msg}` });
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ollama Worker] fetchResponse error:`, error);
        self.postMessage({ type: 'error', payload: msg || 'Ollama API request failed' });
      }
      break;
    }

    case 'stop':
      stopStreaming = true;
      break;

    case 'clearHistory':
      conversationHistory = [];
      assistantResponseAccumulator = '';
      console.log('[Ollama Worker] Conversation history cleared');
      break;

    default:
      console.error('[Ollama Worker] Unknown message type:', (event.data as { type: string }).type);
  }
};
