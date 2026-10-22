import { SchedulerServiceConsentStatus } from '@epam/ai-dial-chat-api-client';

/**
 * Whether the scheduler service's administrator consent is missing: the
 * user can neither create, edit, nor run tasks until an administrator
 * restores it — logging in cannot help, so consent is evaluated before any
 * login state. `unknown` (a failed consent read) fails open.
 */
export const isSchedulerConsentMissing = (
  schedulerServiceConsent: SchedulerServiceConsentStatus | undefined,
): boolean =>
  schedulerServiceConsent === SchedulerServiceConsentStatus.SignedOut;
