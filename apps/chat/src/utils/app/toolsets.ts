import { isMarketplaceEntityPublic } from '@/src/utils/app/application';
import {
  EntityStorageLimits,
  buildByteAwareFitBaseName,
  getAvailableEntityNameBytes,
  getResourceStorageLimits,
  getStorageSafeUniqueName,
  prepareEntityName,
  truncateToUtf8Bytes,
} from '@/src/utils/app/common';
import { DefaultsService } from '@/src/utils/app/data/defaults-service';
import { constructPath } from '@/src/utils/app/file';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import {
  getEntityBucket,
  getToolsetRootId,
  isEntityIdExternal,
  isMyToolset,
} from '@/src/utils/app/id';
import {
  getLocalizedEntityIdName,
  updateLocalizedEntityIdName,
} from '@/src/utils/app/marketplace-localization';
import { ApiUtils, getMarketplaceEntityApiKey } from '@/src/utils/server/api';
import { ServerUtils } from '@/src/utils/server/server';

import { EntityType, PartialBy, ScreenState } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import {
  ToolsetCredentialsLevel,
  ToolsetInfo,
  ToolsetModel,
  ToolsetRedirectState,
} from '@/src/types/toolsets';

import { DEFAULT_TOOLSET_NAME } from '@/src/constants/default-ui-settings';
import { Routes } from '@/src/constants/routes';
import { ToolsetAuthAction } from '@/src/constants/toolsets';

import {
  SharePermission,
  Toolset,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';
import pickBy from 'lodash-es/pickBy';

const parseToolsetApiAuthStatus = (data?: Toolset) => {
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
      dynamicallyRegistered:
        data.auth_settings?.dynamically_registered ?? false,
      authStatus: parseToolsetApiAuthStatus(data),
      clientId: data.auth_settings.client_id,
      clientSecret: data.auth_settings.client_secret,
      authorizationEndpoint: data.auth_settings.authorization_endpoint,
      // TODO: remove redirectUri after toolset login is stable with new flow (redirectUri will be sent in login request)
      redirectUri: data.auth_settings.redirect_uri,
      apiKeyHeader: data.auth_settings.api_key_header,
      codeChallenge: data.auth_settings.code_challenge,
      codeChallengeMethod: data.auth_settings.code_challenge_method,
      scopesSupported: data.auth_settings.scopes_supported,
      tokenEndpoint: data.auth_settings.token_endpoint,
      tokenEndpointAuthMethod: data.auth_settings.token_endpoint_auth_method,
    },
  };
};

