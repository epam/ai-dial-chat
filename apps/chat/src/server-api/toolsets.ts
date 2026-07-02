import type {
  DialModelFeaturesDto,
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
  code_challenge?: string;
  code_challenge_method?: string;
  scopes_supported?: string[];
  global_auth_status?: DialToolsetAuthSettingsDto['globalAuthStatus'];
  user_level_auth_status?: DialToolsetAuthSettingsDto['userLevelAuthStatus'];
};

type RawDialModelFeaturesDto = Partial<DialModelFeaturesDto> & {
  truncate_prompt?: boolean;
  configuration?: boolean;
  system_prompt?: boolean;
  url_attachments?: boolean;
  folder_attachments?: boolean;
  allow_resume?: boolean;
  accessible_by_per_request_key?: boolean;
  content_parts?: boolean;
  auto_caching?: boolean;
  parallel_tool_calls?: boolean;
  assistant_attachments_in_request?: boolean;
  chat_completion?: boolean;
  responses_api?: boolean;
  max_tokens_supported?: boolean;
  max_completion_tokens_supported?: boolean;
  custom_temperature_supported?: boolean;
  reasoning_efforts?: string[];
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
  features?: RawDialModelFeaturesDto;
  auth_settings?: RawToolsetAuthSettingsDto;
  is_installed?: boolean;
  is_my?: boolean;
};

const normalizeFeatures = (
  features?: RawDialModelFeaturesDto,
): DialModelFeaturesDto | undefined => {
  if (!features) return undefined;

  const {
    truncate_prompt,
    configuration,
    system_prompt,
    url_attachments,
    folder_attachments,
    allow_resume,
    accessible_by_per_request_key,
    content_parts,
    auto_caching,
    parallel_tool_calls,
    assistant_attachments_in_request,
    chat_completion,
    responses_api,
    max_tokens_supported,
    max_completion_tokens_supported,
    custom_temperature_supported,
    reasoning_efforts,
    ...rest
  } = features;

  return {
    ...rest,
    truncatePrompt: rest.truncatePrompt ?? truncate_prompt,
    _configuration: rest._configuration ?? configuration,
    systemPrompt: rest.systemPrompt ?? system_prompt,
    urlAttachments: rest.urlAttachments ?? url_attachments,
    folderAttachments: rest.folderAttachments ?? folder_attachments,
    allowResume: rest.allowResume ?? allow_resume,
    accessibleByPerRequestKey:
      rest.accessibleByPerRequestKey ?? accessible_by_per_request_key,
    contentParts: rest.contentParts ?? content_parts,
    autoCaching: rest.autoCaching ?? auto_caching,
    parallelToolCalls: rest.parallelToolCalls ?? parallel_tool_calls,
    assistantAttachmentsInRequest:
      rest.assistantAttachmentsInRequest ?? assistant_attachments_in_request,
    chatCompletion: rest.chatCompletion ?? chat_completion,
    responsesApi: rest.responsesApi ?? responses_api,
    maxTokensSupported: rest.maxTokensSupported ?? max_tokens_supported,
    maxCompletionTokensSupported:
      rest.maxCompletionTokensSupported ?? max_completion_tokens_supported,
    customTemperatureSupported:
      rest.customTemperatureSupported ?? custom_temperature_supported,
    reasoningEfforts: rest.reasoningEfforts ?? reasoning_efforts,
  };
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
    code_challenge,
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
    codeChallenge: rest.codeChallenge ?? code_challenge,
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
    features,
    auth_settings,
    is_installed,
    is_my,
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
    features: normalizeFeatures(features),
    authSettings: normalizeAuthSettings(rest.authSettings ?? auth_settings),
    isInstalled: rest.isInstalled ?? is_installed,
    isMy: rest.isMy ?? is_my,
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
