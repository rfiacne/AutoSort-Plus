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
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: request.emailContent }],
    max_tokens: 50,
    temperature: 0.6,
    top_p: 0.95,
  };

  return {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
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
    throw new Error('No text extracted from Groq response');
  }

  return {
    suggestedLabel: matchLabelFromResponse(rawText, request.labels),
    rawResponse: rawText,
  };
}
