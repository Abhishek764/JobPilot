import { describe, expect, it } from 'vitest';

import { ListJobsQuerySchema, UploadResumeSchema } from './index';

describe('student API schemas', () => {
  it('normalizes comma-separated job skills', () => {
    expect(ListJobsQuerySchema.parse({ skills: 'node.js, AWS', page: '1' }).skills).toEqual([
      'node.js',
      'AWS',
    ]);
  });

  it('accepts only PDF upload tickets', () => {
    expect(() =>
      UploadResumeSchema.parse({
        title: 'Resume',
        filename: 'resume.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1000,
      }),
    ).not.toThrow();
    expect(() =>
      UploadResumeSchema.parse({
        title: 'Resume',
        filename: 'resume.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 1000,
      }),
    ).toThrow();
  });
});
