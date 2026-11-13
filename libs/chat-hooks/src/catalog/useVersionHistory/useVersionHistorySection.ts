import type { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type {
  VersionHistoryLabels,
  VersionHistorySectionProps,
} from '@epam/ai-dial-publish-panel';
import { useMemo } from 'react';
import { isVersionedCatalogEntityType, toPublishEntityType } from '../publish';
import type {
  VersionHistoryFormatters,
  VersionHistoryListingItem,
} from '../version-history';
import {
  useVersionHistory,
  type UseVersionHistoryParams,
} from './useVersionHistory';

/** Parameters of {@link useVersionHistorySection}. */
export interface UseVersionHistorySectionParams {
  /** Id of the resource being edited or published. */
  resourceId: string;
  /** Catalog type of the resource. */
  resourceType: CatalogEntityType;
  /** Whether the panel showing the section is open; statuses load only while it is. */
  isEnabled: boolean;
  /** Items of the already-loaded deployments listing, used for applications. */
  applications: readonly VersionHistoryListingItem[];
  /** Items of the already-loaded toolsets listing, used for toolsets. */
  toolsets: readonly VersionHistoryListingItem[];
  /** Configured client that reads the version statuses. */
  client: UseVersionHistoryParams['client'];
  /** Translated section labels, from the host. */
  labels: VersionHistoryLabels;
  /** Host text and date formatting; keep it referentially stable. */
  formatters: VersionHistoryFormatters;
}

/**
 * Builds the props of the Versions history section for an application or toolset from the listings the host already holds.
 * @param params - listings, edited resource, open state, client, labels and formatters
 * @returns the section props, or `undefined` for an unversioned resource type and while the listing holds no version the user owns
 */
export const useVersionHistorySection = ({
  resourceId,
  resourceType,
  isEnabled,
  applications,
  toolsets,
  client,
  labels,
  formatters,
}: UseVersionHistorySectionParams): VersionHistorySectionProps | undefined => {
  const isVersioned = isVersionedCatalogEntityType(resourceType);
  const entityType = toPublishEntityType(resourceType) ?? 'application';
  const { rows, hasVersions, isLoading, hasError, onRetry } = useVersionHistory(
    {
      items: entityType === 'toolset' ? toolsets : applications,
      resourceId,
      entityType,
      isEnabled: isEnabled && isVersioned,
      client,
      formatters,
    },
  );

  return useMemo(
    () =>
      isVersioned && hasVersions
        ? { rows, isLoading, hasError, onRetry, labels }
        : undefined,
    [isVersioned, hasVersions, rows, isLoading, hasError, onRetry, labels],
  );
};
