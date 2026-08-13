import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { TabModel } from '@epam/ai-dial-ui-kit';
import type { CatalogItem } from '../models/catalog-item';

/**
 * English-language fallback labels for each known entity type.
 * Consuming apps should pass `tabLabels` via `CatalogTitles` for i18n.
 */
const DEFAULT_TAB_LABELS: Record<CatalogEntityType, string> = {
  [CatalogEntityType.Model]: 'Models',
  [CatalogEntityType.Agent]: 'Agents',
  [CatalogEntityType.Toolset]: 'Toolsets',
  [CatalogEntityType.Prompt]: 'Prompts',
  [CatalogEntityType.Skill]: 'Skills',
};

/** Canonical display order for entity type tabs. */
const TAB_ORDER: CatalogEntityType[] = [
  CatalogEntityType.Model,
  CatalogEntityType.Agent,
  CatalogEntityType.Toolset,
  CatalogEntityType.Prompt,
  CatalogEntityType.Skill,
];

/** Derives entity-type tabs from items present in the catalog, sorted by canonical order. */
export const buildCatalogTabs = (
  items: CatalogItem[],
  tabLabels?: Partial<Record<CatalogEntityType, string>>,
): TabModel[] => {
  const labels = { ...DEFAULT_TAB_LABELS, ...tabLabels };
  const presentTypes = new Set(items.map((item) => item.type));
  return TAB_ORDER.filter((type) => presentTypes.has(type)).map((type) => ({
    id: type,
    label: labels[type] ?? type,
  }));
};
