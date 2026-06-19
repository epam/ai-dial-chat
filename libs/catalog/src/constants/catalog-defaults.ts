import type { CatalogSortOption } from '../models/sort';
import { CatalogSortKey } from '../types/sort';

/** Default sort options for the browse toolbar. */
export const DEFAULT_SORT_OPTIONS: CatalogSortOption[] = [
  { value: CatalogSortKey.RecentlyUpdated, label: 'Recently Updated' },
  { value: CatalogSortKey.Newest, label: 'Newest' },
  { value: CatalogSortKey.NameAZ, label: 'Name A-Z' },
];
