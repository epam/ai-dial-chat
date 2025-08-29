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
  type: EntityType.Toolset;

  endpoint?: string;
  iconUrl?: string;
  userRoles?: string[];
  maxRetryAttempts?: number;
  isDefault?: false;

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
    // Auth status field
    authStatus: Record<ToolsetCredentialsLevel, ToolsetAuthStatus>;
  };
}

export interface ToolsetAuthPayloadBase {
  url: string;
  credentials_level: ToolsetCredentialsLevel;
  authentication_type: ToolsetAuthTypes;
}

interface ToolsetOAuthPayload extends ToolsetAuthPayloadBase {
  code: string;
}
interface ToolsetApiKeyPayload extends ToolsetAuthPayloadBase {
  api_key: string;
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
