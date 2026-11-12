import {
  toPublishEntityType,
  useVersionHistory,
} from '@epam/ai-dial-chat-hooks';
import type { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { VersionHistorySectionProps } from '@epam/ai-dial-publish-panel';
import { useMemo } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';
import { publishApiClient } from '../../server-api/publish.api';
import { isVersionedCatalogEntityType } from '../../utils/version-history';
import { useVersionHistoryText } from './useVersionHistoryText';

/**
 * Builds the props of the Versions history section for an application or toolset, from the deployments and toolsets already loaded in the app.
 * @param resourceId - id of the resource being edited or published
 * @param resourceType - catalog type of the resource
 * @param isEnabled - whether the panel showing the section is open
 * @returns the section props, or `undefined` for an unversioned resource type
 */
export const useResourceVersionHistory = (
  resourceId: string,
  resourceType: CatalogEntityType,
  isEnabled: boolean,
): VersionHistorySectionProps | undefined => {
  const { items, toolsets } = useDeployments();
  const { labels, formatters } = useVersionHistoryText();
  const isVersioned = isVersionedCatalogEntityType(resourceType);
  const entityType = toPublishEntityType(resourceType) ?? 'application';
  const { rows, isLoading, hasError, onRetry } = useVersionHistory({
    items: entityType === 'toolset' ? toolsets : items,
    resourceId,
    entityType,
    isEnabled: isEnabled && isVersioned,
    client: publishApiClient,
    formatters,
  });

  return useMemo(
    () =>
      isVersioned ? { rows, isLoading, hasError, onRetry, labels } : undefined,
    [isVersioned, rows, isLoading, hasError, onRetry, labels],
  );
};
