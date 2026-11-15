import type {
  AcceptInvitationResponseDto,
  DeploymentItemDto,
  DialToolsetDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import type { AcceptShareInvitationErrorKind } from './types';

/** Localized sentences shown when accepting a share invitation fails. */
export interface AcceptShareInvitationErrorLabels {
  /** Sentence for an expired or unknown link. Defaults to `'We are sorry, but the link you are trying to access has expired or does not exist.'`. */
  notFound: string;
  /** Sentence for a reached users limit, given the shared item's name. Defaults to `` (name) => `"${name}" has already been shared with the maximum specified number of users.` ``. */
  usersLimitReached: (name: string) => string;
  /** Sentence for a reached users limit when the backend sent no item name. Defaults to `'This item has already been shared with the maximum specified number of users.'`. */
  usersLimitReachedUnnamed: string;
  /** Sentence for any other failure that carries no message of its own. Defaults to `'This share link is invalid or has expired.'`. */
  acceptError: string;
}

/** A classified share-invitation accept failure, ready to show as an error notification. */
export interface AcceptShareInvitationError {
  /** Why the accept failed. */
  kind: AcceptShareInvitationErrorKind;
  /** User-facing sentence for the failure. */
  message: string;
  /** Trace id to show as the Request ID; set only for `Failed`, since expired and over-the-limit links are expected outcomes. */
  requestId?: string;
  /** Shared item's title sent with a `UsersLimitReached` refusal, when the backend sent one. */
  itemName?: string;
  /** The original thrown value. */
  cause: unknown;
}

/** Options for {@link useAcceptShareInvitation}. */
export interface UseAcceptShareInvitationOptions {
  /** Invitation id from the opened share link; nothing is accepted while it is `undefined`. */
  invitationId: string | undefined;
  /** Already-configured call that accepts the invitation in DIAL Core. */
  acceptInvitation: (
    invitationId: string,
  ) => Promise<AcceptInvitationResponseDto>;
  /** Refreshes the host's lists after the accept and before the shared summaries are merged. Skipped when omitted. */
  refreshLists?: (response: AcceptInvitationResponseDto) => Promise<unknown>;
  /** Receives the backend-resolved model, application or toolset summary, after `refreshLists` settles. */
  onSharedItem?: (item: DeploymentItemDto | DialToolsetDto) => void;
  /** Receives the backend-resolved skill summary, after `refreshLists` settles. */
  onSharedSkill?: (skill: SkillMetadataItemDto) => void;
  /** Called last once the invitation is accepted, e.g. to redirect to `response.itemId`. */
  onAccepted: (response: AcceptInvitationResponseDto) => void;
  /** Called with the classified failure, e.g. to show a notification and redirect to a fallback. */
  onError: (error: AcceptShareInvitationError) => void;
  /** Overrides for the failure sentences. Defaults to {@link DEFAULT_ACCEPT_SHARE_INVITATION_ERROR_LABELS}. */
  labels?: Partial<AcceptShareInvitationErrorLabels>;
}
