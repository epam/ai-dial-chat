import type {
  ConversationListItemDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import { FilterTab } from '@epam/ai-dial-chat-shared';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
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
   * Returns the row presentation for a scheduled-task conversation — a
   * host-rendered leading icon that replaces the deployment avatar, and the
   * unread flag — or `undefined` for an ordinary conversation.
   */
  resolveTaskPresentation?: (
    item: ConversationListItemDto,
  ) => { leadingIcon?: ReactNode; isUnread: boolean } | undefined;
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

/*
 * Id and reference lookups built in one pass. A key keeps its first
 * deployment, and callers try `byId` before `byReference`, which reproduces
 * `findDeploymentByIdOrReference`'s `Array#find` precedence in O(1) per item.
 */
const buildDeploymentLookup = (deployments: DeploymentItemDto[]) => {
  const byId = new Map<string, DeploymentItemDto>();
  const byReference = new Map<string, DeploymentItemDto>();
  for (const deployment of deployments) {
    if (!byId.has(deployment.id)) byId.set(deployment.id, deployment);
    if (deployment.reference && !byReference.has(deployment.reference)) {
      byReference.set(deployment.reference, deployment);
    }
  }
  return (idOrReference: string) =>
    byId.get(idOrReference) ?? byReference.get(idOrReference);
};

/*
 * Items mapped by the last committed render, keyed by source DTO, together
 * with the mapper that built them (`mapItem` changes whenever any non-`items`
 * input does). Written only after commit so a discarded render can never
 * leave items built from uncommitted resolvers.
 */
interface PanelItemCache<TMapper, TItem> {
  mapItem: TMapper;
  byDto: ReadonlyMap<ConversationListItemDto, TItem>;
}

/**
 * Maps raw `ConversationListItemDto[]` to panel-compatible conversation items.
 *
 * Returns a memoised array whose shape is compatible with the conversation
 * panel's item contract. All app-specific concerns (icon URL resolution,
 * route generation, id normalisation) are injected via resolver callbacks.
 *
 * While every input except `items` is unchanged, a DTO that is referentially
 * the same as in the previous render maps to the same item object, so a list
 * change (or a navigation that re-derives the list) re-renders only the rows
 * whose DTO actually changed.
 */
export const useConversationPanelItems = ({
  items,
  deployments,
  isDeploymentsLoading,
  toPanelConversationId,
  resolveIconUrl,
  resolveIconTooltip,
  resolveHref,
  resolveTaskPresentation,
}: UseConversationPanelItemsParams) => {
  const findDeployment = useMemo(
    () => buildDeploymentLookup(deployments),
    [deployments],
  );

  const mapItem = useMemo(
    () => (item: ConversationListItemDto) => {
      const id = toPanelConversationId(item.id);
      const modelId = getModelIdFromConversationId(item.id);
      const deployment = modelId ? findDeployment(modelId) : undefined;
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

      const taskPresentation = resolveTaskPresentation?.(item);

      return {
        id,
        title: item.title,
        isPinned: item.isPinned ?? false,
        iconUrl: resolveIconUrl(deployment),
        iconTooltip: resolveIconTooltip(deployment, fallbackTooltip),
        isIconLoading: isDeploymentsLoading,
        source: getConversationSource(item),
        href: resolveHref(id),
        ...(taskPresentation != null
          ? {
              leadingIcon: taskPresentation.leadingIcon,
              isUnread: taskPresentation.isUnread,
            }
          : {}),
      };
    },
    [
      findDeployment,
      isDeploymentsLoading,
      toPanelConversationId,
      resolveIconUrl,
      resolveIconTooltip,
      resolveHref,
      resolveTaskPresentation,
    ],
  );

  type PanelItem = ReturnType<typeof mapItem>;
  const cacheRef = useRef<PanelItemCache<typeof mapItem, PanelItem> | null>(
    null,
  );

  const computed = useMemo(() => {
    const previous = cacheRef.current;
    const reusable = previous?.mapItem === mapItem ? previous.byDto : undefined;
    const byDto = new Map<ConversationListItemDto, PanelItem>();
    const mapped = items.map((dto) => {
      const item = reusable?.get(dto) ?? mapItem(dto);
      byDto.set(dto, item);
      return item;
    });
    return { mapped, cache: { mapItem, byDto } };
  }, [items, mapItem]);

  useEffect(() => {
    cacheRef.current = computed.cache;
  }, [computed]);

  return computed.mapped;
};
