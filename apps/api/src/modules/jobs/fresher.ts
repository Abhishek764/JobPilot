/** JobPilot lists fresher roles only: internships and jobs needing at most this much experience. */
export const FRESHER_MAX_YEARS = 1.5;

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const YEARS = String.raw`(?:years?|yrs?|jahren?|jahre)`;
const RANGE = String.raw`(?:\s*(?:\+|plus))?(?:\s*(?:-|–|to|bis)\s*\d+(?:[.,]\d+)?)?`;

// "3+ years of experience", "2-4 yrs experience", "mindestens 3 Jahre Berufserfahrung"
const YEARS_THEN_EXPERIENCE = new RegExp(
  String.raw`${NUM}${RANGE}\s*${YEARS}\b[^.\n]{0,40}?(?:experience|erfahrung)`,
  'gi',
);
// "Experience: 1.5 years", "experience of 2+ years"
const EXPERIENCE_THEN_YEARS = new RegExp(
  String.raw`(?:experience|erfahrung)[^.\d\n]{0,20}${NUM}${RANGE}\s*${YEARS}\b`,
  'gi',
);

const ENTRY_TITLE =
  /\b(intern|internship|junior|jr|entry[- ]level|graduate|grad|trainee|freshers?|apprentice(ship)?|werkstudent(in)?|working student|praktikum|praktikant(in)?|new grad|campus)\b/i;
const SENIOR_TITLE =
  /\b(senior|sr|lead|principal|staff|head|director|vp|vice president|manager|architect|chief|cto|cfo|ceo|expert)\b/i;

const toNumber = (s: string): number => Number(s.replace(',', '.'));

/**
 * The most demanding minimum experience a posting states, in years, or null when it
 * states none. Only numbers tied to "experience"/"Erfahrung" count, so "founded 10 years
 * ago" is ignored.
 */
export const requiredYears = (text: string | null): number | null => {
  if (!text) return null;
  const found: number[] = [];
  for (const re of [YEARS_THEN_EXPERIENCE, EXPERIENCE_THEN_YEARS]) {
    for (const m of text.matchAll(re)) found.push(toNumber(m[1]!));
  }
  return found.length ? Math.max(...found) : null;
};

export interface FresherOptions {
  maxYears?: number;
  /** The source only lists internships / entry-level roles (e.g. a level-filtered API). */
  sourceIsEntryLevel?: boolean;
}

/**
 * Keep a job only with a positive entry-level signal (title, stated experience, or an
 * entry-level-only source) and never when it asks for more than `maxYears` or has a
 * senior title. Ambiguous postings are dropped: precision over volume.
 */
export const isFresherJob = (
  job: { title: string; description: string | null },
  { maxYears = FRESHER_MAX_YEARS, sourceIsEntryLevel = false }: FresherOptions = {},
): boolean => {
  const years = requiredYears(`${job.title}\n${job.description ?? ''}`);
  if (years !== null && years > maxYears) return false;

  const entryTitle = ENTRY_TITLE.test(job.title);
  if (SENIOR_TITLE.test(job.title) && !entryTitle) return false;

  return entryTitle || sourceIsEntryLevel || years !== null;
};
