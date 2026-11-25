import type { Resume } from '@jobpilot/db';
import { RESUME_FILE_TYPES, type PaginatedResult, type ResumeMimeType } from '@jobpilot/types';
import type { ListResumesQuery, UploadResumeInput } from '@jobpilot/types/schemas';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { enqueueResumeParse } from '../queue/queues';
import { storage } from '../storage/s3';
import { userService } from '../users/user.service';

import { resumeRepository } from './resume.repository';

const resolveUserId = async (clerkUserId: string): Promise<string> => {
  const user = await userService.getByClerkId(clerkUserId);
  return user.id;
};

const extensionFor = (mimeType: string | null): string =>
  RESUME_FILE_TYPES[mimeType as ResumeMimeType] ?? 'pdf';

const sourceKey = (userId: string, resumeId: string, mimeType: string): string =>
  `resumes/${userId}/${resumeId}/source.${extensionFor(mimeType)}`;

export interface UploadTicket {
  resume: Resume;
  upload: { url: string; key: string; method: 'PUT'; headers: Record<string, string> };
}

export const resumeService = {
  /** Create a resume row and hand back a presigned PUT for the PDF. */
  async createUpload(clerkUserId: string, input: UploadResumeInput): Promise<UploadTicket> {
    if (input.sizeBytes > env.RESUME_MAX_BYTES) {
      throw new BadRequestError('Resume exceeds the maximum allowed size');
    }
    const userId = await resolveUserId(clerkUserId);

    const created = await resumeRepository.create({
      userId,
      title: input.title,
      mimeType: input.contentType,
      sizeBytes: input.sizeBytes,
      fileStatus: 'PENDING',
    });

    const key = sourceKey(userId, created.id, input.contentType);
    const resume = await resumeRepository.update(created.id, { fileKey: key });
    const url = await storage.presignUpload(key, input.contentType);

    return {
      resume,
      upload: { url, key, method: 'PUT', headers: { 'content-type': input.contentType } },
    };
  },

  /** Mark the upload complete and queue text extraction. */
  async ingest(clerkUserId: string, id: string): Promise<Resume> {
    const userId = await resolveUserId(clerkUserId);
    const resume = await resumeRepository.findById(userId, id);
    if (!resume) throw new NotFoundError('Resume');
    if (!resume.fileKey) throw new BadRequestError('Resume has no uploaded file');

    // The presigned PUT can't enforce size, so verify what actually landed in storage.
    const stored = await storage.headObject(resume.fileKey);
    if (!stored) throw new BadRequestError('Upload not found in storage — please upload again');
    if (stored.size > env.RESUME_MAX_BYTES) {
      await storage.deleteObject(resume.fileKey).catch((err: unknown) => {
        logger.warn({ resumeId: id, err: String(err) }, 'oversized resume delete failed');
      });
      await resumeRepository.update(id, {
        fileStatus: 'FAILED',
        parseError: 'File exceeds the maximum allowed size',
      });
      throw new BadRequestError('Resume exceeds the maximum allowed size');
    }

    const updated = await resumeRepository.update(id, { fileStatus: 'UPLOADED', parseError: null });
    await enqueueResumeParse({ resumeId: id });
    return updated;
  },

  async list(clerkUserId: string, query: ListResumesQuery): Promise<PaginatedResult<Resume>> {
    const userId = await resolveUserId(clerkUserId);
    return resumeRepository.list(userId, query);
  },

  async get(clerkUserId: string, id: string) {
    const userId = await resolveUserId(clerkUserId);
    const resume = await resumeRepository.detail(userId, id);
    if (!resume) throw new NotFoundError('Resume');
    return resume;
  },

  async downloadUrl(clerkUserId: string, id: string): Promise<string> {
    const userId = await resolveUserId(clerkUserId);
    const resume = await resumeRepository.findById(userId, id);
    if (!resume?.fileKey) throw new NotFoundError('Resume file');
    return storage.presignDownload(
      resume.fileKey,
      `${resume.title}.${extensionFor(resume.mimeType)}`,
    );
  },

  async remove(clerkUserId: string, id: string): Promise<void> {
    const userId = await resolveUserId(clerkUserId);
    const resume = await resumeRepository.findById(userId, id);
    if (!resume) throw new NotFoundError('Resume');

    if (storage.isConfigured()) {
      const keys = await resumeRepository.fileKeys(id);
      await Promise.allSettled(keys.map((k) => storage.deleteObject(k))).then((results) => {
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed) logger.warn({ resumeId: id, failed }, 'some resume objects failed to delete');
      });
    }
    await resumeRepository.delete(userId, id);
  },
};
