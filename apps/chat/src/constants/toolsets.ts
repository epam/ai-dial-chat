import { IconBrandOauth, IconKey, IconLockOff } from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import { ToolsetEditorI18nKeys } from './translation-keys';

export enum ToolsetAuthTypes {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
}

export enum ToolsetTransportType {
  Http = 'HTTP',
  Sse = 'SSE',
}

export enum ToolsetAuthStatus {
  SignedIn = 'SIGNED_IN',
  SignedOut = 'SIGNED_OUT',
  Failed = 'FAILED',
}

export enum ToolsetCredentialsLevel {
  Global = 'GLOBAL',
  User = 'USER',
  App = 'APP',
}

export enum ToolsetEditorSteps {
  General = 'general',
  Settings = 'settings',
}

export enum WithLogin {
  WithLogin = 'with-login',
  WithoutLogin = 'without-login',
  WithConfig = 'with-config',
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

export enum OAuthResourceKind {
  Toolset = 'toolset',
  ExternalService = 'external-service',
  /**
   * Proactive Scheduled Tasks offline-credentials consent (see
   * `useOfflineCredentialsLogin`/`ScheduledTasksRouteGate`). Unlike `Toolset`/
   * `ExternalService`, this kind has no natural per-resource id — the shared
   * `ToolsetRedirectState.toolsetId` slot is repurposed as a fixed sentinel
   * correlation id (`'offline-credentials'`) purely for the popup/
   * `BroadcastChannel` handshake, never as a real toolset/external-service id.
   */
  OfflineCredentials = 'offline-credentials',
}

/** `Id`/`ReturnUrl` intentionally match `EditorQuery`'s values; kept as their own enum for the toolset-editor-only `Step` member. */
export enum ToolsetEditorQuery {
  Id = 'id',
  Step = 'step',
  ReturnUrl = 'returnUrl',
}

/** Query parameters written into the callback popup URL after an OAuth flow completes. */
export enum ToolsetOAuthCallbackQuery {
  Result = 'toolsetOAuthResult',
  FailureReason = 'toolsetOAuthFailureReason',
}

export const DEFAULT_TOOLSET_NAME = 'New toolset';
export const DEFAULT_TOOLSET_VERSION = '0.0.1';

/** `sessionStorage` key `initiateOAuthLogin` writes the admin flow's `ToolsetRedirectState` under, in the popup it opens. */
export const TOOLSET_REDIRECT_STATE_KEY = 'toolset-redirect-state';

export interface AuthTypeOption {
  labelKey: ToolsetEditorI18nKeys;
  Icon: TablerIcon;
}

export const AUTH_TYPE_OPTIONS: Record<ToolsetAuthTypes, AuthTypeOption> = {
  [ToolsetAuthTypes.OAuth]: {
    labelKey: ToolsetEditorI18nKeys.AuthTypeOAuth,
    Icon: IconBrandOauth,
  },
  [ToolsetAuthTypes.ApiKey]: {
    labelKey: ToolsetEditorI18nKeys.AuthTypeApiKey,
    Icon: IconKey,
  },
  [ToolsetAuthTypes.None]: {
    labelKey: ToolsetEditorI18nKeys.AuthTypeNone,
    Icon: IconLockOff,
  },
};
