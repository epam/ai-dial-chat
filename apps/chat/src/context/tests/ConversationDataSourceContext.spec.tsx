import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationDataSource } from '../../models/conversation-data-source';
import { conversationsApi } from '../../server-api/api-client';
import { ROUTES } from '../../types/routes';
import { conversationStreamTransport } from '../../utils/conversation-stream-transport';
import {
  ConversationDataSourceContext,
  ConversationDataSourceProvider,
  useConversationDataSource,
} from '../ConversationDataSourceContext';

const mocks = vi.hoisted(() => ({
  conversations: [] as unknown[],
  updateConversationTitle: vi.fn(),
  bumpConversationActivity: vi.fn(),
  watchForDisplayNameUpdate: vi.fn(),
  removeConversationFromList: vi.fn(),
  refreshConversations: vi.fn(),
}));

vi.mock('../auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'my-bucket' } }),
}));
vi.mock('../ConversationsContext', () => ({
  useConversations: () => mocks,
}));

describe('ConversationDataSourceContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.conversations = [];
  });

  it('provides the regular data source over the existing calls', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConversationDataSourceProvider>
        {children}
      </ConversationDataSourceProvider>
    );
    const { result } = renderHook(() => useConversationDataSource(), {
      wrapper,
    });

    expect(result.current.transport).toBe(conversationStreamTransport);
    expect(result.current.handlersApi).toBe(conversationsApi);
    expect(result.current.getExitRoute()).toBe(ROUTES.Root);
    expect(result.current.canDuplicate).toBe(true);
    expect(result.current.watchTitle).toBe(mocks.watchForDisplayNameUpdate);

    result.current.listSync?.remove('my-bucket/x');
    expect(mocks.removeConversationFromList).toHaveBeenCalledWith(
      'my-bucket/x',
    );
  });

  it('keeps the same value across renders while the list is unchanged', () => {
    const { result, rerender } = renderHook(() => useConversationDataSource());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('reads a conversation outside the caller bucket as read-only', () => {
    const { result } = renderHook(() => useConversationDataSource());

    expect(result.current.isReadOnly('my-bucket/x')).toBe(false);
    expect(result.current.isReadOnly('other-bucket/x')).toBe(true);
  });

  it('reads the share flags of a loaded list item', () => {
    mocks.conversations = [
      { id: 'conversations/my-bucket/x', sharedWithMe: true },
    ];
    const { result } = renderHook(() => useConversationDataSource());

    expect(result.current.isReadOnly('my-bucket/x')).toBe(true);
  });

  it('returns the value a provider overrides it with', () => {
    const override = { canDuplicate: false } as ConversationDataSource;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConversationDataSourceContext.Provider value={override}>
        {children}
      </ConversationDataSourceContext.Provider>
    );
    const { result } = renderHook(() => useConversationDataSource(), {
      wrapper,
    });

    expect(result.current).toBe(override);
  });
});
