import { ShareInvitationErrorCode } from '@epam/ai-dial-chat-api-client';
import {
  getAcceptInvitationErrorItemName,
  getApiErrorDetails,
} from '../api-error/api-error';
import type {
  AcceptShareInvitationError,
  AcceptShareInvitationErrorLabels,
} from './models';
import { AcceptShareInvitationErrorKind } from './types';

/** English sentences used when a host passes no {@link AcceptShareInvitationErrorLabels}. */
export const DEFAULT_ACCEPT_SHARE_INVITATION_ERROR_LABELS: AcceptShareInvitationErrorLabels =
  {
    notFound:
      'We are sorry, but the link you are trying to access has expired or does not exist.',
    usersLimitReached: (name) =>
      `"${name}" has already been shared with the maximum specified number of users.`,
    usersLimitReachedUnnamed:
      'This item has already been shared with the maximum specified number of users.',
    acceptError: 'This share link is invalid or has expired.',
  };

/** Returns the kind, user-facing sentence and Request ID for a failed share-invitation accept. */
export const resolveAcceptShareInvitationError = async (
  error: unknown,
  labels: Partial<AcceptShareInvitationErrorLabels> = {},
): Promise<AcceptShareInvitationError> => {
  const resolvedLabels = {
    ...DEFAULT_ACCEPT_SHARE_INVITATION_ERROR_LABELS,
    ...labels,
  };
  const { message, traceId, code } = await getApiErrorDetails(error);

  /*
   * Expired and over-the-limit links are expected outcomes, not faults, so
   * they get a user-facing sentence and no Request ID.
   */
  if (code === ShareInvitationErrorCode.ShareInvitationNotFound) {
    return {
      kind: AcceptShareInvitationErrorKind.NotFound,
      message: resolvedLabels.notFound,
      cause: error,
    };
  }

  if (
    code === ShareInvitationErrorCode.ShareInvitationAcceptedUsersLimitReached
  ) {
    const itemName = await getAcceptInvitationErrorItemName(error);
    return {
      kind: AcceptShareInvitationErrorKind.UsersLimitReached,
      message: itemName
        ? resolvedLabels.usersLimitReached(itemName)
        : resolvedLabels.usersLimitReachedUnnamed,
      ...(itemName ? { itemName } : {}),
      cause: error,
    };
  }

  return {
    kind: AcceptShareInvitationErrorKind.Failed,
    message: message ?? resolvedLabels.acceptError,
    ...(traceId ? { requestId: traceId } : {}),
    cause: error,
  };
};
