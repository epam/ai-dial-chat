/**
 * Enums and constants shared by the OAuth authorization-code popup flow and
 * every host that drives it. These declarations live here (rather than being
 * copied per host) because TypeScript string enums are nominal: a
 * structurally identical host-side copy would not type-check against a lib
 * signature that names the enum.
 */

/** Authentication mechanism a toolset requires. */
export enum ToolsetAuthTypes {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
}

/** Sign-in state DIAL Core reports for one credentials level of a toolset. */
export enum ToolsetAuthStatus {
  SignedIn = 'SIGNED_IN',
  SignedOut = 'SIGNED_OUT',
  Failed = 'FAILED',
}

/** Scope the credentials submitted by a login apply to. */
export enum ToolsetCredentialsLevel {
  Global = 'GLOBAL',
  User = 'USER',
  App = 'APP',
}

/** Whether a toolset authenticates interactively, and whether its client is manually configured. */
export enum WithLogin {
  WithLogin = 'with-login',
  WithoutLogin = 'without-login',
  WithConfig = 'with-config',
}

/**
 * Which kind of resource an OAuth flow is authenticating. Three kinds share
 * the same popup/`BroadcastChannel` machinery, which is why this module is
 * named for the concern rather than for toolsets.
 */
export enum OAuthResourceKind {
  Toolset = 'toolset',
  ExternalService = 'external-service',
  /**
   * Proactive Scheduled Tasks offline-credentials consent. Unlike
   * `Toolset`/`ExternalService`, this kind has no natural per-resource id —
   * the shared `ToolsetRedirectState.toolsetId` slot is repurposed as a
   * fixed sentinel correlation id (`'offline-credentials'`) purely for the
   * popup/`BroadcastChannel` handshake, never as a real toolset/
   * external-service id.
   */
  OfflineCredentials = 'offline-credentials',
}

/** Outcome of calling `initiateOAuthLogin`. */
export enum ToolsetOAuthInitiationResultType {
  /** The popup was opened and navigated to the provider's authorize URL. */
  Started = 'started',
  /** The browser blocked the popup before it could be opened. */
  Blocked = 'blocked',
  /** The toolset's OAuth configuration is missing required fields. */
  InvalidConfig = 'invalid-config',
}

/** Outcome reported back to the tab that initiated an OAuth login. */
export enum ToolsetOAuthResultType {
  Success = 'success',
  Failure = 'failure',
  /** The popup was closed and focus returned to its opener, or the flow timed out. */
  Cancelled = 'cancelled',
}

/** Reason codes the callback popup can report for a failed OAuth login. */
export enum ToolsetOAuthFailureReason {
  MissingCode = 'missing-code',
  MissingRedirectState = 'missing-redirect-state',
  StateMismatch = 'state-mismatch',
  LoginRequestFailed = 'login-request-failed',
}

/** Control messages exchanged over a flow-scoped OAuth channel. */
export enum ToolsetOAuthChannelControlType {
  ResultAcknowledged = 'result-acknowledged',
}

/** Query parameters written into the callback popup URL after an OAuth flow completes. */
export enum ToolsetOAuthCallbackQuery {
  Result = 'toolsetOAuthResult',
  FailureReason = 'toolsetOAuthFailureReason',
}

/** `sessionStorage` key the flow writes its `ToolsetRedirectState` under, in the popup it opens. */
export const TOOLSET_REDIRECT_STATE_KEY = 'toolset-redirect-state';
