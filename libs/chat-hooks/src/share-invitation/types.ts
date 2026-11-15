/** Why accepting a share invitation failed. */
export enum AcceptShareInvitationErrorKind {
  /** The link has expired or never existed (`ShareInvitationErrorCode.ShareInvitationNotFound`). */
  NotFound = 'not-found',
  /** The item is already shared with the maximum number of users (`ShareInvitationErrorCode.ShareInvitationAcceptedUsersLimitReached`). */
  UsersLimitReached = 'users-limit-reached',
  /** Any other failure, including a refresh or callback that threw after the accept. */
  Failed = 'failed',
}
