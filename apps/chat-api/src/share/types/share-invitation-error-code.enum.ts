export enum ShareInvitationErrorCode {
  /** DIAL Core has no live invitation for the id — it expired, was revoked, or never existed. */
  NotFound = 'shareInvitationNotFound',
  /** The shared resource has already been accepted by its maximum number of users. */
  AcceptedUsersLimitReached = 'shareInvitationAcceptedUsersLimitReached',
}
