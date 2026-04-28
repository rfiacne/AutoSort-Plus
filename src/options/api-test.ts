import { els } from './shared/dom-refs';
import { showApiTestResult } from './shared/ui';
import { getGeminiKeys } from './gemini-keys';

export async function handleTestApi(): Promise<void> {
  const provider = els.aiProviderSelect.value;
  const apiKey =
    provider === 'gemini'
      ? getGeminiKeys().find((k) => k && k.trim()) || ''
      : els.apiKeyInput.value.trim();

  if (provider === 'ollama') {
    showApiTestResult(
      'Please use the "Test Ollama Connection" button below',
      false,
      true
    );
    return;
  }
  if (provider === 'openai-compatible') {
    showApiTestResult(
      'Please use the "Test Connection" button in the OpenAI-Compatible section',
      false,
      true
    );
    return;
  }

  if (!apiKey) {
    showApiTestResult('Please enter an API key', false);
    return;
  }

  try {
    showApiTestResult('Testing connection...', false, true);

    let response: Response;
    if (provider === 'gemini') {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Test' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        }
      );
    } else if (provider === 'openai') {
      response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Test' }],
            max_tokens: 10,
          }),
        }
      );
    } else if (provider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 10,
        }),
      });
    } else if (provider === 'groq') {
      response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Test' }],
            max_tokens: 10,
          }),
        }
      );
    } else if (provider === 'mistral') {
      response = await fetch(
        'https://api.mistral.ai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [{ role: 'user', content: 'Test' }],
            max_tokens: 10,
          }),
        }
      );
    } else {
      showApiTestResult('Unknown provider: ' + provider, false);
      return;
    }

    if (response.ok) {
      showApiTestResult('✓ API connection successful!', true);
    } else {
      const error = await response.json().catch(() => ({} as Record<string, unknown>));
      showApiTestResult(
        `API Error: ${(error.error as Record<string, unknown>)?.message || error.message || 'Unknown error'}`,
        false
      );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    showApiTestResult(`Connection Error: ${msg}`, false);
  }
}
