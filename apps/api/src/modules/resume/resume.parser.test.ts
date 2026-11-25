import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ headObject: vi.fn(), getObject: vi.fn() }));
const repo = vi.hoisted(() => ({
  findRaw: vi.fn(),
  update: vi.fn(),
  setParseFailed: vi.fn(),
  setParsed: vi.fn(),
}));

vi.mock('../../config/env', () => ({ env: { RESUME_MAX_BYTES: 1024 } }));
vi.mock('../../config/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('../storage/s3', () => ({ storage }));
vi.mock('./resume.repository', () => ({ resumeRepository: repo }));
const ai = vi.hoisted(() => ({ extractResumeSkills: vi.fn() }));
const pdfParse = vi.hoisted(() => vi.fn());
const mammoth = vi.hoisted(() => ({ extractRawText: vi.fn() }));
vi.mock('../ai/ai.service', () => ({ aiService: ai }));
vi.mock('pdf-parse/lib/pdf-parse.js', () => ({ default: pdfParse }));
vi.mock('mammoth', () => ({ default: mammoth }));

import { processResumeParse } from './resume.parser';

describe('processResumeParse', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.findRaw.mockResolvedValue({ id: 'r1', fileKey: 'k', fileStatus: 'UPLOADED' });
  });

  it('refuses to download an object larger than the limit', async () => {
    storage.headObject.mockResolvedValue({ size: 4096 });
    await processResumeParse('r1');
    expect(storage.getObject).not.toHaveBeenCalled();
    expect(repo.setParseFailed).toHaveBeenCalledWith(
      'r1',
      expect.stringMatching(/maximum allowed size/),
    );
  });

  const TEXT = 'Jane Student — Python, SQL, two internships building data pipelines.';
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const ready = (mimeType: string) => {
    repo.findRaw.mockResolvedValue({ id: 'r1', fileKey: 'k', fileStatus: 'UPLOADED', mimeType });
    storage.headObject.mockResolvedValue({ size: 100 });
    storage.getObject.mockResolvedValue(Buffer.from(TEXT));
    ai.extractResumeSkills.mockResolvedValue({ skills: ['python'], yearsExperience: 1 });
  };

  it('extracts DOCX text with mammoth', async () => {
    ready(DOCX);
    mammoth.extractRawText.mockResolvedValue({ value: TEXT });
    await processResumeParse('r1');
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: Buffer.from(TEXT) });
    expect(repo.setParsed).toHaveBeenCalledWith('r1', expect.objectContaining({ content: TEXT }));
  });

  it('reads TXT as UTF-8', async () => {
    ready('text/plain');
    await processResumeParse('r1');
    expect(pdfParse).not.toHaveBeenCalled();
    expect(repo.setParsed).toHaveBeenCalledWith('r1', expect.objectContaining({ content: TEXT }));
  });

  it('fails an unsupported file type', async () => {
    ready('image/png');
    await processResumeParse('r1');
    expect(repo.setParseFailed).toHaveBeenCalledWith('r1', 'Unsupported file type');
  });

  it('fails readably when a DOCX has no extractable text', async () => {
    ready(DOCX);
    mammoth.extractRawText.mockResolvedValue({ value: '  ' });
    await processResumeParse('r1');
    expect(repo.setParseFailed).toHaveBeenCalledWith('r1', 'No extractable text found in file');
  });

  it('retries storage errors and fails only on the final attempt', async () => {
    ready('application/pdf');
    storage.getObject.mockRejectedValue(new Error('ECONNRESET'));
    await expect(processResumeParse('r1', { finalAttempt: false })).rejects.toThrow('ECONNRESET');
    expect(repo.setParseFailed).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenLastCalledWith('r1', {
      fileStatus: 'UPLOADED',
      parseError: 'ECONNRESET',
    });
    await expect(processResumeParse('r1', { finalAttempt: true })).rejects.toThrow('ECONNRESET');
    expect(repo.setParseFailed).toHaveBeenCalledWith('r1', 'Could not download file: ECONNRESET');
  });
});
