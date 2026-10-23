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
  CatalogEntityType.Skill,
  CatalogEntityType.Prompt,
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

/** Scrolls a horizontally scrolling tab row just enough to bring its selected tab fully into view. */
export const scrollSelectedTabIntoView = (row: HTMLElement): void => {
  const tab = row.querySelector<HTMLElement>(
    '[role="tab"][aria-selected="true"]',
  );
  if (tab == null) return;
  /* Rect deltas rather than `scrollIntoView`, which would also scroll the
     page vertically; deltas hold in RTL too, whatever sign `scrollLeft` has. */
  const rowRect = row.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  const style = getComputedStyle(row);
  const startGap = parseFloat(style.paddingInlineStart) || 0;
  const endGap = parseFloat(style.paddingInlineEnd) || 0;
  if (tabRect.left < rowRect.left + startGap) {
    row.scrollLeft -= rowRect.left + startGap - tabRect.left;
  } else if (tabRect.right > rowRect.right - endGap) {
    row.scrollLeft += tabRect.right - (rowRect.right - endGap);
  }
};

/** Returns a tab-dependent text: the string itself, or the callback's result for `activeTab`. */
export const resolveTabText = (
  text: string | ((activeTab: string) => string) | undefined,
  activeTab: string,
): string | undefined => (typeof text === 'function' ? text(activeTab) : text);
