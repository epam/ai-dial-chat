import type { CatalogItemCredentials } from '../models/catalog-item-credentials';
import {
  CredentialsBadgeState,
  CredentialsBannerState,
  CredentialsLevel,
  CredentialsUiState,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';

const isSignedIn = (status: CredentialStatus | undefined): boolean =>
  status === CredentialStatus.SignedIn;

/** Whether the given credentials level (`USER` or `GLOBAL`) is currently signed in. */
export const isLevelSignedIn = (
  credentials: CatalogItemCredentials | undefined,
  level: CredentialsLevel,
): boolean =>
  isSignedIn(
    level === CredentialsLevel.User
      ? credentials?.userStatus
      : credentials?.globalStatus,
  );

/** Resolves after the given duration, used to space out retry attempts. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves which credentials action/section the Details Panel should show for the given item credentials. */
export const getCredentialsUiState = (
  credentials: CatalogItemCredentials,
): CredentialsUiState => {
  const isUserSignedIn = isSignedIn(credentials.userStatus);
  const isGlobalSignedIn = isSignedIn(credentials.globalStatus);

  if (credentials.isManageableByAdmin) {
    return CredentialsUiState.ManageCredentials;
  }
  if (credentials.isPublic && !isUserSignedIn) {
    return CredentialsUiState.LoginWithMyCreds;
  }
  if (!isUserSignedIn && !isGlobalSignedIn) {
    return CredentialsUiState.LogIn;
  }
  return CredentialsUiState.LogOut;
};

/** Returns `CredentialsBadgeState.LoggedOut` when signed out at every applicable level, or `undefined` when no authentication is required or signed in at any level. */
export const getCredentialsBadgeState = (
  credentials: CatalogItemCredentials,
): CredentialsBadgeState | undefined => {
  if (credentials.authenticationType === ToolsetAuthenticationType.None) {
    return undefined;
  }

  const isUserSignedIn = isSignedIn(credentials.userStatus);
  const isGlobalSignedIn = isSignedIn(credentials.globalStatus);

  return !isUserSignedIn && !isGlobalSignedIn
    ? CredentialsBadgeState.LoggedOut
    : undefined;
};

/**
 * Whether the publisher holds a credential for an authenticated toolset and
 * may therefore offer to publish it alongside the toolset.
 *
 * Either level qualifies: publishing always acts on the publisher's own source
 * item, where `globalStatus` is the owner's own credential and `userStatus`
 * covers a personal credential configured on top of it. Access the publisher
 * does not hold cannot be passed on.
 */
export const canPublishCredentials = (
  credentials: CatalogItemCredentials | undefined,
): boolean => {
  if (
    credentials?.authenticationType == null ||
    credentials.authenticationType === ToolsetAuthenticationType.None
  ) {
    return false;
  }
  return (
    isSignedIn(credentials.userStatus) || isSignedIn(credentials.globalStatus)
  );
};

/** Resolves which level a direct (non-accordion) "Log out" action applies to. */
export const getSignedInLevel = (
  credentials: CatalogItemCredentials,
): CredentialsLevel =>
  isSignedIn(credentials.userStatus)
    ? CredentialsLevel.User
    : CredentialsLevel.Global;

/** Resolves which credentials banner, if any, the Details Panel should show below the header. */
export const getCredentialsBannerState = (
  credentials: CatalogItemCredentials,
): CredentialsBannerState | undefined => {
  if (credentials.isManageableByAdmin) {
    if (isSignedIn(credentials.userStatus)) {
      return CredentialsBannerState.PersonalCredentialsActive;
    }
    if (isSignedIn(credentials.globalStatus)) {
      return CredentialsBannerState.OrgCredentialsActive;
    }
    return undefined;
  }
  if (
    isSignedIn(credentials.globalStatus) &&
    credentials.isPublic &&
    !isSignedIn(credentials.userStatus)
  ) {
    return CredentialsBannerState.UsingOrgCredentials;
  }
  return undefined;
};
