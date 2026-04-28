import type { AnalyzeRequest, AnalyzeResult } from '../types';
import { matchLabelFromResponse } from '../prompt';

declare const browser: any;

export interface ProviderRequest {
  url: string;
  options: RequestInit;
}

export function buildRequest(
  request: AnalyzeRequest,
  settings: Record<string, unknown>
): ProviderRequest {
  const apiKey = settings.apiKey as string;

  const body = {
    model: 'claude-3-haiku-20240307',
    messages: [{ role: 'user', content: request.emailContent }],
    max_tokens: 50,
  };

  return {
    url: 'https://api.anthropic.com/v1/messages',
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    },
  };
}

export function parseResponse(data: unknown): string | null {
  const d = data as Record<string, unknown>;
  if (!d.content || !Array.isArray(d.content) || d.content.length === 0) {
    return null;
  }

  const first = d.content[0] as Record<string, unknown>;
  return first.text ? String(first.text).trim() : null;
}

export async function analyze(
  request: AnalyzeRequest,
  settings: Record<string, unknown>
): Promise<AnalyzeResult> {
  const { url, options } = buildRequest(request, settings);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
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

  const data = await response.json();
  const rawText = parseResponse(data);

  if (!rawText) {
    throw new Error('No text extracted from Anthropic response');
  }

  return {
    suggestedLabel: matchLabelFromResponse(rawText, request.labels),
    rawResponse: rawText,
  };
}
