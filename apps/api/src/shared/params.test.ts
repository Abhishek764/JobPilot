import { describe, expect, it } from 'vitest';

import { BadRequestError } from './errors';
import { param } from './params';

describe('param', () => {
  it('returns a present route param', () => {
    expect(param({ params: { id: 'abc' } }, 'id')).toBe('abc');
  });

  it('throws BadRequestError when the param is missing or empty', () => {
    expect(() => param({ params: {} }, 'id')).toThrow(BadRequestError);
    expect(() => param({ params: { id: '' } }, 'id')).toThrow(BadRequestError);
  });
});
