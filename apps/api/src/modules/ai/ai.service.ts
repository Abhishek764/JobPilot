import type { JobMatch } from '@jobpilot/types';
import { prisma } from '@jobpilot/db';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { UpstreamError } from '../../shared/errors';

import { aiCache, hashPrompt } from './ai.cache';
import {
  buildUserPrompt,
  GEMINI_RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  type AnalysisInput,
  type MatchAnalysisResult,
  type Track,
} from './ai.prompts';
import { calibrate, skillOverlap, truncate } from './ai.scoring';
import { estimateCostUsd, getModel } from './gemini.client';

const safeJson = <T>(text: string): T => {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new UpstreamError('Failed to parse AI response', { raw: text, err: String(err) });
  }
};

interface AnalyzeOpts {
  userId?: string;
  jobSkillsHint?: string[];
  skipCache?: boolean;
}

export interface AnalyzeOutcome {
  result: MatchAnalysisResult;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  cacheHit: boolean;
  promptHash: string;
  durationMs: number;
}

export const aiService = {
  /**
   * Core match-engine call. Cached by (operation, model, prompt-payload) hash.
   * Returns scored, calibrated result + token + cost telemetry.
   */
  async analyzeMatch(rawInput: AnalysisInput, opts: AnalyzeOpts = {}): Promise<AnalyzeOutcome> {
    const operation = 'match.analyze';
    const model = env.GEMINI_MATCH_MODEL;

    const input: AnalysisInput = {
      ...rawInput,
      resumeContent: truncate(rawInput.resumeContent, env.AI_MAX_RESUME_CHARS),
      jobDescription: truncate(rawInput.jobDescription, env.AI_MAX_JOB_CHARS),
      projectExperience: rawInput.projectExperience
        ? truncate(rawInput.projectExperience, env.AI_MAX_RESUME_CHARS)
        : undefined,
      userSkills: Array.from(new Set(rawInput.userSkills.map((s) => s.toLowerCase().trim()).filter(Boolean))),
    };

    const promptHash = hashPrompt(operation, model, input);
    const started = Date.now();

    if (!opts.skipCache) {
      const cached = await aiCache.get<MatchAnalysisResult>(promptHash);
      if (cached) {
        const overlap = opts.jobSkillsHint?.length
          ? skillOverlap(input.userSkills, opts.jobSkillsHint)
          : null;
        const calibrated = calibrate(input.track, cached.response, overlap);
        await this.recordUsage({
          userId: opts.userId,
          operation,
          model: cached.model,
          tokensIn: cached.tokensIn,
          tokensOut: cached.tokensOut,
          cached: true,
          durationMs: Date.now() - started,
          metadata: { track: input.track, promptHash },
        });
        return {
          result: calibrated,
          model: cached.model,
          tokensIn: cached.tokensIn,
          tokensOut: cached.tokensOut,
          costUsd: 0,
          cacheHit: true,
          promptHash,
          durationMs: Date.now() - started,
        };
      }
    }

    const userPrompt = buildUserPrompt(input);

    let parsed: MatchAnalysisResult;
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      const gen = getModel(model);
      const response = await gen.generateContent({
        systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      });
      const text = response.response.text();
      if (!text) throw new UpstreamError('Empty AI response');
      parsed = safeJson<MatchAnalysisResult>(text);
      const usage = response.response.usageMetadata;
      tokensIn = usage?.promptTokenCount ?? 0;
      tokensOut = usage?.candidatesTokenCount ?? 0;
    } catch (err) {
      logger.error({ err: String(err), track: input.track }, 'gemini match call failed');
      throw err instanceof UpstreamError ? err : new UpstreamError('AI provider error', { err: String(err) });
    }

    const overlap = opts.jobSkillsHint?.length
      ? skillOverlap(input.userSkills, opts.jobSkillsHint)
      : null;
    const calibrated = calibrate(input.track, parsed, overlap);
    const costUsd = estimateCostUsd(model, tokensIn, tokensOut);
    const durationMs = Date.now() - started;

    // Cache the raw model output so calibration can be re-run cheaply per request.
    await aiCache
      .set(promptHash, operation, { response: parsed, tokensIn, tokensOut, model })
      .catch((err) => logger.warn({ err: String(err) }, 'ai cache write failed'));

    await this.recordUsage({
      userId: opts.userId,
      operation,
      model,
      tokensIn,
      tokensOut,
      cached: false,
      costUsd,
      durationMs,
      metadata: { track: input.track, promptHash },
    });

    return { result: calibrated, model, tokensIn, tokensOut, costUsd, cacheHit: false, promptHash, durationMs };
  },

  async recordUsage(params: {
    userId?: string;
    operation: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    cached: boolean;
    costUsd?: number;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.aiUsage.create({
        data: {
          userId: params.userId ?? null,
          operation: params.operation,
          model: params.model,
          tokensIn: params.tokensIn,
          tokensOut: params.tokensOut,
          cached: params.cached,
          costUsd: params.costUsd ?? 0,
          durationMs: params.durationMs ?? null,
          metadata: params.metadata as object | undefined,
        },
      });
    } catch (err) {
      logger.warn({ err: String(err) }, 'aiUsage record failed');
    }
  },

  /**
   * Draft a cover letter grounded only in the resume and job text. Plain text out;
   * the student reviews and edits before using it.
   */
  async generateCoverLetter(input: {
    resumeContent: string;
    jobDescription: string;
    tone: 'PROFESSIONAL' | 'ENTHUSIASTIC' | 'CONCISE' | 'STORYTELLING';
    candidateName: string | null;
    company: string | null;
    role: string | null;
    userId?: string;
  }): Promise<{ content: string; model: string; tokensIn: number; tokensOut: number; costUsd: number }> {
    const modelName = env.GEMINI_RESUME_MODEL;
    const toneGuide: Record<typeof input.tone, string> = {
      PROFESSIONAL: 'polished and professional',
      ENTHUSIASTIC: 'warm and genuinely enthusiastic, without hype',
      CONCISE: 'brief and direct — under 200 words',
      STORYTELLING: 'built around one concrete story from the resume',
    };
    const prompt = [
      'Write a cover letter for a student or early-career candidate.',
      `Tone: ${toneGuide[input.tone]}.`,
      'Rules:',
      '- Use ONLY experience, skills, projects and facts present in the RESUME. Never invent employers, metrics, degrees or skills.',
      '- Connect 2-3 specific resume items to specific needs in the JOB DESCRIPTION.',
      '- Do not mention or infer age, gender, race, religion, health, disability, nationality, family status or politics.',
      '- No placeholders like [Your Name]; if a name or company is unknown, write around it.',
      '- Return only the letter body as plain text with paragraphs separated by blank lines.',
      input.candidateName ? `Candidate name: ${input.candidateName}` : '',
      input.company ? `Company: ${input.company}` : '',
      input.role ? `Role: ${input.role}` : '',
      '',
      'RESUME:',
      truncate(input.resumeContent, env.AI_MAX_RESUME_CHARS),
      '',
      'JOB DESCRIPTION:',
      truncate(input.jobDescription, env.AI_MAX_JOB_CHARS),
    ]
      .filter((line) => line !== '')
      .join('\n');

    const started = Date.now();
    const result = await getModel(modelName).generateContent(prompt);
    const content = result.response.text().trim();
    if (content.length < 50) throw new UpstreamError('AI returned an empty cover letter');

    const usage = result.response.usageMetadata;
    const tokensIn = usage?.promptTokenCount ?? 0;
    const tokensOut = usage?.candidatesTokenCount ?? 0;
    const costUsd = estimateCostUsd(modelName, tokensIn, tokensOut);
    await this.recordUsage({
      userId: input.userId,
      operation: 'cover-letter.generate',
      model: modelName,
      tokensIn,
      tokensOut,
      cached: false,
      costUsd,
      durationMs: Date.now() - started,
    });
    return { content, model: modelName, tokensIn, tokensOut, costUsd };
  },

  // Legacy Gemini-backed helpers kept for backwards compatibility with existing controllers.
  async matchResumeToJob(resumeContent: string, jobDescription: string): Promise<JobMatch> {
    const model = getModel();
    const prompt = `You are an expert technical recruiter. Compare the resume to the job description.
Return ONLY JSON with this shape:
{"score": number 0-100, "reasoning": string, "matchedSkills": string[], "missingSkills": string[]}

RESUME:
${resumeContent}

JOB DESCRIPTION:
${jobDescription}`;

    const result = await model.generateContent(prompt);
    const parsed = safeJson<Omit<JobMatch, 'jobId'>>(result.response.text());
    return { jobId: '', ...parsed };
  },

  async summarizeJob(description: string): Promise<{ summary: string; skills: string[] }> {
    const model = getModel();
    const prompt = `Summarize the job posting in 2 sentences and extract required technical skills.
Return ONLY JSON: {"summary": string, "skills": string[]}

JOB:
${description}`;
    const result = await model.generateContent(prompt);
    return safeJson(result.response.text());
  },

  async extractResumeSkills(resumeText: string): Promise<{ skills: string[]; yearsExperience: number }> {
    const model = getModel();
    const prompt = `Extract skills and total years of experience from this resume.
Return ONLY JSON: {"skills": string[], "yearsExperience": number}

RESUME:
${resumeText}`;
    const result = await model.generateContent(prompt);
    return safeJson(result.response.text());
  },

  hashPrompt,
  estimateCostUsd,
  truncate,
} as const;

export type { Track };
