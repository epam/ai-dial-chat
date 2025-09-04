import { constructPath } from '@/src/utils/app/file';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getEntityBucket, getToolsetRootId } from '@/src/utils/app/id';
import { ApiUtils, getToolsetApiKey } from '@/src/utils/server/api';

import { EntityType, PartialBy } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import {
  ToolsetCredentialsLevel,
  ToolsetModel,
  ToolsetRedirectState,
  ToolsetsMap,
} from '@/src/types/toolsets';

import { Routes } from '@/src/constants/routes';

import {
  Toolset,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';

export const parseToolsetApiAuthStatus = (data?: Toolset) => {
  return {
    [ToolsetCredentialsLevel.GLOBAL]:
      data?.auth_settings?.global_auth_status ?? ToolsetAuthStatus.SIGNED_OUT,
    [ToolsetCredentialsLevel.USER]:
      data?.auth_settings?.user_level_auth_status ??
      ToolsetAuthStatus.SIGNED_OUT,
    [ToolsetCredentialsLevel.APP]: ToolsetAuthStatus.SIGNED_OUT,
  };
};

export const convertToolsetFromApi = (data: Toolset): ToolsetModel => {
  const id = ApiUtils.decodeApiUrl(data.id ?? data.toolset ?? data.name ?? '');
  const author = data.owner ?? data.author;

  return {
    endpoint: data.endpoint,
    transport: data.transport,
    allowedTools: data.allowed_tools,
    id,
    folderId: getFolderIdFromEntityId(id),
    version: data.display_version,
    name: data.display_name,
    reference: data.reference ?? id,
    type: EntityType.Toolset,

    description: data.description ?? '',
    iconUrl: data.icon_url ? ApiUtils.decodeApiUrl(data.icon_url) : '',
    topics: data.description_keywords ?? [],
    userRoles: data.user_roles,
    maxRetryAttempts: data.max_retry_attempts,
    author,
    createdAt: data.created_at,
    updatedAt: data.updated_at,

    authSettings: {
      authenticationType:
        data.auth_settings?.authentication_type ?? ToolsetAuthTypes.NONE,
      authStatus: parseToolsetApiAuthStatus(data),
      clientId: data.auth_settings.client_id,
      clientSecret: data.auth_settings.client_secret,
      authorizationEndpoint: data.auth_settings.authorization_endpoint,
      redirectUri: data.auth_settings.redirect_uri,
      apiKeyHeader: data.auth_settings.api_key_header,
      codeChallenge: data.auth_settings.code_challenge,
      codeChallengeMethod: data.auth_settings.code_challenge_method,
    },
  };
};

export const convertToolsetAuthSettingsToApi = (data: ToolsetModel) => {
  switch (data.authSettings.authenticationType) {
    case ToolsetAuthTypes.API_KEY:
      return {
        authentication_type: data.authSettings.authenticationType,
        api_key_header: data.authSettings.apiKeyHeader,
      };
    case ToolsetAuthTypes.OAUTH:
      return {
        authentication_type: data.authSettings.authenticationType,
        redirect_uri: data.authSettings.redirectUri,
        ...(data.authSettings.clientId && {
          client_id: data.authSettings.clientId,
          client_secret: data.authSettings.clientSecret,
        }),
      };
    default:
    case ToolsetAuthTypes.NONE:
      return {
        authentication_type: data.authSettings.authenticationType,
      };
  }
};

export const convertToolsetModelToApi = (data: ToolsetModel): Toolset => ({
  endpoint: data.endpoint ?? '',
  transport: data.transport,
  allowed_tools: data.allowedTools,
  display_version: data.version,
  ...(data.reference && { reference: data.reference }),

  display_name: data.name,
  description: data.description,
  icon_url: ApiUtils.encodeApiUrl(data.iconUrl ?? ''),
  description_keywords: data.topics,

  auth_settings: convertToolsetAuthSettingsToApi(data),
});

export const getGeneratedToolsetId = (
  toolset: PartialBy<ToolsetModel, 'id'>,
): string => {
  if (toolset.folderId) {
    return constructPath(toolset.folderId, getToolsetApiKey(toolset));
  }

  return constructPath(
    getToolsetRootId(
      toolset.id ? getEntityBucket({ id: toolset.id }) : undefined,
    ),
    getToolsetApiKey(toolset),
  );
};

export const regenerateToolsetId = (
  toolset: PartialBy<ToolsetModel, 'id'>,
): ToolsetModel => {
  const newId = getGeneratedToolsetId(toolset);
  if (!toolset.id || newId !== toolset.id) {
    return {
      ...toolset,
      id: newId,
    };
  }

  return toolset as ToolsetModel;
};

export const encodeToolsetRedirectState = (
  state: ToolsetRedirectState,
): string => {
  return encodeURIComponent(JSON.stringify(state));
};

export const decodeToolsetRedirectState = (
  state: string,
): ToolsetRedirectState => {
  return JSON.parse(decodeURIComponent(state)) as ToolsetRedirectState;
};

export const getToolsetRedirectUri = () =>
  `${window.location.origin}${Routes.ToolsetSignIn}`;

export const isToolsetSignedIn = (
  toolset: ToolsetModel,
  level = ToolsetCredentialsLevel.GLOBAL,
) => {
  return (
    toolset.authSettings.authStatus?.[level] === ToolsetAuthStatus.SIGNED_IN
  );
};

export const isToolsetEntityModel = (
  entity: MarketplaceEntity,
): entity is ToolsetModel => entity?.type === EntityType.Toolset;

export const addToToolsetsMap = (
  toolsetsMap: ToolsetsMap,
  ...toolsets: ToolsetModel[]
) => {
  toolsets.forEach((toolset) => {
    toolsetsMap[toolset.id] = toolset;
    if (toolset.id !== toolset.reference) {
      toolsetsMap[toolset.reference] = toolset;
    }
  });
  return toolsetsMap;
};

export const deleteFromToolsetsMap = (
  toolsetsMap: ToolsetsMap,
  ...ids: string[]
) => {
  const toolset = ids.map((id) => toolsetsMap[id]).filter(Boolean)[0];
  if (toolset) {
    return omit(toolsetsMap, toolset.reference, toolset.id);
  }
  return toolsetsMap;
};
