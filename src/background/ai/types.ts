import type { EmailContext } from '../../types/email';

export interface AnalyzeRequest {
  emailContent: string;
  emailContext: EmailContext | null;
  labels: string[];
  customPrompt?: string;
}

export interface AnalyzeResult {
  suggestedLabel: string;
  confidence?: number;
  rawResponse: string;
}

export interface AIProvider {
  analyze(request: AnalyzeRequest, settings: Record<string, unknown>): Promise<AnalyzeResult>;
}
