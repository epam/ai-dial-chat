import {
  CatalogEntityType,
  CredentialStatus,
  ToolsetAuthenticationType,
  type CatalogItem,
  type CatalogItemCredentials,
} from '@epam/ai-dial-catalog';
import { formatLastUsed } from '@epam/ai-dial-chat-shared';
import type {
  DeploymentItemDto,
  DialToolsetAuthSettingsDto,
  DialToolsetDto,
} from '@epam/chat-api-client';
import type { TFunction } from 'i18next';
import { CatalogI18nKeys } from '../constants/translation-keys';
import type { EntitySpecificDetails } from '../types/entity-details';
import { resolveCatalogIconUrl } from './icon-path';
import { mapEntityDetailsToCatalogDetails } from './map-entity-details-to-catalog';
import { safeDecodeURIComponent } from './string-utils';
import { isPublicToolsetId } from './toolsets';

const AUTHENTICATION_TYPE_MAP: Record<
  DialToolsetAuthSettingsDto['authenticationType'],
  ToolsetAuthenticationType
> = {
  NONE: ToolsetAuthenticationType.None,
  API_KEY: ToolsetAuthenticationType.ApiKey,
  OAUTH: ToolsetAuthenticationType.OAuth,
};

const AUTH_STATUS_MAP: Record<string, CredentialStatus> = {
  SIGNED_IN: CredentialStatus.SignedIn,
  SIGNED_OUT: CredentialStatus.SignedOut,
  FAILED: CredentialStatus.Failed,
};

/**
 * Maps a toolset's auth settings into the lib's credential-status shape,
 * including both `USER` and `GLOBAL` sign-in status, whether the toolset is
 * public, and whether the current user (if an admin) may manage both levels.
 */
export const mapToolsetCredentials = (
  toolsetId: string,
  authSettings: DialToolsetAuthSettingsDto | undefined,
  isAdmin: boolean,
): CatalogItemCredentials | undefined => {
  if (authSettings == null) return undefined;

  const isPublic = isPublicToolsetId(toolsetId);

  return {
    authenticationType:
      AUTHENTICATION_TYPE_MAP[authSettings.authenticationType],
    userStatus: authSettings.userLevelAuthStatus
      ? AUTH_STATUS_MAP[authSettings.userLevelAuthStatus]
      : undefined,
    globalStatus: authSettings.globalAuthStatus
      ? AUTH_STATUS_MAP[authSettings.globalAuthStatus]
      : undefined,
    isPublic,
    isManageableByAdmin: isAdmin && isPublic,
    apiKeyHeader: authSettings.apiKeyHeader,
  };
};

const TYPE_MAP: Record<string, CatalogEntityType> = {
  model: CatalogEntityType.Model,
  toolset: CatalogEntityType.Toolset,
  application: CatalogEntityType.Application,
};

const APPLICATIONS_PREFIX = 'applications/';
const TOOLSETS_PREFIX = 'toolsets/';
const PUBLIC_SEGMENT = 'public';

const stripPrefixSegments = (raw: string, prefix: string): string[] =>
  (raw.startsWith(prefix) ? raw.slice(prefix.length) : raw)
    .split('/')
    .filter(Boolean)
    .map(safeDecodeURIComponent);

export const resolveDeploymentFolder = (
  deployment: Pick<DeploymentItemDto, 'isMy' | 'applicationFolder'>,
  t: TFunction,
): string[] => {
  if (deployment.isMy) {
    return [t(CatalogI18nKeys.FolderPersonal)];
  }

  const segments = stripPrefixSegments(
    deployment.applicationFolder ?? '',
    APPLICATIONS_PREFIX,
  );

  if (segments[0]?.toLowerCase() === PUBLIC_SEGMENT) {
    return [t(CatalogI18nKeys.FolderPublic), ...segments.slice(1)];
  }

  return segments;
};

const resolveToolsetFolder = (
  toolset: DialToolsetDto,
  t?: TFunction,
): string[] => {
  if (toolset.isMy && t != null) {
    return [t(CatalogI18nKeys.FolderPersonal)];
  }

  const raw = toolset.toolset || toolset.id;
  if (!raw.startsWith(TOOLSETS_PREFIX)) {
    return [];
  }

  const segments = stripPrefixSegments(raw, TOOLSETS_PREFIX).slice(0, -1);

  if (segments[0]?.toLowerCase() === PUBLIC_SEGMENT && t != null) {
    return [t(CatalogI18nKeys.FolderPublic), ...segments.slice(1)];
  }

  return segments.slice(1);
};

export const mapDeploymentToCatalogItem = (
  deployment: DeploymentItemDto,
  favoriteIds: ReadonlySet<string> = new Set(),
  entityDetails?: EntitySpecificDetails,
  t?: TFunction,
  editableSchemaId?: string,
): CatalogItem => {
  const name = deployment.displayName ?? deployment.id;
  const normalizedType = (deployment.type ?? '').toLowerCase();

  return {
    id: deployment.id,
    type: TYPE_MAP[normalizedType] ?? CatalogEntityType.Model,
    name,
    description: deployment.description ?? '',
    intro: deployment.intro,
    iconUrl: resolveCatalogIconUrl(deployment.iconUrl),
    version: deployment.displayVersion ?? '',
    lastUsed: formatLastUsed(deployment.updatedAt),
    updatedAt: deployment.updatedAt,
    isFeatured: deployment.isFeatured ?? false,
    isHidden: deployment.isHidden ?? false,
    topics: deployment.topics ?? [],
    isUserFavorite: favoriteIds.has(deployment.id),
    isStarred: favoriteIds.has(deployment.id),
    isMyApp: deployment.isMy ?? false,
    isEditable:
      (!!deployment.isMy || !!deployment.canEdit) &&
      !!editableSchemaId &&
      deployment.applicationTypeSchemaId === editableSchemaId,
    folder:
      t != null
        ? resolveDeploymentFolder(deployment, t)
        : (deployment.applicationFolder?.split('/') ?? []),
    summary: undefined,
    details:
      entityDetails != null
        ? mapEntityDetailsToCatalogDetails(entityDetails)
        : undefined,
  };
};

export const mapToolsetToCatalogItem = (
  toolset: DialToolsetDto,
  favoriteIds: ReadonlySet<string> = new Set(),
  isAdmin = false,
  t?: TFunction,
): CatalogItem => {
  const name =
    toolset.displayName ?? toolset.toolset ?? toolset.reference ?? toolset.id;
  const allowedTools = toolset.allowedTools ?? [];

  return {
    id: toolset.id,
    type: CatalogEntityType.Toolset,
    name,
    description: toolset.description ?? '',
    intro: toolset.intro,
    iconUrl: resolveCatalogIconUrl(toolset.iconUrl),
    version: toolset.displayVersion ?? '',
    lastUsed: formatLastUsed(toolset.updatedAt),
    updatedAt: toolset.updatedAt,
    isFeatured: false,
    isHidden: false,
    topics: toolset.descriptionKeywords ?? [],
    isUserFavorite: favoriteIds.has(toolset.id),
    isStarred: favoriteIds.has(toolset.id),
    isMyApp: toolset.isMy ?? false,
    isEditable: !!(toolset.isMy || toolset.canEdit),
    folder: resolveToolsetFolder(toolset, t),
    summary: undefined,
    credentials: mapToolsetCredentials(
      toolset.id,
      toolset.authSettings,
      isAdmin,
    ),
    details:
      allowedTools.length > 0
        ? {
            tools: {
              tools: allowedTools.map((tool) => ({ name: tool })),
            },
          }
        : undefined,
  };
};
