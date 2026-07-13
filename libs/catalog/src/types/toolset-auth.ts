/** Authentication mechanism required by a toolset's credentials. */
export enum ToolsetAuthenticationType {
  /** No credentials required. */
  None = 'NONE',
  /** A single API key value is required. */
  ApiKey = 'API_KEY',
  /** An OAuth authorization-code redirect is required. */
  OAuth = 'OAUTH',
}

/** Sign-in status of a toolset's own (per-user) credentials. */
export enum CredentialStatus {
  /** Credentials are present and valid. */
  SignedIn = 'SIGNED_IN',
  /** No credentials are present. */
  SignedOut = 'SIGNED_OUT',
  /** Credentials are present but no longer valid. */
  Failed = 'FAILED',
}

/** Which credentials slot a login/logout call applies to. */
export enum CredentialsLevel {
  /** The current user's own, personal credentials. */
  User = 'USER',
  /** Organization-wide credentials shared by all users of a public toolset. */
  Global = 'GLOBAL',
}

/** Resolved UI state for the credentials trigger button/section. */
export enum CredentialsUiState {
  /** Admin managing a public toolset: both USER and GLOBAL sections shown. */
  ManageCredentials = 'MANAGE_CREDENTIALS',
  /** Non-admin viewing a public toolset, not yet signed in personally. */
  LoginWithMyCreds = 'LOGIN_WITH_MY_CREDS',
  /** Not signed in at any applicable level. */
  LogIn = 'LOG_IN',
  /** Signed in at some level already. */
  LogOut = 'LOG_OUT',
}

/** Credentials-status badge state shown on catalog cards. Only the signed-out state renders a badge. */
export enum CredentialsBadgeState {
  LoggedOut = 'LOGGED_OUT',
}
