import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { CatalogItem } from '../models/catalog-item';
import type { CatalogItemApiDetails } from '../models/item-details-data';
import { CatalogDetailsTab } from '../types/detail-tab';

/*
 * Entity types that lead with their body instead of a description. A prompt's
 * content already carries its description, so an About tab would only repeat
 * it; a skill's listing description is already rendered as the Content tab's
 * summary line, so an About tab would likewise only repeat it. Both open on
 * Content, followed by Overview.
 */
const CONTENT_FIRST_ENTITY_TYPES = new Set<CatalogEntityType>([
  CatalogEntityType.Prompt,
  CatalogEntityType.Skill,
]);

/**
 * An item is worth a Connect tab only when its api data names something to
 * connect to — a single endpoint URL or a non-empty multi-endpoint list (e.g.
 * a model's Chat Completions/Responses endpoints). A resource identifier
 * alone (a model's `modelId` with no endpoints) has nothing to connect to.
 */
export const hasConnectableApi = (
  api: CatalogItemApiDetails | undefined,
): api is CatalogItemApiDetails =>
  api?.resource?.endpointUrl != null || (api?.endpoints?.length ?? 0) > 0;

/** Options for {@link getCatalogDetailsTabs}. */
export interface CatalogDetailsTabsOptions {
  /**
   * Leaves out the Connect tab, for hosts whose users are not API consumers
   * (e.g. an app editor embedding the details content). Default: `false`.
   */
  isConnectHidden?: boolean;
}

/**
 * The details tabs an item shows, in display order — the rule `DetailsPanel`
 * renders by, exported so a host embedding the tab components in its own
 * surface shows exactly the same set. Pure and string-free: the caller pairs
 * each id with its own label.
 */
export const getCatalogDetailsTabs = (
  item: CatalogItem,
  options: CatalogDetailsTabsOptions = {},
): CatalogDetailsTab[] => {
  const tabs: CatalogDetailsTab[] = [];
  const isContentFirst = CONTENT_FIRST_ENTITY_TYPES.has(item.type);
  const details = item.details;

  if (!isContentFirst) tabs.push(CatalogDetailsTab.About);
  /*
   * A content-first entity keeps its Content tab even before a body arrives
   * (or when it has none), so the tab it opens on never shifts as details
   * resolve.
   */
  if (isContentFirst || details?.promptContent != null)
    tabs.push(CatalogDetailsTab.Content);
  if (details?.overview != null) tabs.push(CatalogDetailsTab.Overview);
  if (details?.pricing != null) tabs.push(CatalogDetailsTab.Pricing);
  if (details?.limits != null) tabs.push(CatalogDetailsTab.Limits);
  if (details?.tools != null) tabs.push(CatalogDetailsTab.Tools);
  /*
   * Connect is pushed last, after every other tab, regardless of type. It
   * needs a connectable endpoint to be worth showing.
   */
  if (!options.isConnectHidden && hasConnectableApi(details?.api)) {
    tabs.push(CatalogDetailsTab.Api);
  }
  return tabs;
};
