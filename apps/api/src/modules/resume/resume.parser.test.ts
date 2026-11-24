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
vi.mock('../ai/ai.service', () => ({ aiService: { extractResumeSkills: vi.fn() } }));
vi.mock('pdf-parse/lib/pdf-parse.js', () => ({ default: vi.fn() }));

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
});
