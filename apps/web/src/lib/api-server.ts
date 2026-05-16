import { auth } from '@clerk/nextjs/server';

import { env } from './env';

const API_BASE = `${env.NEXT_PUBLIC_API_URL}/api/v1`;

export class ApiServerError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiServerError';
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export const apiServer = async <T>(path: string, opts: FetchOptions = {}): Promise<T> => {
  const { getToken } = await auth();
  const token = await getToken();
  const headers = new Headers(opts.headers);
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: { code: string; message: string; details?: unknown };
  };

  if (!res.ok || payload.success === false) {
    const err = payload.error ?? { code: 'UNKNOWN', message: 'Request failed' };
    throw new ApiServerError(res.status, err.code, err.message, err.details);
  }

  return payload.data as T;
};
