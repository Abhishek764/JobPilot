import { describe, expect, it } from 'vitest';

import { ListJobsQuerySchema, UploadResumeSchema } from './index';

describe('student API schemas', () => {
  it('normalizes comma-separated job skills', () => {
    expect(ListJobsQuerySchema.parse({ skills: 'node.js, AWS', page: '1' }).skills).toEqual([
      'node.js',
      'AWS',
    ]);
  });

  it('accepts PDF, DOCX and TXT upload tickets only', () => {
    const ticket = (filename: string, contentType: string) =>
      UploadResumeSchema.safeParse({ title: 'Resume', filename, contentType, sizeBytes: 1000 })
        .success;
    expect(ticket('resume.pdf', 'application/pdf')).toBe(true);
    expect(
      ticket(
        'resume.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(true);
    expect(ticket('resume.txt', 'text/plain')).toBe(true);
    expect(ticket('resume.doc', 'application/msword')).toBe(false);
    expect(ticket('resume.png', 'image/png')).toBe(false);
  });
});
