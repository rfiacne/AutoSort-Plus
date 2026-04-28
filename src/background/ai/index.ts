import type { AnalyzeRequest, AnalyzeResult } from './types';
import { injectPlaceholders, DEFAULT_PROMPT } from './prompt';
import { analyze as geminiAnalyze } from './providers/gemini';
import { analyze as openaiAnalyze } from './providers/openai';
import { analyze as anthropicAnalyze } from './providers/anthropic';
import { analyze as groqAnalyze } from './providers/groq';
import { analyze as mistralAnalyze } from './providers/mistral';
import { analyze as ollamaAnalyze } from './providers/ollama';
import { analyze as openaiCompatAnalyze } from './providers/openai-compat';

export type { AnalyzeRequest, AnalyzeResult } from './types';
export { DEFAULT_PROMPT, injectPlaceholders, stripCodeFences, matchLabelFromResponse } from './prompt';

const providerMap: Record<string, (req: AnalyzeRequest, settings: Record<string, unknown>) => Promise<AnalyzeResult>> = {
  gemini: geminiAnalyze,
  openai: openaiAnalyze,
  anthropic: anthropicAnalyze,
  groq: groqAnalyze,
  mistral: mistralAnalyze,
  ollama: ollamaAnalyze,
  'openai-compatible': openaiCompatAnalyze,
};

export async function analyzeEmail(
  request: AnalyzeRequest,
  provider: string,
  settings: Record<string, unknown>
): Promise<AnalyzeResult> {
  const analyzeFn = providerMap[provider];
  if (!analyzeFn) {
    throw new Error(`Unknown AI provider: ${provider}`);
  }

  const customPrompt = request.customPrompt || (settings.customPrompt as string) || DEFAULT_PROMPT;
  const emailContext = request.emailContext;

  // Build prompt from template if context is available
  const prompt = emailContext
    ? injectPlaceholders(customPrompt, emailContext, request.labels)
    : request.emailContent;

  const debugLogger = (window as any).debugLogger;
  if (debugLogger) {
    debugLogger.apiRequest(provider, provider, { prompt, labels: request.labels });
  }

  try {
    const result = await analyzeFn({ ...request, emailContent: prompt }, settings);

    if (debugLogger) {
      debugLogger.apiResponse(provider, 200, {
        label: result.suggestedLabel,
        rawResponse: result.rawResponse,
      });
    }
    return result;
  } catch (err: any) {
    if (debugLogger) {
      debugLogger.apiResponse(provider, 0, { error: err.message });
    }
    throw err;
  }
}
