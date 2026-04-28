import type { AnalyzeRequest, AnalyzeResult } from '../types';
import { matchLabelFromResponse } from '../prompt';
import { fetchViaTab } from '../../../shared/tab-fetch';

declare const browser: any;

export interface ProviderRequest {
  url: string;
  body: Record<string, unknown>;
}

export function buildRequest(
  request: AnalyzeRequest,
  settings: Record<string, unknown>
): ProviderRequest {
  const ollamaUrl = (settings.ollamaUrl as string) || 'http://localhost:11434';
  let ollamaModel = (settings.ollamaModel as string) || 'llama3.2';
  const ollamaCustomModel = settings.ollamaCustomModel as string | undefined;

  // Use custom model if selected
  if (ollamaModel === 'custom' && ollamaCustomModel) {
    ollamaModel = ollamaCustomModel;
  }

  const body: Record<string, unknown> = {
    model: ollamaModel,
    messages: [{ role: 'user', content: request.emailContent }],
    stream: false,
  };

  // Add num_ctx if configured
  const ollamaNumCtx = settings.ollamaNumCtx as number;
  if (ollamaNumCtx > 0) {
    body.options = { num_ctx: Number(ollamaNumCtx) };
  }

  return {
    url: ollamaUrl,
    body,
  };
}

export function parseResponse(data: unknown): string | null {
  const d = data as Record<string, unknown>;
  const msg = d.message as Record<string, unknown> | string | undefined;

  if (!msg) {
    // Some older/local versions may return data as string or have different keys
    const fallback =
      (d.result as string) || (d.text as string) || (d.response as string);
    return fallback ? fallback.trim() : null;
  }

  if (typeof msg === 'string') {
    return msg.trim();
  }

  const content = msg.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    // Find first element that's a string or has text/content fields
    const first = content.find(
      (c) => typeof c === 'string' || (c && (c.text || c.content))
    );
    if (typeof first === 'string') return first.trim();
    if (first && (first as Record<string, unknown>).text)
      return String((first as Record<string, unknown>).text).trim();
    if (first && (first as Record<string, unknown>).content) {
      const inner = (first as Record<string, unknown>).content;
      if (typeof inner === 'string') return inner.trim();
      if (Array.isArray(inner))
        return inner.map((x) => (x as Record<string, unknown>).text || x).join(' ').trim();
    }
  }

  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const c = content as Record<string, unknown>;
    const textVal = (c.text || c.content || c[0]) as string | undefined;
    if (textVal) return String(textVal).trim();
    if (c.parts && Array.isArray(c.parts) && c.parts.length > 0) {
      const part = c.parts[0] as Record<string, unknown>;
      return part.text ? String(part.text).trim() : null;
    }
  }

  // If no content but msg has text/response/result
  if (!content && msg) {
    const m = msg as Record<string, unknown>;
    const fallbackText = (m.text || m.response || m.result) as string | undefined;
    return fallbackText ? fallbackText.trim() : null;
  }

  return null;
}

export async function analyze(
  request: AnalyzeRequest,
  settings: Record<string, unknown>
): Promise<AnalyzeResult> {
  const { url, body } = buildRequest(request, settings);

  const ollamaAuthToken = (settings.ollamaAuthToken as string) || '';
  const headers: Record<string, string> = {};
  if (ollamaAuthToken) headers['Authorization'] = `Bearer ${ollamaAuthToken}`;

  let data: unknown;

  // Try fetchViaTab first (avoids CORS by running fetch inside a same-origin tab).
  // If it fails, retry once after a short delay — tab creation can be throttled
  // when triggered from non-user-initiated events (e.g. onNewMailReceived).
  let lastTabError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      data = await fetchViaTab(url, {
        endpoint: '/api/chat',
        body,
        headers,
        resultKey: '__ollama_result',
        timeoutMs: attempt === 0 ? 30000 : 45000,
      });
      lastTabError = null;
      break;
    } catch (e) {
      lastTabError = e as Error;
      console.warn(
        `[Ollama] fetchViaTab attempt ${attempt + 1}/2 failed:`,
        lastTabError.message
      );
    }
  }

  if (lastTabError) {
    // Fallback: XHR from background page.
    // XHR in Firefox extensions does not trigger CORS preflight for permitted
    // hosts, unlike fetch() which may send OPTIONS when Content-Type is set.
    console.warn(
      '[Ollama] fetchViaTab exhausted, falling back to XHR:',
      lastTabError.message
    );
    data = await new Promise<unknown>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${url}/api/chat`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }
      xhr.timeout = 30000;
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error(`Failed to parse Ollama response: ${xhr.responseText.substring(0, 200)}`));
          }
        } else {
          reject(
            new Error(`Ollama API error: HTTP ${xhr.status}${xhr.responseText ? ` - ${xhr.responseText.substring(0, 300)}` : ''}`)
          );
        }
      };
      xhr.onerror = () => {
        reject(new Error('Ollama XHR network error — check that Ollama is running and CORS is not blocking'));
      };
      xhr.ontimeout = () => {
        reject(new Error('Ollama XHR timeout (30s)'));
      };
      xhr.send(JSON.stringify(body));
    });
  }

  const rawText = parseResponse(data);

  if (!rawText) {
    throw new Error('No text extracted from Ollama response');
  }

  return {
    suggestedLabel: matchLabelFromResponse(rawText, request.labels),
    rawResponse: rawText,
  };
}
