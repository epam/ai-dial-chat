import type {
  DialToolsetAuthSettingsDto,
  DialToolsetDto,
  DialToolsetListResponseDto,
  MutatedToolsetDto,
  ToolsetAuthResultDto,
  ToolsetBodyDto,
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/chat-api-client';
import { toolsetsApi } from './api-client';

type RawToolsetAuthSettingsDto = Partial<DialToolsetAuthSettingsDto> & {
  authentication_type?: DialToolsetAuthSettingsDto['authenticationType'];
  api_key_header?: string;
  client_id?: string;
  redirect_uri?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  code_challenge_method?: string;
  scopes_supported?: string[];
  global_auth_status?: DialToolsetAuthSettingsDto['globalAuthStatus'];
  user_level_auth_status?: DialToolsetAuthSettingsDto['userLevelAuthStatus'];
};

type RawDialToolsetDto = DialToolsetDto & {
  display_name?: string;
  display_version?: string;
  icon_url?: string;
  description_keywords?: string[];
  max_retry_attempts?: number;
  created_at?: number;
  updated_at?: number;
  allowed_tools?: string[];
  auth_settings?: RawToolsetAuthSettingsDto;
};

const normalizeAuthSettings = (
  authSettings?: RawToolsetAuthSettingsDto,
): DialToolsetAuthSettingsDto | undefined => {
  if (!authSettings) return undefined;

  const {
    authentication_type,
    api_key_header,
    client_id,
    redirect_uri,
    authorization_endpoint,
    token_endpoint,
    code_challenge_method,
    scopes_supported,
    global_auth_status,
    user_level_auth_status,
    ...rest
  } = authSettings;
  const authenticationType = rest.authenticationType ?? authentication_type;

  if (!authenticationType) return undefined;

  return {
    ...rest,
    authenticationType,
    apiKeyHeader: rest.apiKeyHeader ?? api_key_header,
    clientId: rest.clientId ?? client_id,
    redirectUri: rest.redirectUri ?? redirect_uri,
    authorizationEndpoint: rest.authorizationEndpoint ?? authorization_endpoint,
    tokenEndpoint: rest.tokenEndpoint ?? token_endpoint,
    codeChallengeMethod: rest.codeChallengeMethod ?? code_challenge_method,
    scopesSupported: rest.scopesSupported ?? scopes_supported,
    globalAuthStatus: rest.globalAuthStatus ?? global_auth_status,
    userLevelAuthStatus: rest.userLevelAuthStatus ?? user_level_auth_status,
  };
};

const normalizeToolset = (toolset: RawDialToolsetDto): DialToolsetDto => {
  const {
    display_name,
    display_version,
    icon_url,
    description_keywords,
    max_retry_attempts,
    created_at,
    updated_at,
    allowed_tools,
    auth_settings,
    ...rest
  } = toolset;

  return {
    ...rest,
    displayName: rest.displayName ?? display_name,
    displayVersion: rest.displayVersion ?? display_version,
    iconUrl: rest.iconUrl ?? icon_url,
    descriptionKeywords: rest.descriptionKeywords ?? description_keywords,
    maxRetryAttempts: rest.maxRetryAttempts ?? max_retry_attempts,
    createdAt: rest.createdAt ?? created_at,
    updatedAt: rest.updatedAt ?? updated_at,
    allowedTools: rest.allowedTools ?? allowed_tools,
    authSettings: normalizeAuthSettings(rest.authSettings ?? auth_settings),
  };
};

export const listToolsets = async (): Promise<DialToolsetListResponseDto> => {
  const response = await toolsetsApi.listToolsets();
  return {
    ...response,
    data: response.data.map((toolset) =>
      normalizeToolset(toolset as RawDialToolsetDto),
    ),
  };
};

export const getToolset = async (
  toolsetName: string,
): Promise<DialToolsetDto> =>
  normalizeToolset(
    (await toolsetsApi.getToolset({ toolsetName })) as RawDialToolsetDto,
  );

export const createToolset = (
  body: ToolsetBodyDto,
): Promise<MutatedToolsetDto> =>
  toolsetsApi.createToolset({ toolsetBodyDto: body });

export const updateToolset = (
  toolsetName: string,
  body: ToolsetBodyDto,
): Promise<MutatedToolsetDto> =>
  toolsetsApi.updateToolset({ toolsetName, toolsetBodyDto: body });

export const deleteToolset = (toolsetName: string): Promise<void> =>
  toolsetsApi.deleteToolset({ toolsetName });

export const loginToolset = (
  toolsetName: string,
  body: ToolsetLoginBodyDto,
): Promise<ToolsetAuthResultDto> =>
  toolsetsApi.loginToolset({ toolsetName, toolsetLoginBodyDto: body });

export const logoutToolset = (
  toolsetName: string,
  body: ToolsetLogoutBodyDto,
): Promise<ToolsetAuthResultDto> =>
  toolsetsApi.logoutToolset({ toolsetName, toolsetLogoutBodyDto: body });
