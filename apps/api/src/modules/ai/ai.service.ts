import type { JobMatch } from '@jobpilot/types';

import { UpstreamError } from '../../shared/errors';

import { getModel } from './gemini.client';

const safeJson = <T>(text: string): T => {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new UpstreamError('Failed to parse AI response', { raw: text, err: String(err) });
  }
};

export const aiService = {
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
};
