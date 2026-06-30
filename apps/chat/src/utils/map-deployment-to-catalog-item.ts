import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { formatLastUsed } from '@epam/ai-dial-chat-shared';
import type { DeploymentItemDto } from '@epam/chat-api-client';
import type { TFunction } from 'i18next';
import { CatalogI18nKeys } from '../constants/translation-keys';
import type { EntitySpecificDetails } from '../types/entity-details';
import { resolveCatalogIconUrl } from './icon-path';
import { mapEntityDetailsToCatalogDetails } from './map-entity-details-to-catalog';
import { safeDecodeURIComponent } from './string-utils';

const TYPE_MAP: Record<string, CatalogEntityType> = {
  model: CatalogEntityType.Model,
  toolset: CatalogEntityType.Toolset,
  application: CatalogEntityType.Application,
};

const APPLICATIONS_PREFIX = 'applications/';
const PUBLIC_SEGMENT = 'public';

export const resolveDeploymentFolder = (
  deployment: Pick<DeploymentItemDto, 'isMy' | 'applicationFolder'>,
  t: TFunction,
): string[] => {
  if (deployment.isMy) {
    return [t(CatalogI18nKeys.FolderPersonal)];
  }

  const raw = deployment.applicationFolder ?? '';
  const path = raw.startsWith(APPLICATIONS_PREFIX)
    ? raw.slice(APPLICATIONS_PREFIX.length)
    : raw;

  const segments = path.split('/').filter(Boolean).map(safeDecodeURIComponent);

  if (segments[0]?.toLowerCase() === PUBLIC_SEGMENT) {
    return [t(CatalogI18nKeys.FolderPublic), ...segments.slice(1)];
  }

  return segments;
};

export const mapDeploymentToCatalogItem = (
  deployment: DeploymentItemDto,
  favoriteIds: ReadonlySet<string> = new Set(),
  entityDetails?: EntitySpecificDetails, // TODO: need?
  t?: TFunction,
): CatalogItem => {
  const name = deployment.displayName ?? deployment.id;
  const normalizedType = (deployment.type ?? '').toLowerCase();

  return {
    id: deployment.id,
    type: TYPE_MAP[normalizedType] ?? CatalogEntityType.Model,
    name,
    description: deployment.description ?? '',
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
