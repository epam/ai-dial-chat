import type { TabModel } from '@epam/ai-dial-ui-kit';
import type { CatalogItem } from '../models/catalog-item';
import type { CatalogTitles } from '../models/catalog-props';
import { CatalogEntityType } from '../types/entity-type';

const DEFAULT_TAB_LABELS: Record<CatalogEntityType, string> = {
  [CatalogEntityType.Model]: 'Models',
  [CatalogEntityType.Agent]: 'Agents',
  [CatalogEntityType.Toolset]: 'Toolsets',
  [CatalogEntityType.Guardrail]: 'Guardrails',
  [CatalogEntityType.Skill]: 'Skills',
  [CatalogEntityType.Mcp]: 'MCP',
};

/** Derives entity-type tabs from items present in the catalog. */
export const buildCatalogTabs = (
  items: CatalogItem[],
  tabLabels?: CatalogTitles['tabLabels'],
): TabModel[] => {
  const labels = { ...DEFAULT_TAB_LABELS, ...tabLabels };
  const presentTypes = [
    ...new Set(items.map((item) => item.type)),
  ] as CatalogEntityType[];
  return presentTypes.map((type) => ({ id: type, label: labels[type] }));
};
