import { SchedulerServiceConsentStatus } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { isSchedulerConsentMissing } from '../scheduler-consent';

describe('isSchedulerConsentMissing', () => {
  it('reports a missing consent only for an explicit signed-out status', () => {
    expect(
      isSchedulerConsentMissing(SchedulerServiceConsentStatus.SignedOut),
    ).toBe(true);
  });

  it.each([
    ['a signed-in consent', SchedulerServiceConsentStatus.SignedIn],
    ['a failed consent read (unknown)', SchedulerServiceConsentStatus.Unknown],
    ['an unresolved consent check', undefined],
  ])('keeps access for %s', (_name, status) => {
    expect(isSchedulerConsentMissing(status)).toBe(false);
  });
});
