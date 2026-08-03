import { EntityType } from './common';

import {
  EntityPublicationInfo,
  ShareEntity,
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
