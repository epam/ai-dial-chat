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

const wrapper = ({ children }: { children: ReactNode }) => (
  <ConversationDataSourceProvider>{children}</ConversationDataSourceProvider>
);

describe('ConversationDataSourceContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.conversations = [];
  });

  it('provides the regular data source over the existing calls', () => {
    const { result } = renderHook(() => useConversationDataSource(), {
      wrapper,
    });

    expect(result.current.transport).toBe(conversationStreamTransport);
    expect(result.current.handlersApi).toBe(conversationsApi);
    expect(result.current.getExitRoute()).toBe(ROUTES.Root);
    expect(result.current.canDuplicate).toBe(true);
    expect(result.current.watchTitle).toBe(mocks.watchForDisplayNameUpdate);

    result.current.listSync.remove('my-bucket/x');
    expect(mocks.removeConversationFromList).toHaveBeenCalledWith(
      'my-bucket/x',
    );
  });

  it('keeps the same value across renders while the list is unchanged', () => {
    const { result, rerender } = renderHook(() => useConversationDataSource(), {
      wrapper,
    });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('reads a conversation outside the caller bucket as read-only', () => {
    const { result } = renderHook(() => useConversationDataSource(), {
      wrapper,
    });

    expect(result.current.isReadOnly('my-bucket/x')).toBe(false);
    expect(result.current.isReadOnly('other-bucket/x')).toBe(true);
  });

  it('reads the share flags of a loaded list item', () => {
    mocks.conversations = [
      { id: 'conversations/my-bucket/x', sharedWithMe: true },
    ];
    const { result } = renderHook(() => useConversationDataSource(), {
      wrapper,
    });

    expect(result.current.isReadOnly('my-bucket/x')).toBe(true);
  });

  it('returns the value a provider overrides it with', () => {
    const override = { canDuplicate: false } as ConversationDataSource;
    const overrideWrapper = ({ children }: { children: ReactNode }) => (
      <ConversationDataSourceContext.Provider value={override}>
        {children}
      </ConversationDataSourceContext.Provider>
    );
    const { result } = renderHook(() => useConversationDataSource(), {
      wrapper: overrideWrapper,
    });

    expect(result.current).toBe(override);
  });

  it('throws outside any provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useConversationDataSource())).toThrow(
      'useConversationDataSource must be used within a ConversationDataSourceProvider',
    );
  });
});
