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

/**
 * Resolves which credentials action/section the Details Panel should show,
 * mirroring the legacy Marketplace `getToolsetAuthAction` decision:
 * admin managing a public item always gets the two-level accordion; a
 * non-admin viewing a public item that they are not personally signed into
 * gets "Login with my creds"; otherwise it's a plain Log in / Log out.
 */
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

/**
 * Resolves the card-grid credentials badge state: LOGGED OUT when signed out
 * at every applicable level. Returns `undefined` (no badge) when the item
 * requires no authentication, or when it is signed in at any level.
 */
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
 * Resolves which level a direct (non-accordion) "Log out" action applies to:
 * prefers `USER` when signed in there, else falls back to `GLOBAL`. Only
 * meaningful when `getCredentialsUiState` returned `LogOut` (i.e. at least
 * one level is signed in).
 */
export const getSignedInLevel = (
  credentials: CatalogItemCredentials,
): CredentialsLevel =>
  isSignedIn(credentials.userStatus)
    ? CredentialsLevel.User
    : CredentialsLevel.Global;
