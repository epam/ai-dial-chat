import type {
  ConversationListItemDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import { FilterTab } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { findDeploymentByIdOrReference } from '../../catalog/deployment-id';
import { safeDecodeURIComponent } from '../../shared/string-utils';
import { getModelIdFromConversationId } from '../get-model-id-from-conversation-id';

/**
 * Classifies a conversation's ownership using the shared filter-tab contract.
 */
export const getConversationSource = (
  item: Pick<ConversationListItemDto, 'sharedWithMe' | 'publishedWithMe'>,
): FilterTab => {
  if (item.sharedWithMe) return FilterTab.Shared;
  if (item.publishedWithMe) return FilterTab.Organization;
  return FilterTab.MyChats;
};

/** Resolver callbacks injected by the host app into `useConversationPanelItems`. */
export interface UseConversationPanelItemsResolvers {
  /** Converts a raw conversation id to the panel-space id. App-specific. */
  toPanelConversationId: (id: string) => string;
  /** Resolves the icon URL for a deployment. Returns `undefined` when not available. */
  resolveIconUrl: (
    deployment: DeploymentItemDto | undefined,
  ) => string | undefined;
  /**
   * Resolves the icon tooltip text. Receives the matched deployment (or
   * `undefined`) and a decoded fallback string derived from the model path.
   */
  resolveIconTooltip: (
    deployment: DeploymentItemDto | undefined,
    fallback: string,
  ) => string | undefined;
  /** Resolves the href to navigate to when the conversation row is clicked. */
  resolveHref: (panelConversationId: string) => string;
  /**
   * Returns badge metadata for a scheduled-task conversation, or `undefined`
   * when the item should not show a task badge.
   */
  resolveTaskBadge?: (
    item: ConversationListItemDto,
  ) => { label: string; isUnread: boolean } | undefined;
}

/** Parameters accepted by `useConversationPanelItems`. */
export interface UseConversationPanelItemsParams extends UseConversationPanelItemsResolvers {
  /** Raw conversation list from the API. */
  items: ConversationListItemDto[];
  /** Available deployments used to resolve icons and tooltips. */
  deployments: DeploymentItemDto[];
  /** Whether the deployments list is still loading (drives `isIconLoading`). */
  isDeploymentsLoading: boolean;
}

/**
 * Maps raw `ConversationListItemDto[]` to panel-compatible conversation items.
 *
 * Returns a memoised array whose shape is compatible with the conversation
 * panel's item contract. All app-specific concerns (icon URL resolution,
 * route generation, id normalisation) are injected via resolver callbacks.
 */
export const useConversationPanelItems = ({
  items,
  deployments,
  isDeploymentsLoading,
  toPanelConversationId,
  resolveIconUrl,
  resolveIconTooltip,
  resolveHref,
  resolveTaskBadge,
}: UseConversationPanelItemsParams) =>
  useMemo(
    () =>
      items.map((item) => {
        const id = toPanelConversationId(item.id);
        const modelId = getModelIdFromConversationId(item.id);
        const deployment = modelId
          ? findDeploymentByIdOrReference(deployments, modelId)
          : undefined;
        /*
         * modelId is guessed from the conversation's resource path, which
         * cannot reliably distinguish a real conversation folder from a
         * multi-segment deployment id when the deployment itself isn't found
         * in `deployments` (e.g. unavailable/deleted) — so the fallback tooltip
         * shows only the last path segment, not the full percent-encoded path.
         */
        const fallbackTooltip = modelId
          ? safeDecodeURIComponent(modelId.split('/').pop() ?? modelId)
          : '';

        const taskBadge = resolveTaskBadge?.(item);

        return {
          id,
          title: item.title,
          isPinned: item.isPinned ?? false,
          iconUrl: resolveIconUrl(deployment),
          iconTooltip: resolveIconTooltip(deployment, fallbackTooltip),
          isIconLoading: isDeploymentsLoading,
          source: getConversationSource(item),
          href: resolveHref(id),
          ...(taskBadge != null
            ? {
                showTaskBadge: true,
                taskBadgeLabel: taskBadge.label,
                isUnread: taskBadge.isUnread,
              }
            : {}),
        };
      }),
    [
      items,
      deployments,
      isDeploymentsLoading,
      toPanelConversationId,
      resolveIconUrl,
      resolveIconTooltip,
      resolveHref,
      resolveTaskBadge,
    ],
  );
