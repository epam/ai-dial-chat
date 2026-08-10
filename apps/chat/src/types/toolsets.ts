import { EntityType } from './common';

import {
  EntityPublicationInfo,
  ShareEntity,
  TokenEndpointAuthMethod,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
  ToolsetTransportType,
} from '@epam/ai-dial-shared';

export enum ToolsetCredentialsLevel {
  GLOBAL = 'GLOBAL',
  USER = 'USER',
  APP = 'APP',
}

export interface ToolsetInfo extends ShareEntity {
  version: string;
}

export interface ToolsetModel extends ShareEntity {
  transport: ToolsetTransportType;
  allowedTools: string[];
  version: string;
  reference: string;
  description: string | Record<string, string>;
  topics: string[];
  type: EntityType.Toolset;

  endpoint?: string;
  iconUrl?: string;
  userRoles?: string[];
  maxRetryAttempts?: number;
  isDefault?: boolean;

  authSettings: {
    authenticationType: ToolsetAuthTypes;
    dynamicallyRegistered?: boolean;
    // API Key flow
    apiKeyHeader?: string;
    // OAuth flow
    codeChallenge?: string;
    codeChallengeMethod?: string;
    clientId?: string;
    clientSecret?: string;
    authorizationEndpoint?: string;
    // TODO: remove redirectUri after toolset login is stable with new flow (redirectUri will be sent in login request)
    redirectUri?: string;
    scopesSupported?: string[];
    tokenEndpoint?: string;
    tokenEndpointAuthMethod?: TokenEndpointAuthMethod;
    // Authentication status map
    authStatus?: Record<ToolsetCredentialsLevel, ToolsetAuthStatus>;
  };
}

export interface ToolsetAuthPayloadBase {
  url: string;
  credentialsLevel: ToolsetCredentialsLevel;
  authenticationType: ToolsetAuthTypes;
}

interface ToolsetOAuthPayload extends ToolsetAuthPayloadBase {
  code: string;
  redirectUri: string;
}
interface ToolsetApiKeyPayload extends ToolsetAuthPayloadBase {
  apiKey: string;
}

export type ToolsetAuthPayload = ToolsetOAuthPayload | ToolsetApiKeyPayload;

export enum ToolsetEditorSteps {
  General = 'General info',
  Settings = 'Toolset settings',
}

export interface InstalledToolset {
  reference: string;
  pinned?: boolean;
}

export interface ToolsetRedirectState {
  toolsetId: string;
  credentialsLevel?: ToolsetCredentialsLevel;
  callbackUrl?: string;
  isAdmin?: boolean;
}

/**
 * Where a toolset sign in attempt broke down. Reported from the login window
 * back to the tab that opened it, so failures can be investigated without
 * having to reproduce them with the login window's devtools open.
 */
export enum ToolsetAuthErrorReason {
  /** The login window was closed by the user before authentication finished */
  WindowClosed = 'window-closed',
  /** The login window did not report a result within the allotted time */
  Timeout = 'timeout',
  /** The OAuth provider redirected back with an `error` instead of a `code` */
  ProviderError = 'provider-error',
  /** The `state` query param could not be decoded */
  InvalidState = 'invalid-state',
  /** The provider redirected back without an authorization code or toolset id */
  MissingCode = 'missing-code',
  /** DIAL Core rejected the sign in request */
  SignInRequestFailed = 'sign-in-request-failed',
  /** Something threw inside the login window */
  UnexpectedError = 'unexpected-error',
}

export interface ToolsetAuthErrorDetails {
  reason?: ToolsetAuthErrorReason;
  /** Machine-readable error code, e.g. the OAuth `error` value */
  code?: string;
  /** Human-readable description, from the provider or the DIAL Core response */
  message?: string;
  /** DIAL Core trace id, used to correlate the failure with backend logs */
  traceId?: string;
  /** The OAuth `error_uri`, when the provider supplies one */
  uri?: string;
}

export type ToolsetAuthResultMessageType = 'toolset-auth-result';

/** Payload the login window posts to its opener when authentication settles */
export interface ToolsetAuthResultMessage {
  type: ToolsetAuthResultMessageType;
  ok: boolean;
  error?: ToolsetAuthErrorDetails;
}

export type ToolsetsMap = Partial<Record<string, ToolsetModel>>;

export interface PublishRequestDialAIEntityModel extends ToolsetModel {
  folderId: string;
  publicationInfo: EntityPublicationInfo;
}

export type ToolsetContextMenuDisabledActions = Partial<{
  copyLink: boolean;
  edit: boolean;
  share: boolean;
  unshare: boolean;
  publish: boolean;
  unpublish: boolean;
  delete: boolean;
  login: boolean;
  connect: boolean;
  repair: boolean;
}>;

export interface ToolsetTool {
  name: string;
  title: string;
}
