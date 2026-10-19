/**
 * Headless catalog surface: runtime enums and pure catalog-item-mapping
 * functions, with no import of `@epam/ai-dial-publish-panel`,
 * `@epam/ai-dial-react-file-manager`, or any catalog editor/publish UI
 * component. Re-exported from `../index.ts` for backward compatibility —
 * import from here directly to avoid resolving the catalog/publish-panel UI.
 */

// Enums
export {
  CredentialsBadgeState,
  CredentialsBannerState,
  CredentialsLevel,
  CredentialStatus,
  CredentialsUiState,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';
export { CatalogSortKey } from '../types/sort';
export { CatalogDetailsTab } from '../types/detail-tab';

// Models
export type { CatalogItem } from '../models/catalog-item';
export type { CatalogItemCredentials } from '../models/catalog-item-credentials';

// Utils
export { filterCatalogItems, getTopicOptions } from '../utils/catalog-filter';
export { sortCatalogItems } from '../utils/catalog-sort';
export { buildCatalogTabs } from '../utils/catalog-tabs';
export { getCatalogDetailsTabs } from '../utils/details-tabs';
export type { CatalogDetailsTabsOptions } from '../utils/details-tabs';
export {
  getCredentialsBadgeState,
  getCredentialsBannerState,
  getCredentialsUiState,
  getSignedInLevel,
} from '../utils/toolset-credentials';
