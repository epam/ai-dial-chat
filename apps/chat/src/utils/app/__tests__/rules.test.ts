import { describe, expect, it } from 'vitest';

import { getFilterLabel } from '@/src/utils/app/rules';

import { PublicationFunctions } from '@/src/types/publication';

describe('utils/app/rules.ts', () => {
  it('returns "Contains" for CONTAIN function', () => {
    expect(getFilterLabel(PublicationFunctions.Contain)).toBe('Contains');
  });

  it('returns "Equals" for EQUAL function', () => {
    expect(getFilterLabel(PublicationFunctions.Equal)).toBe('Equals');
  });

  it('returns "Regex" for REGEX function', () => {
    expect(getFilterLabel(PublicationFunctions.Regex)).toBe('Regex');
  });

  it('returns input value for unknown filter function', () => {
    const unknownFilter = 'SOME_UNKNOWN_FILTER';
    expect(getFilterLabel(unknownFilter)).toBe(unknownFilter);
  });
});
