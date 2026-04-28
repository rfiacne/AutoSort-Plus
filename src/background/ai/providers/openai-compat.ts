import type { AnalyzeRequest, AnalyzeResult } from '../types';
import { matchLabelFromResponse } from '../prompt';
import { fetchViaTab } from '../../../shared/tab-fetch';

declare const browser: any;

export interface ProviderRequest {
  url: string;
  body: Record<string, unknown>;
  apiKey: string;
  isLocalhost: boolean;
}

export function buildRequest(
  request: AnalyzeRequest,
  settings: Record<string, unknown>
): ProviderRequest {
  const rawUrl = ((settings.customBaseUrl as string) || '').replace(/\/$/, '');
  const model = (settings.customModel as string) || '';
  const apiKey = (settings.apiKey as string) || '';

  // Strip /v1 suffix if present — we always append /v1/chat/completions
  const baseUrl = rawUrl.replace(/\/v1\/?$/, '');

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: request.emailContent }],
    max_tokens: 8192,
    temperature: 0.6,
    top_p: 0.95,
  };

  const isLocalhost =
    baseUrl.startsWith('http://localhost') ||
    baseUrl.startsWith('http://127.0.0.1');

  return {
    url: baseUrl,
    body,
    apiKey,
    isLocalhost,
  };
}

export function parseResponse(data: unknown): string | null {
  const d = data as Record<string, unknown>;
  if (!d.choices || !Array.isArray(d.choices) || d.choices.length === 0) {
    return null;
  }

  const choice = d.choices[0] as Record<string, unknown>;
  const message = choice.message as Record<string, unknown> | undefined;

  // Try multiple possible content locations
  const content =
    message?.content ||
    choice.text ||
    (choice.delta as Record<string, unknown>)?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  // Some models return reasoning in separate field
  if (message?.reasoning_content && typeof message.reasoning_content === 'string') {
    return message.reasoning_content.trim();
  }

  return null;
}

export async function analyze(
  request: AnalyzeRequest,
  settings: Record<string, unknown>
): Promise<AnalyzeResult> {
  const { url, body, apiKey, isLocalhost } = buildRequest(request, settings);

  let data: unknown;

  if (isLocalhost) {
    // Use tab injection for localhost (browser context, no CORS restrictions)
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    data = await fetchViaTab(url, {
      endpoint: '/v1/chat/completions',
      body,
      headers,
      resultKey: '__openai_compat_result',
    });

    const d = data as Record<string, unknown>;
    if (!d.choices || !Array.isArray(d.choices) || d.choices.length === 0) {
      throw new Error('Invalid OpenAI-compatible response format');
    }
  } else {
    // Direct fetch for non-localhost endpoints
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(url + '/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        const err = errorData as Record<string, unknown>;
        errorMessage =
          (err.error as Record<string, string>)?.message ||
          (err.message as string) ||
          errorMessage;
      } catch {
        // ignore parse errors
      }

      if (
        response.status === 429 ||
        errorMessage.includes('quota') ||
        errorMessage.includes('rate limit')
      ) {
        errorMessage =
          'API quota exceeded. Please wait a while before trying again, or upgrade to a paid API key.';
      }
      throw new Error(errorMessage);
    }

    data = await response.json();
  }

  const rawText = parseResponse(data);

  if (!rawText) {
    throw new Error('No text extracted from OpenAI-compatible response');
  }

  return {
    suggestedLabel: matchLabelFromResponse(rawText, request.labels),
    rawResponse: rawText,
  };
}
