import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useActiveConversationSync } from '../useActiveConversationSync';

const makeItem = (id: string): ConversationListItemDto =>
  ({ id, title: id }) as ConversationListItemDto;

describe('useActiveConversationSync', () => {
  it('refreshes once when the active conversation is missing without looping on item changes', async () => {
    const refreshConversations = vi.fn(() => Promise.resolve());
    const markConversationViewed = vi.fn(() => Promise.resolve());
    const conversationIdsMatch = (a: string, b: string) => a === b;
    const { rerender } = renderHook(
      ({ items }) =>
        useActiveConversationSync({
          activeConversationId: 'active',
          items,
          refreshConversations,
          markConversationViewed,
          conversationIdsMatch,
          toPanelConversationId: (id) => id,
        }),
      { initialProps: { items: [] as ConversationListItemDto[] } },
    );

    await waitFor(() => expect(refreshConversations).toHaveBeenCalledOnce());
    rerender({ items: [makeItem('different')] });

    expect(refreshConversations).toHaveBeenCalledOnce();
  });

  it('marks the matching raw conversation viewed when it becomes active', async () => {
    const item = makeItem('ctx-1');
    const markConversationViewed = vi.fn(() => Promise.resolve());
    const { rerender } = renderHook(
      ({ activeConversationId }) =>
        useActiveConversationSync({
          activeConversationId,
          items: [item],
          refreshConversations: () => Promise.resolve(),
          markConversationViewed,
          conversationIdsMatch: (a, b) => a === b,
          toPanelConversationId: (id) => id,
        }),
      {
        initialProps: { activeConversationId: undefined as string | undefined },
      },
    );

    rerender({ activeConversationId: 'ctx-1' });

    await waitFor(() =>
      expect(markConversationViewed).toHaveBeenCalledWith('ctx-1'),
    );
  });

  it('rechecks the active conversation when the injected id matcher changes', async () => {
    const refreshConversations = vi.fn(() => Promise.resolve());
    const item = makeItem('active');
    const toPanelConversationId = (id: string) => id;
    const { rerender } = renderHook(
      ({ conversationIdsMatch }) =>
        useActiveConversationSync({
          activeConversationId: 'active',
          items: [item],
          refreshConversations,
          markConversationViewed: () => Promise.resolve(),
          conversationIdsMatch,
          toPanelConversationId,
        }),
      {
        initialProps: {
          conversationIdsMatch: (a: string, b: string) => a === b,
        },
      },
    );

    expect(refreshConversations).not.toHaveBeenCalled();
    rerender({ conversationIdsMatch: () => false });

    await waitFor(() => expect(refreshConversations).toHaveBeenCalledOnce());
  });
});
