import { EntityType } from './common';

import {
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

export interface ToolsetModel extends ShareEntity {
  transport: ToolsetTransportType;
  allowedTools: string[];
  version: string;
  reference: string;
  description: string;
  topics: string[];
  type: EntityType;

  endpoint?: string;
  iconUrl?: string;
  userRoles?: string[];
  maxRetryAttempts?: number;
  isDefault?: boolean;

  authSettings: {
    authenticationType: ToolsetAuthTypes;
    // API Key flow
    apiKeyHeader?: string;
    // OAuth flow
    codeChallenge?: string;
    codeChallengeMethod?: string;
    clientId?: string;
    clientSecret?: string;
    authorizationEndpoint?: string;
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
}

export type ToolsetsMap = Partial<Record<string, ToolsetModel>>;
