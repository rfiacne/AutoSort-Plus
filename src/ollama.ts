declare const window: any;

export interface OllamaOptions {
  host?: string;
  model?: string;
  stream?: boolean;
  num_ctx?: number;
  authToken?: string;
}

export interface OllamaModelsResult {
  ok: boolean;
  response?: unknown;
  error?: string;
  is_exception?: boolean;
}

export class Ollama {
  host = '';
  model = '';
  stream = false;
  num_ctx = 0;
  authToken = '';

  constructor({
    host = '',
    model = '',
    stream = false,
    num_ctx = 0,
    authToken = '',
  }: OllamaOptions = {}) {
    this.host = (host || '').trim().replace(/\/+$/, '');
    if (!this.host) {
      throw new Error('Ollama host URL is required');
    }
    this.model = model;
    this.stream = stream;
    this.num_ctx = num_ctx;
    this.authToken = authToken || '';
  }

  getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  };

  fetchModels = async (): Promise<OllamaModelsResult> => {
    try {
      const response = await fetch(this.host + '/api/tags', {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        console.error(`[AutoSort+] Ollama API request failed: ${response.status} ${response.statusText}, Detail: ${errorDetail}`);
        return { ok: false, error: errorDetail };
      }

      const responseData = await response.json();
      return { ok: true, response: responseData };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[AutoSort+] Ollama API request failed: ${msg}`);
      return { is_exception: true, ok: false, error: `Ollama API request failed: ${msg}` };
    }
  };

  fetchResponse = async (messages: unknown[]): Promise<Response> => {
    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        stream: this.stream,
      };
      if (this.num_ctx > 0) {
        body.options = { num_ctx: parseInt(String(this.num_ctx), 10) };
      }

      return await fetch(this.host + '/api/chat', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[AutoSort+] Ollama API request failed: ${msg}`);
      throw new Error(`Ollama API request failed: ${msg}`);
    }
  };
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Ollama = Ollama;
}
