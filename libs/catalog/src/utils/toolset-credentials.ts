import type { CatalogItemCredentials } from '../models/catalog-item-credentials';
import {
  CredentialsBadgeState,
  CredentialsLevel,
  CredentialsUiState,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';

const isSignedIn = (status: CredentialStatus | undefined): boolean =>
  status === CredentialStatus.SignedIn;

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

/** Resolves which level a direct (non-accordion) "Log out" action applies to. */
export const getSignedInLevel = (
  credentials: CatalogItemCredentials,
): CredentialsLevel =>
  isSignedIn(credentials.userStatus)
    ? CredentialsLevel.User
    : CredentialsLevel.Global;
