import type { CatalogSortOption } from '../models/CatalogItem';
import { CatalogSortKey } from '../types/CatalogSortKey';

/** Default maturity stage options for the Maturity dropdown filter. */
export const DEFAULT_MATURITY_OPTIONS: string[] = [
  'Experimental',
  'Beta',
  'Production',
  'Deprecated',
];

/** Default use-case options for the Use Case dropdown filter. */
export const DEFAULT_USE_CASE_OPTIONS: string[] = [
  'Code review',
  'Code generation',
  'Document processing',
  'Summarization',
  'Data extraction',
  'Question answering',
  'Image generation',
  'Content moderation',
  'Workflow automation',
  'Research&Analysis',
  'Translation',
  'Classification',
];

/** Default domain options for the Domain dropdown filter. */
export const DEFAULT_DOMAIN_OPTIONS: string[] = [
  'Engineering',
  'Research',
  'Finance',
  'Design',
  'Sales&Marketing',
  'Customer Support',
  'HR&People Ops',
  'Legal&Compliance',
  'Data&Analytics',
  'Operations',
];

/** Default sort options for the browse toolbar. */
export const DEFAULT_SORT_OPTIONS: CatalogSortOption[] = [
  { value: CatalogSortKey.RecentlyUpdated, label: 'Recently Updated' },
  { value: CatalogSortKey.Newest, label: 'Newest' },
  { value: CatalogSortKey.NameAZ, label: 'Name A-Z' },
];