const convertToolsetAuthSettingsToApi = (data: ToolsetModel) => {
  switch (data.authSettings.authenticationType) {
    case ToolsetAuthTypes.API_KEY:
      return {
        authentication_type: data.authSettings.authenticationType,
        api_key_header: data.authSettings.apiKeyHeader,
      };
    case ToolsetAuthTypes.OAUTH:
      return {
        authentication_type: data.authSettings.authenticationType,
        // TODO: remove redirectUri after toolset login is stable with new flow (redirectUri will be sent in login request)
        redirect_uri: data.authSettings.redirectUri,
        ...(data.authSettings.clientId && {
          client_id: data.authSettings.clientId,
        }),
        ...(data.authSettings.clientSecret && {
          client_secret: data.authSettings.clientSecret,
        }),
        ...(data.authSettings.scopesSupported && {
          scopes_supported: data.authSettings.scopesSupported,
        }),
        ...(data.authSettings.tokenEndpoint && {
          token_endpoint: data.authSettings.tokenEndpoint,
        }),
        ...(data.authSettings.tokenEndpointAuthMethod && {
          token_endpoint_auth_method: data.authSettings.tokenEndpointAuthMethod,
        }),
        ...(data.authSettings.authorizationEndpoint && {
          authorization_endpoint: data.authSettings.authorizationEndpoint,
        }),
        ...(data.authSettings.codeChallenge && {
          code_challenge: data.authSettings.codeChallenge,
        }),
        ...(data.authSettings.codeChallengeMethod && {
          code_challenge_method: data.authSettings.codeChallengeMethod,
        }),
        ...(data.authSettings.dynamicallyRegistered && {
          dynamically_registered: data.authSettings.dynamicallyRegistered,
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
  endpoint: data.endpoint?.trim() ?? '',
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

const getGeneratedToolsetId = (
  toolset: PartialBy<ToolsetInfo, 'id' | 'folderId'>,
): string => {
  if (toolset.folderId) {
    return constructPath(toolset.folderId, getMarketplaceEntityApiKey(toolset));
  }

  return constructPath(
    getToolsetRootId(
      toolset.id ? getEntityBucket({ id: toolset.id }) : undefined,
    ),
    getMarketplaceEntityApiKey(toolset),
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

export const getAvailableToolsetNameBytes = (
  toolset: PartialBy<ToolsetInfo, 'id' | 'folderId'>,
  limits: EntityStorageLimits = getResourceStorageLimits(),
): number | undefined =>
  getAvailableEntityNameBytes(
    (name) => getGeneratedToolsetId({ ...toolset, name }),
    (name) => getMarketplaceEntityApiKey({ ...toolset, name }),
    limits,
  );

export const fitToolsetNameToStorageLimits = <
  T extends PartialBy<ToolsetInfo, 'id' | 'folderId'>,
>(
  toolset: T,
  limits: EntityStorageLimits = getResourceStorageLimits(),
): T => {
  const availableNameBytes = getAvailableToolsetNameBytes(toolset, limits);

  if (availableNameBytes === undefined || availableNameBytes <= 0) {
    return toolset;
  }

  const entityIdName = getLocalizedEntityIdName(toolset.name);
  const fittedName = prepareEntityName(
    truncateToUtf8Bytes(prepareEntityName(entityIdName), availableNameBytes),
  );

  return fittedName === entityIdName
    ? toolset
    : (updateLocalizedEntityIdName(toolset, fittedName) as T);
};

export const getStorageSafeUniqueToolsetName = (params: {
  toolset: PartialBy<ToolsetInfo, 'id' | 'folderId'>;
  desiredName?: string;
  defaultName?: string;
  existingNames: string[];
  limits?: EntityStorageLimits;
}): string => {
  const { toolset, desiredName, existingNames } = params;
  const limits = params.limits ?? getResourceStorageLimits();
  const defaultName = params.defaultName ?? DEFAULT_TOOLSET_NAME;

  const availableNameBytes = getAvailableToolsetNameBytes(toolset, limits);

  const uniqueName = getStorageSafeUniqueName({
    desiredName,
    defaultName,
    existingNames,
    fitBaseName: buildByteAwareFitBaseName(availableNameBytes),
  });

  if (uniqueName) {
    return uniqueName;
  }

  return fitToolsetNameToStorageLimits({
    ...toolset,
    name:
      prepareEntityName(desiredName ?? '') || prepareEntityName(defaultName),
  }).name;
};

export const encodeToolsetRedirectState = (
  state: ToolsetRedirectState,
): string => {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const decodeToolsetRedirectState = (
  state: string,
): ToolsetRedirectState => {
  const b64 = state
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(state.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as ToolsetRedirectState;
};

export const getToolsetRedirectUri = () =>
  `${window.location.origin}${Routes.ToolsetSignIn}`;

export const isToolsetWithAuth = (toolset: ToolsetModel) => {
  return (
    toolset.authSettings.authenticationType !== ToolsetAuthTypes.NONE &&
    !(
      toolset.authSettings.authenticationType === ToolsetAuthTypes.API_KEY &&
      !toolset.authSettings.apiKeyHeader
    )
  );
};

export const isToolsetSignedIn = (
  toolset: ToolsetModel,
  level = ToolsetCredentialsLevel.GLOBAL,
) => {
  return (
    toolset.authSettings?.authStatus?.[level] === ToolsetAuthStatus.SIGNED_IN
  );
};

export const isToolsetEntityModel = (
  entity: MarketplaceEntity,
): entity is ToolsetModel => entity?.type === EntityType.Toolset;

export const getToolsetPayload = (
  newToolset: Omit<ToolsetModel, 'id' | 'folderId' | 'reference' | 'type'>,
  oldToolset?: ToolsetModel,
): ToolsetModel => {
  const isEndpointChanged = newToolset.endpoint !== oldToolset?.endpoint;
  const authType = newToolset.authSettings.authenticationType;
  const authSettings: ToolsetModel['authSettings'] = {
    authenticationType: authType,
    ...(oldToolset?.authSettings &&
      !isEndpointChanged &&
      oldToolset.authSettings),
    ...pickBy(newToolset.authSettings, Boolean),
    ...(authType === ToolsetAuthTypes.API_KEY && {
      apiKeyHeader: newToolset.authSettings.apiKeyHeader ?? '',
    }),
    // TODO: remove redirectUri after toolset login is stable with new flow (redirectUri will be sent in login request)
    ...(authType === ToolsetAuthTypes.OAUTH && {
      redirectUri: getToolsetRedirectUri(),
    }),
  };

  return {
    id: '',
    folderId: '',
    reference: '',
    ...(oldToolset && oldToolset),
    type: EntityType.Toolset,
    name: newToolset.name,
    endpoint: newToolset.endpoint,
    iconUrl: newToolset.iconUrl,
    transport: newToolset.transport,
    description: newToolset.description,
    topics: newToolset.topics,
    allowedTools: newToolset.allowedTools,
    version: newToolset.version,
    authSettings,
  };
};

export const getToolsetAuthAction = (
  entity: ToolsetModel,
  isAdmin?: boolean,
) => {
  const isPublic = isMarketplaceEntityPublic(entity);
  const isSignedInGlobal = isToolsetSignedIn(entity);
  const isSignedInUser = isToolsetSignedIn(
    entity,
    ToolsetCredentialsLevel.USER,
  );

  if (isPublic && !isAdmin && !isSignedInUser)
    return ToolsetAuthAction.LoginWithMyCreds;
  if (!isSignedInGlobal && !isSignedInUser) return ToolsetAuthAction.LogIn;

  return ToolsetAuthAction.LogOut;
};

export const getToolsetAuthActionLabel = (
  action: ToolsetAuthAction,
  screenState?: ScreenState,
) => {
  if (
    action === ToolsetAuthAction.LoginWithMyCreds &&
    screenState === ScreenState.SM
  )
    return 'Log in';
  return action as string;
};

export const getToolsetMcpUrl = (id: string) =>
  `${DefaultsService.get('dialCoreExternalUrl')}/v1/toolset/${ServerUtils.encodeSlugs(id.split('/'))}/mcp`;

export const canRepairToolset = (
  toolset?: ToolsetModel,
  isAdmin?: boolean,
  authType?: ToolsetAuthTypes,
): boolean => {
  if (!toolset) return false;

  const isPublicAndAdmin = !!isAdmin && isMarketplaceEntityPublic(toolset);
  const isPrivateAndSignedOut =
    isMyToolset(toolset) && !isToolsetSignedIn(toolset);

  const hasRepairRights =
    isPublicAndAdmin ||
    isPrivateAndSignedOut ||
    !!(
      isEntityIdExternal(toolset) &&
      toolset.sharedWithMe &&
      toolset.permissions?.includes(SharePermission.WRITE)
    );

  return (
    hasRepairRights &&
    !!toolset.authSettings?.dynamicallyRegistered &&
    (authType ?? toolset.authSettings?.authenticationType) ===
      ToolsetAuthTypes.OAUTH
  );
};
