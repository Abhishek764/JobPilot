import { describe, expect, it } from 'vitest';

import { isFresherJob, requiredYears } from './fresher';

const job = (title: string, description: string | null = null) => ({ title, description });

describe('requiredYears', () => {
  it.each([
    ['We need 3+ years of experience with React.', 3],
    ['Requires 2-4 years experience in data analysis.', 2],
    ['At least 5 years of professional experience.', 5],
    ['0-1 years of experience is welcome.', 0],
    ['Experience: 1.5 years in Python', 1.5],
    ['mindestens 3 Jahre Berufserfahrung', 3],
    ['Minimum of 4 yrs experience', 4],
  ])('reads the minimum from %j', (text, years) => {
    expect(requiredYears(text)).toBe(years);
  });

  it('ignores numbers that are not experience requirements', () => {
    expect(requiredYears('Founded 10 years ago, 200 employees, 25 days of holiday.')).toBeNull();
    expect(requiredYears(null)).toBeNull();
  });
});

describe('isFresherJob', () => {
  it.each([
    'Software Engineering Intern',
    'Junior Python Developer',
    'Graduate Data Analyst',
    'Trainee Frontend Developer',
    'Fresher - Java Developer',
    'Werkstudent Softwareentwicklung (m/w/d)',
    'Entry Level QA Engineer',
  ])('keeps entry-level title %j', (title) => {
    expect(isFresherJob(job(title))).toBe(true);
  });

  it.each([
    'Senior Software Engineer',
    'Sr. Backend Developer',
    'Lead Data Scientist',
    'Engineering Manager',
    'Director of Engineering, KYX',
    'Principal Architect',
    'Head of Communications - EMEA',
  ])('drops senior title %j', (title) => {
    expect(isFresherJob(job(title))).toBe(false);
  });

  it('drops an entry-sounding title whose description requires more than 1.5 years', () => {
    expect(isFresherJob(job('Junior Developer', 'You bring 3+ years of experience.'))).toBe(false);
  });

  it('keeps a plain title whose description asks for 1.5 years or less', () => {
    expect(isFresherJob(job('Software Engineer', '0-1 years of experience required.'))).toBe(true);
    expect(isFresherJob(job('Data Analyst', 'Up to 1 year of experience.'))).toBe(true);
  });

  it('drops ambiguous jobs with no entry-level signal', () => {
    expect(isFresherJob(job('Software Engineer', 'Build APIs in Go.'))).toBe(false);
  });

  it('trusts a source that only lists entry-level roles, unless the text contradicts it', () => {
    expect(isFresherJob(job('Software Engineer'), { sourceIsEntryLevel: true })).toBe(true);
    expect(
      isFresherJob(job('Software Engineer', 'Requires 4+ years of experience.'), {
        sourceIsEntryLevel: true,
      }),
    ).toBe(false);
    expect(isFresherJob(job('Senior Software Engineer'), { sourceIsEntryLevel: true })).toBe(false);
  });

  it('respects a custom experience cap', () => {
    expect(isFresherJob(job('Analyst', '2 years of experience'), { maxYears: 2 })).toBe(true);
  });
});
