import { EntityType } from './common';

import {ShareEntity, ToolsetAuthTypes, ToolsetTransportType} from '@epam/ai-dial-shared';

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

  authSettings: {
    authenticationType: ToolsetAuthTypes;
    clientId?: string;
    clientSecret?: string;
    authorizationEndpoint?: string;
    redirectUri?: string;
    apiKeyHeader?: string;
  }
}

export enum ToolsetCredentialsLevel {
  GLOBAL = 'GLOBAL',
  USER = 'USER',
  APP = 'APP',
}

interface ToolsetAuthPayloadBase {
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
