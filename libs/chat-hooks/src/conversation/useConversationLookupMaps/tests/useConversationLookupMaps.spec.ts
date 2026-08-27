import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConversationLookupMaps } from '../useConversationLookupMaps';

const makeItem = (id: string): ConversationListItemDto =>
  ({ id, title: id }) as ConversationListItemDto;

describe('useConversationLookupMaps', () => {
  it('resolves a known panel id to its context id and raw item', () => {
    const item = makeItem('ctx-1');
    const { result } = renderHook(() =>
      useConversationLookupMaps({
        items: [item],
        toPanelConversationId: (id) => id.replace('ctx', 'panel'),
      }),
    );

    expect(result.current.toContextId('panel-1')).toBe('ctx-1');
    expect(result.current.getRawItem('panel-1')).toBe(item);
  });

  it('returns undefined for an unknown panel id', () => {
    const { result } = renderHook(() =>
      useConversationLookupMaps({
        items: [makeItem('ctx-1')],
        toPanelConversationId: (id) => id.replace('ctx', 'panel'),
      }),
    );

    expect(result.current.toContextId('missing')).toBeUndefined();
    expect(result.current.getRawItem('missing')).toBeUndefined();
  });
});
