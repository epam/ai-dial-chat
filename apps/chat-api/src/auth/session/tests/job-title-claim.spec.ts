import { describe, expect, it } from 'vitest';
import { buildJobTitleHeaders } from '../../../common/utils/header-value';
import { getJobTitleClaim, JOB_TITLE_CLAIM } from '../session.types';

describe('getJobTitleClaim', () => {
  it('returns a non-empty string job title and forwards it as X-JOB-TITLE', () => {
    const jobTitle = getJobTitleClaim({ [JOB_TITLE_CLAIM]: 'Lead Engineer' });

    expect(jobTitle).toBe('Lead Engineer');
    expect(buildJobTitleHeaders(jobTitle)).toEqual({
      'X-JOB-TITLE': 'Lead Engineer',
    });
  });

  it.each(['', '   ', 42, null, ['Engineer']])(
    'returns undefined and forwards no header for an unusable value (%j)',
    (value) => {
      const jobTitle = getJobTitleClaim({ [JOB_TITLE_CLAIM]: value });

      expect(jobTitle).toBeUndefined();
      expect(buildJobTitleHeaders(jobTitle)).toEqual({});
    },
  );

  it('returns undefined when the claim or the claims record is missing', () => {
    expect(getJobTitleClaim({ sub: 'user-1' })).toBeUndefined();
    expect(getJobTitleClaim(undefined)).toBeUndefined();
  });
});
