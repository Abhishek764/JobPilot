export const ROLES = ['USER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const EXPERIENCE_LEVELS = [
  'INTERN',
  'JUNIOR',
  'MID',
  'SENIOR',
  'STAFF',
  'PRINCIPAL',
  'EXECUTIVE',
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  INTERN: 'Intern',
  JUNIOR: 'Junior (0–2 yrs)',
  MID: 'Mid (2–5 yrs)',
  SENIOR: 'Senior (5–8 yrs)',
  STAFF: 'Staff (8–12 yrs)',
  PRINCIPAL: 'Principal (12+ yrs)',
  EXECUTIVE: 'Executive',
};

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  role: Role;
  skills: string[];
  preferredRoles: string[];
  experienceLevel: ExperienceLevel | null;
  resumeUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  location: string | null;
  onboardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUser = Omit<User, 'clerkId'>;
