import type { VersionStatusEntryDto } from '@epam/ai-dial-chat-api-client';
import type { VersionHistoryRow } from '@epam/ai-dial-publish-panel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeDecodeURIComponent } from '../../shared/string-utils';
import type { PublishApiClient } from '../create-publish-api';
import type { CatalogPublishEntityType } from '../publish';
import {
  buildVersionHistoryRows,
  selectVersionGroup,
  type VersionHistoryFormatters,
  type VersionHistoryListingItem,
} from '../version-history';

/** Parameters of {@link useVersionHistory}. */
export interface UseVersionHistoryParams {
  /** Items of the already-loaded deployments or toolsets listing. */
  items: readonly VersionHistoryListingItem[];
  /** Id of the resource being edited or published. */
  resourceId: string;
  /** Publish API entity type of the resource. */
  entityType: CatalogPublishEntityType;
  /** Whether the panel showing the history is open; statuses load only while it is. */
  isEnabled: boolean;
  /** Configured client that reads the version statuses. */
  client: Pick<PublishApiClient, 'getCatalogVersionStatuses'>;
  /** Host text and date formatting; keep it referentially stable. */
  formatters: VersionHistoryFormatters;
}

/** Result of {@link useVersionHistory}. */
export interface UseVersionHistoryResult {
  /** Saved versions of the resource, newest first; statuses fill in once loaded. */
  rows: VersionHistoryRow[];
  /** Whether the statuses are being loaded. */
  isLoading: boolean;
  /** Whether the last statuses request failed. */
  hasError: boolean;
  /** Reloads the statuses. */
  onRetry: () => void;
}

interface LoadedStatuses {
  key: string;
  statuses: ReadonlyMap<string, VersionStatusEntryDto>;
}

/**
 * Groups the listing by `versionGroupId`, builds the Versions history rows and loads their publication statuses in the background while the panel is open.
 * @param params - listing items, edited resource, open state, client and formatters
 */
export const useVersionHistory = ({
  items,
  resourceId,
  entityType,
  isEnabled,
  client,
  formatters,
}: UseVersionHistoryParams): UseVersionHistoryResult => {
  const group = useMemo(
    () => selectVersionGroup(items, resourceId),
    [items, resourceId],
  );
  const hasVersions = group.length > 0;
  const [reloadCount, setReloadCount] = useState(0);
  const [loaded, setLoaded] = useState<LoadedStatuses>();
  const [failedKey, setFailedKey] = useState<string>();
  const requestKey = `${entityType}:${resourceId}:${reloadCount}`;
  const shouldLoad = isEnabled && hasVersions;

  useEffect(() => {
    if (!shouldLoad) return;
    let isCancelled = false;
    const load = async () => {
      try {
        const entries = await client.getCatalogVersionStatuses(
          entityType,
          resourceId,
        );
        if (isCancelled) return;
        setLoaded({
          key: requestKey,
          statuses: new Map(
            entries.map((entry) => [safeDecodeURIComponent(entry.id), entry]),
          ),
        });
        setFailedKey(undefined);
      } catch {
        if (!isCancelled) setFailedKey(requestKey);
      }
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [shouldLoad, client, entityType, resourceId, requestKey]);

  const rows = useMemo(
    () =>
      buildVersionHistoryRows(group, resourceId, loaded?.statuses, formatters),
    [group, resourceId, loaded, formatters],
  );
  const hasError = shouldLoad && failedKey === requestKey;
  const isLoading = shouldLoad && !hasError && loaded?.key !== requestKey;
  const onRetry = useCallback(() => {
    setFailedKey(undefined);
    setReloadCount((count) => count + 1);
  }, []);

  return { rows, isLoading, hasError, onRetry };
};
