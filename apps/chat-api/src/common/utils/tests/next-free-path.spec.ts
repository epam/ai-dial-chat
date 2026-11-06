import { describe, expect, it } from 'vitest';
import { MAX_CREATE_PATH_ATTEMPTS, buildNextFreeLeaf } from '../next-free-path';

describe('buildNextFreeLeaf', () => {
  it('keeps the plain name for the first attempt', () => {
    expect(buildNextFreeLeaf('Planner', '1.1.1', 1)).toBe('Planner__1.1.1');
  });

  it('suffixes the name from the second attempt on', () => {
    expect(buildNextFreeLeaf('Planner', '1.1.1', 2)).toBe('Planner-2__1.1.1');
    expect(buildNextFreeLeaf('Planner', '1.1.1', 20)).toBe('Planner-20__1.1.1');
  });

  it('shares one candidate limit between applications and toolsets', () => {
    expect(MAX_CREATE_PATH_ATTEMPTS).toBe(20);
  });
});
