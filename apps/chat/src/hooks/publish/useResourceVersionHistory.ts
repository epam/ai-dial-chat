import { useVersionHistorySection } from '@epam/ai-dial-chat-hooks';
import type { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { VersionHistorySectionProps } from '@epam/ai-dial-publish-panel';
import { useDeployments } from '../../context/DeploymentsContext';
import { publishApiClient } from '../../server-api/publish.api';
import { useVersionHistoryText } from './useVersionHistoryText';

/**
 * Builds the props of the Versions history section for an application or toolset, from the deployments and toolsets already loaded in the app.
 * @param resourceId - id of the resource being edited or published
 * @param resourceType - catalog type of the resource
 * @param isEnabled - whether the panel showing the section is open
 * @returns the section props, or `undefined` for an unversioned resource type and while the listing holds no version the user owns
 */
export const useResourceVersionHistory = (
  resourceId: string,
  resourceType: CatalogEntityType,
  isEnabled: boolean,
): VersionHistorySectionProps | undefined => {
  const { items, toolsets } = useDeployments();
  const { labels, formatters } = useVersionHistoryText();
  return useVersionHistorySection({
    resourceId,
    resourceType,
    isEnabled,
    applications: items,
    toolsets,
    client: publishApiClient,
    labels,
    formatters,
  });
};
