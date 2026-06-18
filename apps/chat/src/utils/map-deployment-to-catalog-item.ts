import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import type { DeploymentItem } from '@epam/ai-dial-chat-shared';

const TYPE_MAP: Record<string, CatalogEntityType> = {
  model: CatalogEntityType.Model,
  toolset: CatalogEntityType.Toolset,
  application: CatalogEntityType.Model,
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
    iconUrl: deployment.iconUrl,
    pricing: [],
    folder: [],
    version: '',
    lastUsed: '',
    logoColor: '',
    from: '',
    domain: '',
    useCase: '',
    maturity: '',
  };
};
