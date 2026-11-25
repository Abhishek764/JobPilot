import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { AppError } from '../../shared/errors';

interface Row {
  id: string;
  userId: string;
  title: string;
  fileKey: string | null;
  fileStatus: string;
  mimeType?: string;
  sizeBytes?: number;
  parseError?: string | null;
}

const store = vi.hoisted(() => ({ rows: new Map<string, Row>() }));
const storage = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  presignUpload: vi.fn(async (key: string) => `https://s3.test/put/${key}`),
  presignDownload: vi.fn(async (key: string) => `https://s3.test/get/${key}`),
  deleteObject: vi.fn(async () => undefined),
  headObject: vi.fn(async (): Promise<{ size: number } | null> => ({ size: 2048 })),
}));
const queue = vi.hoisted(() => ({ enqueueResumeParse: vi.fn(async () => undefined) }));

vi.mock('../../config/env', () => ({ env: { RESUME_MAX_BYTES: 10 * 1024 * 1024 } }));
vi.mock('../../config/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../storage/s3', () => ({ storage }));
vi.mock('../queue/queues', () => queue);
vi.mock('../users/user.service', () => ({
  userService: {
    getByClerkId: vi.fn(async (clerkId: string) => ({
      id: clerkId === 'clerk_a' ? 'user_a' : 'user_b',
    })),
  },
}));
// Tests authenticate with an `x-test-user` header instead of a Clerk session.
vi.mock('../../middleware/auth', () => ({
  requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
  attachUserId: (req: Request, res: Response, next: NextFunction) => {
    const user = req.header('x-test-user');
    if (!user) {
      res.status(401).json({ success: false });
      return;
    }
    (req as Request & { clerkUserId: string }).clerkUserId = user;
    next();
  },
}));
vi.mock('./resume.repository', () => {
  const owned = (userId: string, id: string) => {
    const row = store.rows.get(id);
    return row && row.userId === userId ? row : null;
  };
  return {
    resumeRepository: {
      create: vi.fn(async (data: Omit<Row, 'id' | 'fileKey'>) => {
        const row: Row = { id: 'resume_new', fileKey: null, ...data };
        store.rows.set(row.id, row);
        return row;
      }),
      update: vi.fn(async (id: string, data: Partial<Row>) => {
        const row = { ...store.rows.get(id)!, ...data };
        store.rows.set(id, row);
        return row;
      }),
      findById: vi.fn(async (userId: string, id: string) => owned(userId, id)),
      detail: vi.fn(async (userId: string, id: string) => {
        const row = owned(userId, id);
        return row ? { ...row, analyses: [], versions: [], coverLetters: [] } : null;
      }),
      list: vi.fn(async (userId: string) => {
        const items = [...store.rows.values()].filter((r) => r.userId === userId);
        return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 };
      }),
      delete: vi.fn(async (userId: string, id: string) => {
        const row = owned(userId, id);
        if (row) store.rows.delete(id);
        return { count: row ? 1 : 0 };
      }),
      fileKeys: vi.fn(async (id: string) => [store.rows.get(id)?.fileKey].filter(Boolean)),
    },
  };
});

import { resumeRouter } from './resume.routes';

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) return void res.status(422).json({ success: false });
  if (err instanceof AppError) {
    return void res.status(err.statusCode).json({ success: false, error: { code: err.code } });
  }
  res.status(500).json({ success: false, error: String(err) });
};

let server: Server;
let base: string;

const call = (method: string, path: string, user: string | null, body?: unknown) =>
  fetch(`${base}/resumes${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(user ? { 'x-test-user': user } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/resumes', resumeRouter);
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  vi.clearAllMocks();
  store.rows.clear();
  store.rows.set('resume_a', {
    id: 'resume_a',
    userId: 'user_a',
    title: 'Alice CV',
    fileKey: 'resumes/user_a/resume_a/source.pdf',
    fileStatus: 'PARSED',
  });
});

describe('resume routes', () => {
  it('rejects unauthenticated requests', async () => {
    expect((await call('GET', '', null)).status).toBe(401);
  });

  it('creates a PENDING resume and returns a presigned PUT ticket', async () => {
    const res = await call('POST', '/upload-ticket', 'clerk_a', {
      title: 'My CV',
      filename: 'cv.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
    });
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.resume).toMatchObject({
      id: 'resume_new',
      userId: 'user_a',
      fileStatus: 'PENDING',
    });
    expect(data.upload).toMatchObject({
      method: 'PUT',
      url: 'https://s3.test/put/resumes/user_a/resume_new/source.pdf',
      headers: { 'content-type': 'application/pdf' },
    });
  });

  it('rejects non-PDF upload tickets', async () => {
    const res = await call('POST', '/upload-ticket', 'clerk_a', {
      title: 'My CV',
      filename: 'cv.docx',
      contentType: 'application/msword',
      sizeBytes: 2048,
    });
    expect(res.status).toBe(422);
  });

  it('lists only the caller’s resumes', async () => {
    const res = await call('GET', '', 'clerk_b');
    expect((await res.json()).data.items).toEqual([]);
  });

  it('returns the owner’s resume detail', async () => {
    const res = await call('GET', '/resume_a', 'clerk_a');
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe('resume_a');
  });

  it.each([
    ['GET', '/resume_a'],
    ['POST', '/resume_a/ingest'],
    ['GET', '/resume_a/download'],
    ['DELETE', '/resume_a'],
  ])('%s %s returns 404 for another user’s resume', async (method, path) => {
    const res = await call(method, path, 'clerk_b');
    expect(res.status).toBe(404);
    expect(store.rows.has('resume_a')).toBe(true);
    expect(queue.enqueueResumeParse).not.toHaveBeenCalled();
    expect(storage.presignDownload).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('ingest marks the resume UPLOADED and queues parsing', async () => {
    const res = await call('POST', '/resume_a/ingest', 'clerk_a');
    expect(res.status).toBe(202);
    expect((await res.json()).data.fileStatus).toBe('UPLOADED');
    expect(queue.enqueueResumeParse).toHaveBeenCalledWith({ resumeId: 'resume_a' });
  });

  it('download returns a presigned URL instead of streaming the file', async () => {
    const res = await call('GET', '/resume_a/download', 'clerk_a');
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      url: 'https://s3.test/get/resumes/user_a/resume_a/source.pdf',
    });
  });

  it('delete removes the owner’s resume and its stored objects', async () => {
    const res = await call('DELETE', '/resume_a', 'clerk_a');
    expect(res.status).toBe(204);
    expect(store.rows.has('resume_a')).toBe(false);
    expect(storage.deleteObject).toHaveBeenCalledWith('resumes/user_a/resume_a/source.pdf');
  });

  it('ingest rejects an object larger than the limit and removes it', async () => {
    storage.headObject.mockResolvedValueOnce({ size: 50 * 1024 * 1024 });
    const res = await call('POST', '/resume_a/ingest', 'clerk_a');
    expect(res.status).toBe(400);
    expect(queue.enqueueResumeParse).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledWith('resumes/user_a/resume_a/source.pdf');
    expect(store.rows.get('resume_a')?.fileStatus).toBe('FAILED');
  });

  it('ingest rejects when the upload never reached storage', async () => {
    storage.headObject.mockResolvedValueOnce(null);
    const res = await call('POST', '/resume_a/ingest', 'clerk_a');
    expect(res.status).toBe(400);
    expect(queue.enqueueResumeParse).not.toHaveBeenCalled();
  });
});
