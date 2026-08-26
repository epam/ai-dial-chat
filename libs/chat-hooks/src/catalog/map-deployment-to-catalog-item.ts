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
import { resolveLocalizedText } from '../shared/locale';
import { safeDecodeURIComponent } from '../shared/string-utils';
import type { EntitySpecificDetails } from './entity-details';
import { mapEntityDetailsToCatalogDetails } from './map-entity-details-to-catalog';

/** `toolsetId` prefix identifying a DIAL toolset resource. */
const TOOLSETS_ID_PREFIX = 'toolsets/';
/** Bucket segment marking a toolset as shared org-wide rather than personal. */
const PUBLIC_BUCKET_SEGMENT = 'public';

/*
 * Private duplicate of `apps/chat/src/utils/toolsets.ts`'s `isPublicToolsetId`
 * — that file is host-owned (session/OAuth/window flow) and stays app-owned,
 * so this 4-line pure check is copied rather than importing the whole file.
 */
const isPublicToolsetId = (toolsetId: string): boolean => {
  if (!toolsetId.startsWith(TOOLSETS_ID_PREFIX)) return false;
  const bucket = toolsetId.slice(TOOLSETS_ID_PREFIX.length).split('/')[0];
  return bucket === PUBLIC_BUCKET_SEGMENT;
};

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
 * Maps a toolset's auth settings (from a deployment listing row) into the
 * lib's credential-status shape, including both `USER` and `GLOBAL` sign-in
 * status, whether the toolset is public, and whether the current user (if an
 * admin) may manage both levels. Named apart from
 * `map-entity-details-to-catalog.ts`'s `mapToolsetCredentials` (a different
 * input shape, `ToolsetEntityDetails`) to avoid an ambiguous `export *`
 * collision between the two modules.
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
export const mapDeploymentToolsetCredentials = (
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
  const authenticationType = isCoveredByGlobalAuth
    ? ToolsetAuthenticationType.None
    : AUTHENTICATION_TYPE_MAP[authSettings.authenticationType];

  return {
    authenticationType,
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

/** Translated folder-path labels for the Personal/Shared/Public deployment groupings. */
export interface DeploymentFolderLabels {
  personal: string;
  shared: string;
  public: string;
}

export const resolveDeploymentFolder = (
  deployment: Pick<
    DeploymentItemDto,
    'isMy' | 'sharedWithMe' | 'applicationFolder'
  >,
  labels: DeploymentFolderLabels,
): string[] => {
  if (deployment.isMy) {
    return [labels.personal];
  }

  const segments = stripPrefixSegments(
    deployment.applicationFolder ?? '',
    APPLICATIONS_PREFIX,
  );

  if (deployment.sharedWithMe) {
    return [labels.shared, ...segments.slice(1)];
  }

  if (segments[0]?.toLowerCase() === PUBLIC_SEGMENT) {
    return [labels.public, ...segments.slice(1)];
  }

  return segments;
};

const resolveToolsetFolder = (
  toolset: DialToolsetDto,
  labels?: DeploymentFolderLabels,
): string[] => {
  if (toolset.isMy && labels != null) {
    return [labels.personal];
  }

  const raw = toolset.toolset || toolset.id;
  if (!raw.startsWith(TOOLSETS_PREFIX)) {
    return [];
  }

  const segments = stripPrefixSegments(raw, TOOLSETS_PREFIX).slice(0, -1);

  if (toolset.sharedWithMe && labels != null) {
    return [labels.shared, ...segments.slice(1)];
  }

  if (segments[0]?.toLowerCase() === PUBLIC_SEGMENT && labels != null) {
    return [labels.public, ...segments.slice(1)];
  }

  return segments.slice(1);
};

/** Parameters for {@link mapDeploymentToCatalogItem}. */
export interface MapDeploymentToCatalogItemOptions {
  favoriteIds?: ReadonlySet<string>;
  entityDetails?: EntitySpecificDetails;
  folderLabels: DeploymentFolderLabels;
  editableSchemaIds?: string[];
  isCustomAppsEditable?: boolean;
  /** The viewer's active display locale, used to resolve `displayName`/`description`. */
  activeLocale: string;
  /** The fixed content language `displayName`/`description` fall back to when `activeLocale` has no entry. */
  primaryLocale: string;
  /** Resolves a deployment's raw `iconUrl` to a displayable URL. Host-owned. */
  resolveIconUrl: (iconUrl: string | undefined) => string | undefined;
}

/** Maps a deployment listing row into the catalog UI's `CatalogItem` shape. */
export const mapDeploymentToCatalogItem = (
  deployment: DeploymentItemDto,
  {
    favoriteIds = new Set(),
    entityDetails,
    folderLabels,
    editableSchemaIds = [],
    isCustomAppsEditable = false,
    activeLocale,
    primaryLocale,
    resolveIconUrl,
  }: MapDeploymentToCatalogItemOptions,
): CatalogItem => {
  const name =
    resolveLocalizedText(deployment.displayName, activeLocale, primaryLocale) ||
    deployment.id;
  const normalizedType = (deployment.type ?? '').toLowerCase();

  return {
    id: deployment.id,
    type: TYPE_MAP[normalizedType] ?? CatalogEntityType.Model,
    name,
    description: resolveLocalizedText(
      deployment.description,
      activeLocale,
      primaryLocale,
    ),
    iconUrl: resolveIconUrl(deployment.iconUrl),
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
    folder: resolveDeploymentFolder(deployment, folderLabels),
    details:
      entityDetails != null
        ? mapEntityDetailsToCatalogDetails(entityDetails)
        : undefined,
    supportsMcp: deployment.features?.mcp === true,
    supportsChat:
      deployment.interfaces == null || deployment.interfaces.includes('chat'),
  };
};

/** Parameters for {@link mapToolsetToCatalogItem}. */
export interface MapToolsetToCatalogItemOptions {
  favoriteIds?: ReadonlySet<string>;
  isAdmin?: boolean;
  folderLabels?: DeploymentFolderLabels;
  /** The viewer's active display locale, used to resolve `displayName`/`description`. */
  activeLocale: string;
  /** The fixed content language `displayName`/`description` fall back to when `activeLocale` has no entry. */
  primaryLocale: string;
  /** Resolves a toolset's raw `iconUrl` to a displayable URL. Host-owned. */
  resolveIconUrl: (iconUrl: string | undefined) => string | undefined;
}

/** Maps a toolset listing row into the catalog UI's `CatalogItem` shape. */
export const mapToolsetToCatalogItem = (
  toolset: DialToolsetDto,
  {
    favoriteIds = new Set(),
    isAdmin = false,
    folderLabels,
    activeLocale,
    primaryLocale,
    resolveIconUrl,
  }: MapToolsetToCatalogItemOptions,
): CatalogItem => {
  const name =
    resolveLocalizedText(toolset.displayName, activeLocale, primaryLocale) ||
    toolset.toolset ||
    toolset.reference ||
    toolset.id;
  const allowedTools = toolset.allowedTools ?? [];

  return {
    id: toolset.id,
    type: CatalogEntityType.Toolset,
    name,
    description: resolveLocalizedText(
      toolset.description,
      activeLocale,
      primaryLocale,
    ),
    iconUrl: resolveIconUrl(toolset.iconUrl),
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
    folder: resolveToolsetFolder(toolset, folderLabels),
    credentials: mapDeploymentToolsetCredentials(
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
