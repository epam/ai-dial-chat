import type {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  ExternalServiceOAuthSettings,
} from '../external-services/useExternalServiceLogin';
import type { ToolsetCredentialsLevel } from '../oauth/types';
import type { PendingSigninEvent } from '../shared/client-channel';
import type {
  SigninInterruptAnnouncementKind,
  SigninInterruptRowError,
  SigninInterruptRowStatus,
} from './types';

/** Display and login metadata resolved for the resource behind a pending sign-in event. */
export interface SigninRowInfo {
  /** Resource display name, or a fallback derived from its id while metadata is missing. */
  displayName: string;
  /** Resource version shown next to the name, when known. */
  displayVersion?: string;
  /** Authentication mechanism, or `undefined` while metadata is missing. */
  authenticationType?: ExternalServiceAuthType;
  /** Credentials level the login targets. */
  credentialsLevel: ToolsetCredentialsLevel | ExternalServiceCredentialsLevel;
  /** OAuth client settings for the authorize URL, when the resource uses OAuth. */
  oauthSettings?: ExternalServiceOAuthSettings;
}

/** One pending sign-in event with its resolved metadata and local row state. */
export interface SigninInterruptRow {
  /** The pending client-channel event this row resolves. */
  event: PendingSigninEvent;
  /** Resolved display and login metadata. */
  info: SigninRowInfo;
  /** Whether a login or decline is in flight. */
  status: SigninInterruptRowStatus;
  /** Shorthand for `status === SigninInterruptRowStatus.Processing`. */
  isProcessing: boolean;
  /** Recoverable failure of the last attempt, if any. */
  error?: SigninInterruptRowError;
  /** API key typed into the row; `''` until the user types. */
  apiKey: string;
  /** Whether the resource takes an API key, so the row shows a key field. */
  requiresApiKey: boolean;
  /** Whether the resource needs no credentials, so the row offers no actions. */
  requiresNoCredentials: boolean;
  /** Whether the resource uses DIAL-native offline credentials. */
  isDialNative: boolean;
  /** Whether `Log in` can be submitted: always, except an API-key row with a blank key. */
  canSubmitLogin: boolean;
}

/** Status a sign-in interrupt announces after resolving an event. */
export interface SigninInterruptAnnouncement {
  /** Which resolution happened. */
  kind: SigninInterruptAnnouncementKind;
  /** Display name of the resolved resource; `''` when it is no longer known. */
  name: string;
}
