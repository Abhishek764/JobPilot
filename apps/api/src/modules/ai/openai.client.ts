import OpenAI from 'openai';

import { env } from '../../config/env';

let _client: OpenAI | null = null;

export const getOpenAI = (): OpenAI => {
  if (!_client) {
    _client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: env.OPENAI_TIMEOUT_MS,
      maxRetries: env.OPENAI_MAX_RETRIES,
    });
  }
  return _client;
};

// Approximate per-1M-token USD costs. Used for analytics only — not billing-grade.
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};

export const estimateCostUsd = (
  model: string,
  tokensIn: number,
  tokensOut: number,
): number => {
  const p = PRICING[model] ?? PRICING['gpt-4o-mini'];
  return (tokensIn / 1_000_000) * p.input + (tokensOut / 1_000_000) * p.output;
};
