import { SchemaType } from '@google/generative-ai';
import type { AtsIssue, ResumeSuggestion } from '@jobpilot/types';

export interface ResumeAnalysisResult {
  atsScore: number;
  keywordScore: number | null;
  overallScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: ResumeSuggestion[];
  atsIssues: AtsIssue[];
}

export const buildResumeAnalysisPrompt = (resume: string, jobDescription: string | null): string =>
  [
    'You review resumes for students and early-career candidates, the way an ATS and a recruiter would.',
    'Score honestly from 0 to 100. Base every finding on text actually present in the resume.',
    'atsScore: parseability and structure (standard headings, dates, contact info, no tables or graphics-only content).',
    jobDescription
      ? 'keywordScore: how well the resume covers the skills and keywords in the JOB DESCRIPTION; list matched and missing keywords.'
      : 'There is no job: set keywordScore to 0 and return empty keyword lists.',
    'overallScore: overall strength for the student’s target roles.',
    'suggestions: concrete rewrites the student can make, each tied to a resume section.',
    'Never infer, mention or weigh protected characteristics — age, gender, race, ethnicity, nationality, religion, sexual orientation, health, disability, family status or political beliefs.',
    '',
    'RESUME:',
    resume,
    ...(jobDescription ? ['', 'JOB DESCRIPTION:', jobDescription] : []),
  ].join('\n');

const strings = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } } as const;

export const RESUME_ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    atsScore: { type: SchemaType.INTEGER },
    keywordScore: { type: SchemaType.INTEGER },
    overallScore: { type: SchemaType.INTEGER },
    matchedKeywords: strings,
    missingKeywords: strings,
    strengths: strings,
    weaknesses: strings,
    suggestions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          section: { type: SchemaType.STRING },
          issue: { type: SchemaType.STRING },
          recommendation: { type: SchemaType.STRING },
          severity: { type: SchemaType.STRING, enum: ['low', 'medium', 'high'] },
        },
        required: ['section', 'issue', 'recommendation', 'severity'],
      },
    },
    atsIssues: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          check: { type: SchemaType.STRING },
          passed: { type: SchemaType.BOOLEAN },
          detail: { type: SchemaType.STRING },
        },
        required: ['check', 'passed', 'detail'],
      },
    },
  },
  required: [
    'atsScore',
    'keywordScore',
    'overallScore',
    'matchedKeywords',
    'missingKeywords',
    'strengths',
    'weaknesses',
    'suggestions',
    'atsIssues',
  ],
};

const score = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
};

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const list = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map(text).filter(Boolean))] : [];

const SEVERITIES = new Set(['low', 'medium', 'high']);

/** Model output is untrusted: clamp scores and keep only well-formed rows. */
export const normalizeResumeAnalysis = (raw: unknown, hasJob: boolean): ResumeAnalysisResult => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const suggestions = (Array.isArray(r.suggestions) ? r.suggestions : [])
    .map((s: Record<string, unknown>) => ({
      section: text(s?.section),
      issue: text(s?.issue),
      recommendation: text(s?.recommendation),
      severity: (SEVERITIES.has(text(s?.severity))
        ? text(s?.severity)
        : 'medium') as ResumeSuggestion['severity'],
    }))
    .filter((s) => s.section && s.issue && s.recommendation);
  const atsIssues = (Array.isArray(r.atsIssues) ? r.atsIssues : [])
    .filter((a: Record<string, unknown>) => text(a?.check) && typeof a?.passed === 'boolean')
    .map((a: Record<string, unknown>) => ({
      check: text(a.check),
      passed: a.passed as boolean,
      detail: text(a.detail),
    }));

  return {
    atsScore: score(r.atsScore),
    keywordScore: hasJob ? score(r.keywordScore) : null,
    overallScore: score(r.overallScore),
    matchedKeywords: hasJob ? list(r.matchedKeywords) : [],
    missingKeywords: hasJob ? list(r.missingKeywords) : [],
    strengths: list(r.strengths),
    weaknesses: list(r.weaknesses),
    suggestions,
    atsIssues,
  };
};
