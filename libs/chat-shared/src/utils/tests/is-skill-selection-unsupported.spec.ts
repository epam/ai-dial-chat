import { describe, expect, it } from 'vitest';
import { isSkillSelectionUnsupported } from '../is-skill-selection-unsupported';

describe('isSkillSelectionUnsupported', () => {
  it.each([true, false, undefined])(
    'requires explicit support only with a reference: %s',
    (support) => {
      expect(isSkillSelectionUnsupported('skills/public/report', support)).toBe(
        support !== true,
      );
      for (const empty of [undefined, null, '', ' '])
        expect(isSkillSelectionUnsupported(empty, support)).toBe(false);
    },
  );
});
