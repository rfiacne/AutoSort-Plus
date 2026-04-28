import type { AnalyzeRequest, AnalyzeResult } from '../types';
import { stripCodeFences, matchLabelFromResponse } from '../prompt';

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
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: request.emailContent }],
      },
    ],
    generationConfig: {
      temperature: 0.6,
      topK: 20,
      topP: 0.95,
      maxOutputTokens: 50,
      responseMimeType: 'text/plain',
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  };

  return {
    url: apiUrl,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  };
}

export function parseResponse(data: unknown): string | null {
  const d = data as Record<string, unknown>;
  if (!d.candidates || !Array.isArray(d.candidates) || d.candidates.length === 0) {
    return null;
  }

  const candidate = d.candidates[0] as Record<string, unknown>;

  if (candidate.finishReason === 'MAX_TOKENS') {
    return null;
  }

  const content = candidate.content as Record<string, unknown> | undefined;
  if (!content?.parts || !Array.isArray(content.parts) || content.parts.length === 0) {
    return null;
  }

  const part = content.parts[0] as Record<string, unknown>;
  return part.text ? String(part.text).trim() : null;
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
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const rawText = parseResponse(data);

  if (!rawText) {
    throw new Error('No text extracted from Gemini response');
  }

  return {
    suggestedLabel: matchLabelFromResponse(rawText, request.labels),
    rawResponse: rawText,
  };
}
