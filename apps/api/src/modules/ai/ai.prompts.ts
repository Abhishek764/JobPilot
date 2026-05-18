import type { MatchTrack } from '@jobpilot/db';

export const TRACKS = ['BACKEND', 'FRONTEND', 'FULLSTACK', 'DEVOPS'] as const;
export type Track = (typeof TRACKS)[number];

interface TrackProfile {
  label: string;
  coreCompetencies: string[];
  weights: {
    coreSkills: number;
    experience: number;
    projects: number;
    jobAlignment: number;
  };
}

export const TRACK_PROFILES: Record<Track, TrackProfile> = {
  BACKEND: {
    label: 'Backend Engineer',
    coreCompetencies: [
      'API design (REST/GraphQL/gRPC)',
      'Relational + NoSQL databases, indexing, query tuning',
      'Distributed systems, queues, event-driven patterns',
      'Caching, observability, performance under load',
      'Type-safe server languages (Node/Go/Java/Python/Rust)',
      'Auth, security, rate limiting',
    ],
    weights: { coreSkills: 0.35, experience: 0.25, projects: 0.2, jobAlignment: 0.2 },
  },
  FRONTEND: {
    label: 'Frontend Engineer',
    coreCompetencies: [
      'Modern frameworks (React/Vue/Svelte/Angular)',
      'TypeScript, state management, component architecture',
      'Performance, accessibility (WCAG), Core Web Vitals',
      'CSS / design systems, responsive UI, animations',
      'Testing (RTL/Playwright/Cypress), build tooling',
      'API integration, SSR/SSG, hydration',
    ],
    weights: { coreSkills: 0.35, experience: 0.2, projects: 0.25, jobAlignment: 0.2 },
  },
  FULLSTACK: {
    label: 'Full-stack Engineer',
    coreCompetencies: [
      'End-to-end feature ownership across UI + API + DB',
      'TypeScript across stack, monorepos, shared types',
      'Authn/Authz, sessions, security across layers',
      'Database modeling and migrations',
      'Deployments, CI, observability',
      'Tradeoff thinking between client and server',
    ],
    weights: { coreSkills: 0.3, experience: 0.25, projects: 0.25, jobAlignment: 0.2 },
  },
  DEVOPS: {
    label: 'DevOps / Platform Engineer',
    coreCompetencies: [
      'Containers (Docker), orchestration (Kubernetes)',
      'IaC (Terraform/Pulumi/CDK), cloud (AWS/GCP/Azure)',
      'CI/CD pipelines, GitOps, release engineering',
      'Observability (metrics/logs/traces), SLO/SLI',
      'Networking, security, secrets management',
      'Linux, scripting, automation, reliability engineering',
    ],
    weights: { coreSkills: 0.4, experience: 0.25, projects: 0.15, jobAlignment: 0.2 },
  },
};

export const toMatchTrack = (t: Track): MatchTrack => t;

export interface AnalysisInput {
  track: Track;
  userSkills: string[];
  resumeContent: string;
  projectExperience?: string;
  jobDescription: string;
}

export const SYSTEM_PROMPT = `You are a senior technical recruiter and staff-level engineer who has hired hundreds of software engineers.
You give honest, calibrated assessments. You do not flatter or inflate scores.
You return ONLY valid JSON conforming exactly to the schema provided by the caller — no prose, no markdown fences.`;

export const buildUserPrompt = (input: AnalysisInput): string => {
  const profile = TRACK_PROFILES[input.track];
  return [
    `Target role track: ${profile.label} (${input.track}).`,
    `Core competencies for this track:`,
    ...profile.coreCompetencies.map((c) => `  - ${c}`),
    '',
    `Candidate declared skills: ${input.userSkills.length ? input.userSkills.join(', ') : '(none provided)'}`,
    '',
    `=== RESUME ===`,
    input.resumeContent,
    '',
    input.projectExperience
      ? `=== PROJECT EXPERIENCE (additional detail) ===\n${input.projectExperience}\n`
      : '',
    `=== JOB DESCRIPTION ===`,
    input.jobDescription,
    '',
    `Evaluate the candidate against THIS specific job, calibrated to the ${input.track} track.`,
    'Be specific: cite tools/frameworks/years/scope from the resume.',
    'Do not invent skills that are not in the resume or projects.',
    'Interview readiness is "how likely this candidate clears a typical loop for this role" — 0 (unlikely) to 100 (very strong).',
  ].join('\n');
};

import { SchemaType } from '@google/generative-ai';

/**
 * Gemini structured-output schema. Uses SchemaType enum so the SDK serializes
 * to the Gemini API's expected uppercase type strings.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    compatibility: { type: SchemaType.INTEGER },
    readiness: { type: SchemaType.INTEGER },
    summary: { type: SchemaType.STRING },
    breakdown: {
      type: SchemaType.OBJECT,
      properties: {
        coreSkills: { type: SchemaType.INTEGER },
        experience: { type: SchemaType.INTEGER },
        projects: { type: SchemaType.INTEGER },
        jobAlignment: { type: SchemaType.INTEGER },
      },
      required: ['coreSkills', 'experience', 'projects', 'jobAlignment'],
    },
    strengths: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    missingSkills: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    suggestions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: [
    'compatibility',
    'readiness',
    'summary',
    'breakdown',
    'strengths',
    'missingSkills',
    'suggestions',
  ],
};

export interface MatchAnalysisResult {
  compatibility: number;
  readiness: number;
  summary: string;
  breakdown: {
    coreSkills: number;
    experience: number;
    projects: number;
    jobAlignment: number;
  };
  strengths: string[];
  missingSkills: string[];
  suggestions: string[];
}
