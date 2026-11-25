import type { Resume } from '@jobpilot/db';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { aiService } from '../ai/ai.service';
import { storage } from '../storage/s3';

import { resumeRepository } from './resume.repository';

const BLANK_LINES = /\n{3,}/g;
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Pull plain text out of an uploaded file; null means the type isn't supported. */
const extractText = async (mimeType: string | null, buffer: Buffer): Promise<string | null> => {
  switch (mimeType) {
    case 'application/pdf':
      return (await pdfParse(buffer)).text;
    case DOCX:
      return (await mammoth.extractRawText({ buffer })).value;
    case 'text/plain':
      return buffer.toString('utf8');
    default:
      return null;
  }
};

/**
 * Queue worker body: download the file, extract text, and enrich with parsed
 * skills/years via the AI service. Idempotent — a PARSED resume short-circuits.
 */
export const processResumeParse = async (
  resumeId: string,
  opts: { finalAttempt?: boolean } = {},
): Promise<Resume> => {
  const finalAttempt = opts.finalAttempt ?? true;
  const resume = await resumeRepository.findRaw(resumeId);
  if (!resume) throw new Error('Resume not found');
  if (resume.fileStatus === 'PARSED') return resume;
  if (!resume.fileKey) return resumeRepository.setParseFailed(resumeId, 'No uploaded file');

  // The presigned PUT stays valid after ingest, so re-check size before loading into memory.
  const stored = await storage.headObject(resume.fileKey);
  if (!stored) return resumeRepository.setParseFailed(resumeId, 'Uploaded file not found');
  if (stored.size > env.RESUME_MAX_BYTES) {
    return resumeRepository.setParseFailed(resumeId, 'File exceeds the maximum allowed size');
  }

  await resumeRepository.update(resumeId, { fileStatus: 'PARSING', parseError: null });

  // Storage/network errors are transient: let the queue retry, fail only on the last attempt.
  let buffer: Buffer;
  try {
    buffer = await storage.getObject(resume.fileKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ resumeId, err: message, finalAttempt }, 'resume download failed');
    if (finalAttempt) {
      await resumeRepository.setParseFailed(resumeId, `Could not download file: ${message}`);
    } else {
      await resumeRepository.update(resumeId, { fileStatus: 'UPLOADED', parseError: message });
    }
    throw err;
  }

  // Extraction errors are permanent for this file: fail without retrying.
  let text: string;
  try {
    const raw = await extractText(resume.mimeType, buffer);
    if (raw === null) return resumeRepository.setParseFailed(resumeId, 'Unsupported file type');
    // Drop NUL bytes and collapse runs of blank lines; preserve normal spacing.
    text = raw.replaceAll('\0', '').replace(BLANK_LINES, '\n\n').trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ resumeId, err: message }, 'resume text extraction failed');
    return resumeRepository.setParseFailed(resumeId, `Could not read file: ${message}`);
  }

  if (text.length < 30) {
    return resumeRepository.setParseFailed(resumeId, 'No extractable text found in file');
  }

  let parsedSkills: string[] = [];
  let parsedYears: number | null = null;
  try {
    const extracted = await aiService.extractResumeSkills(text);
    parsedSkills = extracted.skills ?? [];
    parsedYears = Number.isFinite(extracted.yearsExperience) ? extracted.yearsExperience : null;
  } catch (err) {
    // Non-fatal: keep the text even if enrichment fails.
    logger.warn({ resumeId, err: String(err) }, 'skill extraction failed');
  }

  return resumeRepository.setParsed(resumeId, { content: text, parsedSkills, parsedYears });
};
