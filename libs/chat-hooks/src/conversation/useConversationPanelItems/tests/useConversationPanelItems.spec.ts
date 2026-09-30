import type {
  ConversationListItemDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import { FilterTab } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
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

  it('applies icon loading uniformly and omits task presentation without a resolver', () => {
    const params = makeParams({
      items: [makeItem('one'), makeItem('two')],
      isDeploymentsLoading: true,
    });
    const { result } = renderHook(() => useConversationPanelItems(params));

    expect(result.current.every((item) => item.isIconLoading)).toBe(true);
    for (const item of result.current) {
      expect(item.leadingIcon).toBeUndefined();
      expect(item.isUnread).toBeUndefined();
    }
  });

  it('copies the resolved task presentation onto the item unchanged', () => {
    const leadingIcon = createElement('svg', { 'aria-hidden': true });
    const params = makeParams({
      items: [
        makeItem('task', { isScheduledTask: true, isUnread: true }),
        makeItem('chat'),
      ],
      resolveTaskPresentation: (item) =>
        item.isScheduledTask
          ? { leadingIcon, isUnread: item.isUnread ?? false }
          : undefined,
    });
    const { result } = renderHook(() => useConversationPanelItems(params));

    const [task, chat] = result.current;
    expect(task.leadingIcon).toBe(leadingIcon);
    expect(task.isUnread).toBe(true);
    expect(task).not.toHaveProperty('showTaskBadge');
    expect(chat.leadingIcon).toBeUndefined();
    expect(chat.isUnread).toBeUndefined();
  });

  it('maps every run of a task, leaving any collapsing to the host', () => {
    const run = (runId: string) =>
      makeItem(`conversations/bucket/.scheduler/s1/model-1__Daily__${runId}`, {
        isScheduledTask: true,
        scheduleId: 's1',
        runId,
      });
    const params = makeParams({ items: [run('a'), run('b'), run('c')] });
    const { result } = renderHook(() => useConversationPanelItems(params));

    expect(result.current).toHaveLength(3);
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

describe('useConversationPanelItems — item identity and deployment lookup', () => {
  const renderItems = (initial: UseConversationPanelItemsParams) =>
    renderHook(
      (params: UseConversationPanelItemsParams) =>
        useConversationPanelItems(params),
      { initialProps: initial },
    );

  it('keeps the item of an unchanged DTO when the list changes', () => {
    const a = makeItem('conversations/bucket/model-1__A');
    const b = makeItem('conversations/bucket/model-1__B');
    const c = makeItem('conversations/bucket/model-1__C');
    const params = makeParams({ items: [a, b] });
    const { result, rerender } = renderItems(params);
    const [itemA] = result.current;

    rerender({ ...params, items: [a, c] });

    expect(result.current[0]).toBe(itemA);
    expect(result.current[1].title).toBe(c.title);
  });

  it('rebuilds every item when a resolver changes', () => {
    const a = makeItem('conversations/bucket/model-1__A');
    const params = makeParams({ items: [a] });
    const { result, rerender } = renderItems(params);
    const [itemA] = result.current;

    rerender({ ...params, resolveHref: (id) => `/other/${id}` });

    expect(result.current[0]).not.toBe(itemA);
    expect(result.current[0].href).toBe(`/other/panel:${a.id}`);
  });

  it('rebuilds every item when the deployments array changes', () => {
    const a = makeItem('conversations/bucket/model-1__A');
    const params = makeParams({ items: [a] });
    const { result, rerender } = renderItems(params);
    const [itemA] = result.current;

    rerender({
      ...params,
      deployments: [
        { id: 'model-1', displayName: 'Renamed' } as DeploymentItemDto,
      ],
    });

    expect(result.current[0]).not.toBe(itemA);
    expect(result.current[0].iconTooltip).toBe('Renamed');
  });

  it('maps a DTO afresh after it left the list and came back', () => {
    const a = makeItem('conversations/bucket/model-1__A');
    const b = makeItem('conversations/bucket/model-1__B');
    const params = makeParams({ items: [a, b] });
    const { result, rerender } = renderItems(params);
    const [itemA] = result.current;

    rerender({ ...params, items: [b] });
    rerender({ ...params, items: [a, b] });

    expect(result.current[0]).not.toBe(itemA);
    expect(result.current[0]).toEqual(itemA);
  });

  it('prefers a deployment matched by id over one matched by reference', () => {
    const { result } = renderItems(
      makeParams({
        items: [makeItem('conversations/bucket/model-1__Chat')],
        deployments: [
          {
            id: 'other',
            reference: 'model-1',
            displayName: 'By reference',
          } as DeploymentItemDto,
          { id: 'model-1', displayName: 'By id' } as DeploymentItemDto,
        ],
      }),
    );

    expect(result.current[0].iconTooltip).toBe('By id');
  });

  it('falls back to a deployment matched by reference', () => {
    const { result } = renderItems(
      makeParams({
        items: [makeItem('conversations/bucket/model-1__Chat')],
        deployments: [
          {
            id: 'model-1-2024',
            reference: 'model-1',
            displayName: 'By reference',
          } as DeploymentItemDto,
        ],
      }),
    );

    expect(result.current[0].iconTooltip).toBe('By reference');
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
