import { describe, expect, it } from 'vitest';
import { buildSkillSelectorOptions } from '../skill-selector-options';

describe('buildSkillSelectorOptions', () => {
  it('merges listings into options keyed by URL, keeping the first position and the last name', () => {
    expect(
      buildSkillSelectorOptions([{ url: 'skills/b/a', name: 'A' }], undefined, [
        { url: 'skills/b/c', name: 'C' },
        { url: 'skills/b/a', name: 'A (public)' },
      ]),
    ).toEqual([
      { id: 'skills/b/a', name: 'A (public)' },
      { id: 'skills/b/c', name: 'C' },
    ]);
  });

  it('returns an empty list for no skills', () => {
    expect(buildSkillSelectorOptions([], undefined)).toEqual([]);
  });
});
