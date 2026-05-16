import { describe, expect, it } from 'vitest';

import { AppError, NotFoundError, ValidationError } from './errors';

describe('errors', () => {
  it('AppError defaults', () => {
    const e = new AppError('boom');
    expect(e.statusCode).toBe(500);
    expect(e.code).toBe('INTERNAL_ERROR');
    expect(e.isOperational).toBe(true);
  });

  it('NotFoundError formats message', () => {
    const e = new NotFoundError('User');
    expect(e.statusCode).toBe(404);
    expect(e.message).toBe('User not found');
  });

  it('ValidationError carries details', () => {
    const e = new ValidationError({ field: 'email' });
    expect(e.statusCode).toBe(422);
    expect(e.details).toEqual({ field: 'email' });
  });
});
