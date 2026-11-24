import { describe, expect, it } from 'vitest';

import { SYSTEM_PROMPT } from './ai.prompts';

describe('match system prompt', () => {
  it('forbids inferring or using protected characteristics (spec §7)', () => {
    const p = SYSTEM_PROMPT.toLowerCase();
    expect(p).toContain('protected characteristics');
    for (const term of ['gender', 'race', 'religion', 'disability', 'age'])
      expect(p).toContain(term);
  });
});
