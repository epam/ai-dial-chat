/**
 * Consent state of the DIAL_NATIVE scheduler external service, relayed to
 * clients through `GET /api/v1/offline-credentials` (`schedulerServiceConsent`)
 * and consumed by the scheduled-task mutation pre-check. `unknown` covers a
 * failed lookup, an unreported status, and a non-DIAL_NATIVE scheduler
 * service — anything but an explicit `SIGNED_OUT` defers.
 */
export enum SchedulerServiceConsentStatus {
  SignedIn = 'signed_in',
  SignedOut = 'signed_out',
  Unknown = 'unknown',
}
