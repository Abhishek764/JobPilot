import { describe, expect, it } from 'vitest';

import {
  buildResumeAnalysisPrompt,
  buildTailorPrompt,
  normalizeResumeAnalysis,
} from './resume-analysis';

describe('normalizeResumeAnalysis', () => {
  const raw = {
    atsScore: 140,
    keywordScore: 55.6,
    overallScore: -3,
    matchedKeywords: ['SQL', 'SQL', 'python'],
    missingKeywords: ['Tableau'],
    strengths: ['Clear dates', ''],
    weaknesses: ['No summary'],
    suggestions: [
      { section: 'Summary', issue: 'Missing', recommendation: 'Add one', severity: 'high' },
      { section: 'X', issue: 'Y', recommendation: 'Z', severity: 'critical' },
      { section: '', issue: '', recommendation: '' },
    ],
    atsIssues: [{ check: 'Tables', passed: false, detail: 'Avoid tables' }, { nope: 1 }],
  };

  it('clamps scores to 0–100 integers and dedupes keywords', () => {
    const out = normalizeResumeAnalysis(raw, true);
    expect(out.atsScore).toBe(100);
    expect(out.keywordScore).toBe(56);
    expect(out.overallScore).toBe(0);
    expect(out.matchedKeywords).toEqual(['SQL', 'python']);
    expect(out.strengths).toEqual(['Clear dates']);
  });

  it('keeps only well-formed suggestions and ATS checks', () => {
    const out = normalizeResumeAnalysis(raw, true);
    expect(out.suggestions).toEqual([
      { section: 'Summary', issue: 'Missing', recommendation: 'Add one', severity: 'high' },
      { section: 'X', issue: 'Y', recommendation: 'Z', severity: 'medium' },
    ]);
    expect(out.atsIssues).toEqual([{ check: 'Tables', passed: false, detail: 'Avoid tables' }]);
  });

  it('drops keyword data for an ATS-only analysis', () => {
    const out = normalizeResumeAnalysis(raw, false);
    expect(out.keywordScore).toBeNull();
    expect(out.matchedKeywords).toEqual([]);
    expect(out.missingKeywords).toEqual([]);
  });
});

describe('buildResumeAnalysisPrompt', () => {
  it('forbids protected characteristics and includes the job only when given', () => {
    const withJob = buildResumeAnalysisPrompt('RESUME TEXT', 'JOB TEXT');
    expect(withJob).toContain('RESUME TEXT');
    expect(withJob).toContain('JOB TEXT');
    expect(withJob.toLowerCase()).toContain('protected characteristics');
    expect(buildResumeAnalysisPrompt('RESUME TEXT', null)).not.toContain('JOB DESCRIPTION');
  });
});

describe('buildTailorPrompt', () => {
  it('forbids inventing facts and protected characteristics', () => {
    const p = buildTailorPrompt('RESUME TEXT', 'JOB TEXT');
    expect(p).toContain('RESUME TEXT');
    expect(p).toContain('JOB TEXT');
    expect(p.toLowerCase()).toContain('never invent');
    expect(p.toLowerCase()).toContain('protected characteristics');
  });
});
