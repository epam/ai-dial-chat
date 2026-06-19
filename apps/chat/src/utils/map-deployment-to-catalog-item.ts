import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { formatLastUsed } from '@epam/ai-dial-chat-shared';
import type { DeploymentItemDto } from '@epam/chat-api-client';
import { resolveCatalogIconUrl } from './icon-path';

const TYPE_MAP: Record<string, CatalogEntityType> = {
  model: CatalogEntityType.Model,
  toolset: CatalogEntityType.Toolset,
  application: CatalogEntityType.Model,
};

export const mapDeploymentToCatalogItem = (
  deployment: DeploymentItemDto,
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
    isUserFavorite: deployment.isInstalled ?? false,
    pricing: [],
    folder: [],
  };
};
