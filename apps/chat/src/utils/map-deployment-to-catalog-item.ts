import {
  CredentialStatus,
  ToolsetAuthenticationType,
  type CatalogItem,
  type CatalogItemCredentials,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentItemDto,
  DialToolsetAuthSettingsDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType, formatLastUsed } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { CatalogI18nKeys } from '../constants/translation-keys';
import type { EntitySpecificDetails } from '../types/entity-details';
import { resolveCatalogIconUrl } from './icon-path';
import { PRIMARY_LOCALE, resolveLocalizedText } from './locale';
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
 *
 * For a non-admin on a public toolset that already has `GLOBAL` credentials
 * signed in, the lib's own `LoginWithMyCreds` CTA fires unconditionally off
 * `isPublic` alone, regardless of whether org-wide credentials already cover
 * everyone (`node_modules/@epam/ai-dial-catalog/dist/index.js`, the `ct`
 * helper). Global auth is sufficient to use the toolset — a personal login
 * is optional, not required — so this suppresses that CTA by reporting
 * `authenticationType: None`, which is the lib's own documented signal to
 * hide the credentials control entirely.
 */
export const mapToolsetCredentials = (
  toolsetId: string,
  authSettings: DialToolsetAuthSettingsDto | undefined,
  isAdmin: boolean,
): CatalogItemCredentials | undefined => {
  if (authSettings == null) return undefined;

  const isPublic = isPublicToolsetId(toolsetId);
  const userStatus = authSettings.userLevelAuthStatus
    ? AUTH_STATUS_MAP[authSettings.userLevelAuthStatus]
    : undefined;
  const globalStatus = authSettings.globalAuthStatus
    ? AUTH_STATUS_MAP[authSettings.globalAuthStatus]
    : undefined;

  const isCoveredByGlobalAuth =
    !isAdmin &&
    isPublic &&
    userStatus !== CredentialStatus.SignedIn &&
    globalStatus === CredentialStatus.SignedIn;

  return {
    authenticationType: isCoveredByGlobalAuth
      ? ToolsetAuthenticationType.None
      : AUTHENTICATION_TYPE_MAP[authSettings.authenticationType],
    userStatus,
    globalStatus,
    isPublic,
    isManageableByAdmin: isAdmin && isPublic,
    apiKeyHeader: authSettings.apiKeyHeader,
  };
};

const TYPE_MAP: Record<string, CatalogEntityType> = {
  model: CatalogEntityType.Model,
  toolset: CatalogEntityType.Toolset,
  application: CatalogEntityType.Agent,
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
  deployment: Pick<
    DeploymentItemDto,
    'isMy' | 'sharedWithMe' | 'applicationFolder'
  >,
  t: TFunction,
): string[] => {
  if (deployment.isMy) {
    return [t(CatalogI18nKeys.FolderPersonal)];
  }

  const segments = stripPrefixSegments(
    deployment.applicationFolder ?? '',
    APPLICATIONS_PREFIX,
  );

  if (deployment.sharedWithMe) {
    return [t(CatalogI18nKeys.FolderShared), ...segments.slice(1)];
  }

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

  if (toolset.sharedWithMe && t != null) {
    return [t(CatalogI18nKeys.FolderShared), ...segments.slice(1)];
  }

  if (segments[0]?.toLowerCase() === PUBLIC_SEGMENT && t != null) {
    return [t(CatalogI18nKeys.FolderPublic), ...segments.slice(1)];
  }

  return segments.slice(1);
};

export interface MapDeploymentToCatalogItemOptions {
  favoriteIds?: ReadonlySet<string>;
  entityDetails?: EntitySpecificDetails;
  t: TFunction;
  editableSchemaIds?: string[];
  isCustomAppsEditable?: boolean;
  activeLocale?: string;
}

export const mapDeploymentToCatalogItem = (
  deployment: DeploymentItemDto,
  {
    favoriteIds = new Set(),
    entityDetails,
    t,
    editableSchemaIds = [],
    isCustomAppsEditable = false,
    activeLocale = PRIMARY_LOCALE,
  }: MapDeploymentToCatalogItemOptions,
): CatalogItem => {
  const name =
    resolveLocalizedText(deployment.displayName, activeLocale) || deployment.id;
  const normalizedType = (deployment.type ?? '').toLowerCase();

  return {
    id: deployment.id,
    type: TYPE_MAP[normalizedType] ?? CatalogEntityType.Model,
    name,
    description: resolveLocalizedText(deployment.description, activeLocale),
    iconUrl: resolveCatalogIconUrl(deployment.iconUrl),
    version: deployment.displayVersion ?? '',
    lastUsed: formatLastUsed(deployment.updatedAt),
    updatedAt: deployment.updatedAt,
    createdAt: deployment.createdAt,
    isFeatured: deployment.isFeatured ?? false,
    isHidden: deployment.isHidden ?? false,
    topics: deployment.topics ?? [],
    isUserFavorite: favoriteIds.has(deployment.id),
    isStarred: favoriteIds.has(deployment.id),
    isMyApp: deployment.isMy ?? false,
    sharedWithMe: deployment.sharedWithMe ?? false,
    isEditable:
      (!!deployment.isMy || !!deployment.canEdit) &&
      ((editableSchemaIds.length > 0 &&
        editableSchemaIds.includes(deployment.applicationTypeSchemaId ?? '')) ||
        (isCustomAppsEditable &&
          !deployment.applicationTypeSchemaId &&
          normalizedType === 'application')),
    folder: resolveDeploymentFolder(deployment, t),
    details:
      entityDetails != null
        ? mapEntityDetailsToCatalogDetails(entityDetails)
        : undefined,
    supportsMcp: deployment.features?.mcp === true,
    supportsChat:
      deployment.interfaces == null || deployment.interfaces.includes('chat'),
  };
};

export interface MapToolsetToCatalogItemOptions {
  favoriteIds?: ReadonlySet<string>;
  isAdmin?: boolean;
  t?: TFunction;
  activeLocale?: string;
}

export const mapToolsetToCatalogItem = (
  toolset: DialToolsetDto,
  {
    favoriteIds = new Set(),
    isAdmin = false,
    t,
    activeLocale = PRIMARY_LOCALE,
  }: MapToolsetToCatalogItemOptions = {},
): CatalogItem => {
  const name =
    resolveLocalizedText(toolset.displayName, activeLocale) ||
    toolset.toolset ||
    toolset.reference ||
    toolset.id;
  const allowedTools = toolset.allowedTools ?? [];

  return {
    id: toolset.id,
    type: CatalogEntityType.Toolset,
    name,
    description: resolveLocalizedText(toolset.description, activeLocale),
    iconUrl: resolveCatalogIconUrl(toolset.iconUrl),
    version: toolset.displayVersion ?? '',
    lastUsed: formatLastUsed(toolset.updatedAt),
    updatedAt: toolset.updatedAt,
    createdAt: toolset.createdAt,
    isFeatured: false,
    isHidden: false,
    topics: toolset.descriptionKeywords ?? [],
    isUserFavorite: favoriteIds.has(toolset.id),
    isStarred: favoriteIds.has(toolset.id),
    isMyApp: toolset.isMy ?? false,
    sharedWithMe: toolset.sharedWithMe ?? false,
    isEditable: !!(toolset.isMy || toolset.canEdit),
    folder: resolveToolsetFolder(toolset, t),
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
