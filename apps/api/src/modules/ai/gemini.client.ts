import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

import { env } from '../../config/env';

const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export const getModel = (model = env.GEMINI_MODEL): GenerativeModel =>
  client.getGenerativeModel({ model });

// Approximate per-1M-token USD costs. Analytics only — not billing-grade.
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash-exp': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
};

export const estimateCostUsd = (model: string, tokensIn: number, tokensOut: number): number => {
  const p = PRICING[model] ?? PRICING['gemini-2.0-flash-exp'];
  return (tokensIn / 1_000_000) * p.input + (tokensOut / 1_000_000) * p.output;
};
