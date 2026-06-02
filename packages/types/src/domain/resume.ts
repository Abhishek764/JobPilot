export const PROCESSING_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const RESUME_FILE_STATUSES = ['PENDING', 'UPLOADED', 'PARSING', 'PARSED', 'FAILED'] as const;
export type ResumeFileStatus = (typeof RESUME_FILE_STATUSES)[number];

export const COVER_LETTER_TONES = ['PROFESSIONAL', 'ENTHUSIASTIC', 'CONCISE', 'STORYTELLING'] as const;
export type CoverLetterTone = (typeof COVER_LETTER_TONES)[number];

export interface Resume {
  id: string;
  userId: string;
  title: string;
  content: string;
  fileUrl: string | null;
  fileKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  fileStatus: ResumeFileStatus;
  parseError: string | null;
  atsScore: number | null;
  parsedSkills: string[];
  parsedYears: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One actionable rewrite suggestion produced by the analysis. */
export interface ResumeSuggestion {
  section: string;
  issue: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

/** A single ATS compatibility finding. */
export interface AtsIssue {
  check: string;
  passed: boolean;
  detail: string;
}

export interface ResumeAnalysis {
  id: string;
  resumeId: string;
  userId: string;
  jobId: string | null;
  status: ProcessingStatus;
  atsScore: number | null;
  keywordScore: number | null;
  overallScore: number | null;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: ResumeSuggestion[] | null;
  atsIssues: AtsIssue[] | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  userId: string;
  analysisId: string | null;
  label: string;
  status: ProcessingStatus;
  markdown: string | null;
  fileKey: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoverLetter {
  id: string;
  resumeId: string;
  userId: string;
  jobId: string | null;
  tone: CoverLetterTone;
  status: ProcessingStatus;
  content: string | null;
  fileKey: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Structured optimized resume the model returns; rendered to Markdown + DOCX. */
export interface StructuredResume {
  name: string;
  headline: string;
  contact: { email?: string; phone?: string; location?: string; links: string[] };
  summary: string;
  skills: string[];
  experience: {
    company: string;
    role: string;
    period: string;
    bullets: string[];
  }[];
  education: { institution: string; credential: string; period: string }[];
  projects: { name: string; description: string; bullets: string[] }[];
}
