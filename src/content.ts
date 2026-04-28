// ── Debug Log ─────────────────────────────────────

interface DebugLog {
  enabled: boolean;
  init(): Promise<void>;
  info(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

const debugLog: DebugLog = {
  enabled: false,

  async init() {
    try {
      const result = await browser.storage.local.get('debugMode');
      this.enabled = !!result.debugMode;
    } catch (_e) {
      // Ignore errors reading storage
    }

    // Listen for changes
    browser.storage.onChanged.addListener(
      (changes: Record<string, { newValue?: unknown }>, area: string) => {
        if (area === 'local' && changes.debugMode !== undefined) {
          this.enabled = !!changes.debugMode.newValue;
        }
      }
    );
  },

  info(message: string, data: unknown = null) {
    if (this.enabled) {
      console.info(
        '%c[Content]',
        'color: white; background: #00BCD4; padding: 2px 6px; border-radius: 4px;',
        message,
        data !== null ? data : ''
      );
    }
  },

  error(message: string, data: unknown = null) {
    // Always output errors
    console.error(
      '%c[Content]',
      'color: white; background: #F44336; padding: 2px 6px; border-radius: 4px;',
      message,
      data !== null ? data : ''
    );
  },
};

// Initialize debug mode
(async () => {
  await debugLog.init();
})();

// ── Message Types ─────────────────────────────────

interface OllamaFetchMessage {
  action: 'ollamaFetch';
  fetchAction: 'pull' | 'chat';
  model: string;
  prompt?: string;
  headers?: Record<string, string>;
  correlationId?: string;
}

interface SelectedMessage {
  id: string;
}

// ── Message Listener ──────────────────────────────

browser.runtime.onMessage.addListener(
  (
    message: { action: string } & Record<string, unknown>,
    _sender: unknown,
    sendResponse: (response: unknown) => void
  ): boolean => {
    if (message.action === 'getSelectedMessages') {
      try {
        // Get the message list container
        const messageList = document.querySelector('#threadTree');
        if (!messageList) {
          console.error('Could not find message list');
          sendResponse([]);
          return true;
        }

        // Get selected rows
        const selectedRows = messageList.querySelectorAll('tr.selected');
        if (!selectedRows || selectedRows.length === 0) {
          debugLog.info('No messages selected');
          sendResponse([]);
          return true;
        }

        // Extract message IDs
        const selectedMessages: SelectedMessage[] = Array.from(selectedRows)
          .map((row) => {
            // Try different possible ID attributes
            const messageId =
              row.getAttribute('data-message-id') ||
              row.getAttribute('data-id') ||
              row.getAttribute('id');

            if (!messageId) {
              debugLog.info('Row missing message ID:', row);
              return null;
            }

            // Clean up the ID if needed
            const cleanId = messageId.replace(/^msg-/i, '');
            return { id: cleanId };
          })
          .filter(
            (msg): msg is SelectedMessage =>
              msg !== null && msg.id !== ''
          );

        debugLog.info('Found selected messages:', selectedMessages);
        sendResponse(selectedMessages);
      } catch (error: unknown) {
        console.error('Error getting selected messages:', error);
        sendResponse([]);
      }
    } else if (message.action === 'ollamaFetch') {
      // Runs inside a tab at http://localhost:11434 to avoid CORS
      (async () => {
        try {
          const msg = message as unknown as OllamaFetchMessage;
          const { fetchAction, model, prompt, headers, correlationId } = msg;
          const base = window.location.origin;

          if (fetchAction === 'pull') {
            const res = await fetch(`${base}/api/pull`, {
              method: 'POST',
              headers: Object.assign(
                { 'Content-Type': 'application/json' },
                headers || {}
              ),
              body: JSON.stringify({ name: model, stream: true }),
            });
            if (!res.ok) {
              const t = await res.text();
              let errorMsg: string = t || `HTTP ${res.status}`;
              try {
                const j = JSON.parse(t);
                if (j.error) errorMsg = j.error;
              } catch (_parseErr) {
                // Not JSON, use raw text
              }
              throw new Error(errorMsg);
            }
            if (!res.body) {
              throw new Error('Response body is null');
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const data = JSON.parse(line);
                  const payload: Record<string, unknown> = {
                    action: 'ollamaPullProgress',
                    correlationId,
                    status: data.status || '',
                  };
                  if (data.completed && data.total) {
                    payload.percent = Math.round(
                      (data.completed / data.total) * 100
                    );
                  }
                  browser.runtime.sendMessage(payload).catch(() => {
                    // Ignore send errors
                  });
                } catch (_e) {
                  // ignore parse errors for partial lines
                }
              }
            }
            browser.runtime
              .sendMessage({
                action: 'ollamaPullComplete',
                correlationId,
                ok: true,
              })
              .catch(() => {
                // Ignore send errors
              });
            sendResponse({ ok: true });
          } else if (fetchAction === 'chat') {
            const res = await fetch(`${base}/api/chat`, {
              method: 'POST',
              headers: Object.assign(
                { 'Content-Type': 'application/json' },
                headers || {}
              ),
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
              }),
            });
            if (!res.ok) {
              const errBody = await res.text();
              let msg = `HTTP ${res.status}`;
              try {
                const j = JSON.parse(errBody);
                if (j.error) msg = j.error;
              } catch (_e) {
                // Use default error message
              }
              throw new Error(msg);
            }
            const data = await res.json();
            sendResponse({ ok: true, data });
          } else {
            sendResponse({ ok: false, error: 'unknown fetchAction' });
          }
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : String(err);
          sendResponse({ ok: false, error: message });
        }
      })();
      return true;
    }
    return true;
  }
);
