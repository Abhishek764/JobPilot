import { TRACK_PROFILES, type MatchAnalysisResult, type Track } from './ai.prompts';

const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * Re-score compatibility using per-track weights over the model's breakdown.
 * Falls back to the model's number when breakdown is missing.
 */
export const weightedCompatibility = (track: Track, result: MatchAnalysisResult): number => {
  const { weights } = TRACK_PROFILES[track];
  const b = result.breakdown;
  if (!b) return clamp(result.compatibility);
  const score =
    b.coreSkills * weights.coreSkills +
    b.experience * weights.experience +
    b.projects * weights.projects +
    b.jobAlignment * weights.jobAlignment;
  return clamp(score);
};

/**
 * Lightweight overlap signal between declared user skills and JD-extracted skills.
 * Used to clamp obvious hallucinated 90+ scores when overlap is near-zero.
 */
export const skillOverlap = (userSkills: string[], jobSkills: string[]): number => {
  if (!userSkills.length || !jobSkills.length) return 0;
  const set = new Set(userSkills.map((s) => s.toLowerCase().trim()));
  let hits = 0;
  for (const s of jobSkills) if (set.has(s.toLowerCase().trim())) hits++;
  return hits / jobSkills.length;
};

export const calibrate = (
  track: Track,
  result: MatchAnalysisResult,
  overlapRatio: number | null,
): MatchAnalysisResult => {
  const compatibility = weightedCompatibility(track, result);
  // Cap only when we have a usable overlap signal AND it's very low.
  const capped =
    overlapRatio !== null && overlapRatio < 0.15
      ? Math.min(compatibility, 65)
      : compatibility;
  return {
    ...result,
    compatibility: capped,
    readiness: clamp(result.readiness),
    breakdown: {
      coreSkills: clamp(result.breakdown.coreSkills),
      experience: clamp(result.breakdown.experience),
      projects: clamp(result.breakdown.projects),
      jobAlignment: clamp(result.breakdown.jobAlignment),
    },
  };
};

/** Defensive truncation so very long resumes / JDs don't blow context. */
export const truncate = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`;
