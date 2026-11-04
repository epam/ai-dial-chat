/** Progress of one sign-in interrupt row. */
export enum SigninInterruptRowStatus {
  /** Awaiting the user's login or decline. */
  Idle = 'idle',
  /** A login or decline for this row is in flight. */
  Processing = 'processing',
}

/** Recoverable failure shown on a sign-in interrupt row; the event stays pending. */
export enum SigninInterruptRowError {
  /** The login failed, or reporting its success to DIAL Core failed. */
  LoginFailed = 'login-failed',
  /** The browser blocked the OAuth popup. */
  PopupBlocked = 'popup-blocked',
  /** Reporting the decline to DIAL Core failed. */
  DeclineFailed = 'decline-failed',
  /** A DIAL administrator must approve the application's access first. */
  AdminConsentRequired = 'admin-consent-required',
  /** Offline access is not configured for the user's account. */
  OfflineUnavailable = 'offline-unavailable',
}

/** Kind of status a sign-in interrupt announces after resolving an event. */
export enum SigninInterruptAnnouncementKind {
  /** A login succeeded and its event was reported as `success`. */
  LoginSucceeded = 'login-succeeded',
  /** An event was declined and reported as `denied`. */
  Declined = 'declined',
}
