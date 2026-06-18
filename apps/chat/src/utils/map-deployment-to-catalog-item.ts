import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { formatLastUsed, DeploymentItem } from '@epam/ai-dial-chat-shared';
import { resolveCatalogIconUrl } from './icon-path';

const TYPE_MAP: Record<string, CatalogEntityType> = {
  model: CatalogEntityType.Model,
  toolset: CatalogEntityType.Toolset,
  application: CatalogEntityType.Application,
};

export const mapDeploymentToCatalogItem = (
  deployment: DeploymentItem,
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
    pricing: [],
    folder: [],
    from: '',
    domain: '',
    useCase: '',
    maturity: '',
  };
};
