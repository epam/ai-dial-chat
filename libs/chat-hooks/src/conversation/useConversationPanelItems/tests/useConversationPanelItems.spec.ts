import type {
  ConversationListItemDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import { FilterTab } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  getConversationSource,
  useConversationPanelItems,
  type UseConversationPanelItemsParams,
} from '../useConversationPanelItems';

const makeItem = (
  id: string,
  overrides: Partial<ConversationListItemDto> = {},
): ConversationListItemDto =>
  ({
    id,
    title: id,
    updatedAt: 1,
    sharedWithMe: false,
    publishedWithMe: false,
    isPinned: false,
    isReadonly: false,
    isScheduledTask: false,
    ...overrides,
  }) as ConversationListItemDto;

const makeParams = (
  overrides: Partial<UseConversationPanelItemsParams> = {},
): UseConversationPanelItemsParams => ({
  items: [makeItem('conversations/bucket/model-1__Chat')],
  deployments: [{ id: 'model-1', displayName: 'Model 1' } as DeploymentItemDto],
  isDeploymentsLoading: false,
  toPanelConversationId: (id) => `panel:${id}`,
  resolveIconUrl: (deployment) => deployment?.iconUrl,
  resolveIconTooltip: (deployment, fallback) =>
    String(deployment?.displayName ?? fallback),
  resolveHref: (id) => `/chat/${id}`,
  ...overrides,
});

describe('useConversationPanelItems', () => {
  it('maps one panel item per DTO through every injected resolver', () => {
    const resolveHref = vi.fn((id: string) => `/chat/${id}`);
    const params = makeParams({
      items: [makeItem('one'), makeItem('two'), makeItem('three')],
      resolveHref,
    });
    const { result } = renderHook(() => useConversationPanelItems(params));

    expect(result.current).toHaveLength(3);
    expect(
      result.current.map(({ id, title, source, href }) => ({
        id,
        title,
        source,
        href,
      })),
    ).toEqual([
      {
        id: 'panel:one',
        title: 'one',
        source: FilterTab.MyChats,
        href: '/chat/panel:one',
      },
      {
        id: 'panel:two',
        title: 'two',
        source: FilterTab.MyChats,
        href: '/chat/panel:two',
      },
      {
        id: 'panel:three',
        title: 'three',
        source: FilterTab.MyChats,
        href: '/chat/panel:three',
      },
    ]);
    expect(resolveHref).toHaveBeenCalledTimes(3);
  });

  it('uses a decoded final model-id segment as the unresolved tooltip fallback', () => {
    const resolveIconTooltip = vi.fn(
      (_deployment: DeploymentItemDto | undefined, fallback: string) =>
        fallback,
    );
    const params = makeParams({
      items: [makeItem('conversations/bucket/vendor/My%20Model__Chat')],
      deployments: [],
      resolveIconTooltip,
    });

    renderHook(() => useConversationPanelItems(params));

    expect(resolveIconTooltip).toHaveBeenCalledWith(undefined, 'My Model');
  });

  it('applies icon loading uniformly and omits optional task badge fields', () => {
    const params = makeParams({
      items: [makeItem('one'), makeItem('two')],
      isDeploymentsLoading: true,
    });
    const { result } = renderHook(() => useConversationPanelItems(params));

    expect(result.current.every((item) => item.isIconLoading)).toBe(true);
    for (const item of result.current) {
      expect(item.showTaskBadge).toBeUndefined();
      expect(item.taskBadgeLabel).toBeUndefined();
      expect(item.isUnread).toBeUndefined();
    }
  });

  it('keeps the mapped array reference stable when inputs do not change', () => {
    const params = makeParams();
    const { result, rerender } = renderHook(() =>
      useConversationPanelItems(params),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

describe('getConversationSource', () => {
  it('returns the shared enum member before organization when both flags are set', () => {
    expect(
      getConversationSource({ sharedWithMe: true, publishedWithMe: true }),
    ).toBe(FilterTab.Shared);
  });

  it('returns organization or my chats for the remaining ownership states', () => {
    expect(
      getConversationSource({ sharedWithMe: false, publishedWithMe: true }),
    ).toBe(FilterTab.Organization);
    expect(
      getConversationSource({ sharedWithMe: false, publishedWithMe: false }),
    ).toBe(FilterTab.MyChats);
  });
});
