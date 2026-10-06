import {
  ConversationDeletionFailureDtoCodeEnum,
  type ConversationDeletionResultDto,
} from '@epam/ai-dial-chat-api-client';
import { useActiveConversationSync } from '@epam/ai-dial-chat-hooks';
import {
  OverlayEventType,
  OverlayRequestType,
} from '@epam/ai-dial-chat-overlay';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as conversationsApi from '../../server-api/conversations.api';
import * as userConfigApi from '../../server-api/user-config.api';
import { AuthStatus } from '../../types/auth-status';
import {
  conversationIdsMatch,
  toPanelConversationId,
} from '../../utils/conversation-id-match';
import {
  ConversationsProvider,
  useConversations,
} from '../ConversationsContext';
import { OverlayProvider } from '../overlay/OverlayContext';
import { useAppConfig as mockUseAppConfig } from './app-config-context-mock';

const contextMocks = vi.hoisted(() => ({
  userSub: 'user-1' as string | undefined,
  setPinnedConversation: vi.fn(),
}));

vi.mock('../../server-api/conversations.api');
vi.mock('../../server-api/user-config.api');
vi.mock('../UserConfigContext', () => ({
  useUserConfig: () => ({
    setPinnedConversation: contextMocks.setPinnedConversation,
  }),
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));
vi.mock('../auth/UserContext', () => ({
  useUser: () => ({
    status: AuthStatus.Authenticated,
    user: contextMocks.userSub ? { sub: contextMocks.userSub } : null,
  }),
}));
vi.mock('../ThemeContext', () => ({
  useTheme: () => ({ setTheme: vi.fn() }),
}));
vi.mock('../UiFeaturesContext', () => ({
  useUiFeatures: () => ({
    isEnabled: () => true,
    enabledFeatures: new Set(),
    applyOverlayOverride: vi.fn(),
  }),
}));

const mockListConversations = vi.mocked(conversationsApi.listConversations);
const mockDeleteAllConversations = vi.mocked(
  conversationsApi.deleteAllConversations,
);
const mockDeleteConversation = vi.mocked(conversationsApi.deleteConversation);
const mockRenameConversation = vi.mocked(conversationsApi.renameConversation);
const mockMarkConversationViewed = vi.mocked(
  conversationsApi.markConversationViewed,
);

const seedConversations = [
  {
    id: 'conv1',
    title: 'Chat 1',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
    isReadonly: false,
    isScheduledTask: false,
  },
  {
    id: 'conv2',
    title: 'Chat 2',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
    isReadonly: false,
    isScheduledTask: false,
  },
  {
    id: 'conv3',
    title: 'Chat 3',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
    isReadonly: false,
    isScheduledTask: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  contextMocks.userSub = 'user-1';
  contextMocks.setPinnedConversation.mockResolvedValue(undefined);
  mockUseAppConfig.mockReturnValue({
    config: { overlayAllowedOrigins: ['https://partner.example.com'] },
  });
  vi.mocked(userConfigApi.pinConversation).mockResolvedValue(undefined);
  mockListConversations.mockResolvedValue({ items: seedConversations });
});

describe('ConversationsContext — identity-keyed refetch', () => {
  it('resets and refetches conversations when the authenticated identity changes', async () => {
    const { result, rerender } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversations).toHaveLength(3);
    expect(mockListConversations).toHaveBeenCalledOnce();

    let resolveRefetch: (value: { items: typeof seedConversations }) => void;
    const refetchPromise = new Promise<{ items: typeof seedConversations }>(
      (resolve) => {
        resolveRefetch = resolve;
      },
    );
    mockListConversations.mockReturnValueOnce(refetchPromise);
    contextMocks.userSub = 'user-2';

    rerender();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.conversations).toEqual([]);

    await act(async () => {
      resolveRefetch({ items: [seedConversations[0]] });
      await refetchPromise;
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListConversations).toHaveBeenCalledTimes(2);
    expect(result.current.conversations).toHaveLength(1);
  });

  it('does not refetch when the identity object changes but sub stays the same', async () => {
    const { result, rerender } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockListConversations).toHaveBeenCalledOnce();

    // Same sub value, simulating an in-place UserContext profile refresh.
    contextMocks.userSub = 'user-1';
    rerender();

    expect(mockListConversations).toHaveBeenCalledOnce();
  });
});

describe('ConversationsContext — background refresh', () => {
  it('keeps the loaded list visible while conversations are refreshed', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveRefresh!: (value: { items: typeof seedConversations }) => void;
    const refreshResponse = new Promise<{ items: typeof seedConversations }>(
      (resolve) => {
        resolveRefresh = resolve;
      },
    );
    mockListConversations.mockReturnValueOnce(refreshResponse);

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refreshConversations();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.conversations).toEqual(seedConversations);

    await act(async () => {
      resolveRefresh({ items: [seedConversations[0]] });
      await refreshPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.conversations).toEqual([seedConversations[0]]);
  });

  it('keeps the loaded list visible when a background refresh fails', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let rejectRefresh!: (reason: Error) => void;
    const refreshResponse = new Promise<never>((_resolve, reject) => {
      rejectRefresh = reject;
    });
    mockListConversations.mockReturnValueOnce(refreshResponse);

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refreshConversations();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.conversations).toEqual(seedConversations);

    const refreshError = new Error('Refresh failed');
    await act(async () => {
      rejectRefresh(refreshError);
      await refreshPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.conversations).toEqual(seedConversations);
    expect(result.current.error).toBe(refreshError);
  });
});

describe('ConversationsContext — no-op updates keep the list reference', () => {
  const renderLoaded = async () => {
    const view = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    return view;
  };

  it('keeps the list when a title is set to its current value', async () => {
    const { result } = await renderLoaded();
    const before = result.current.conversations;

    act(() => {
      result.current.updateConversationTitle('conv2', 'Chat 2');
    });

    expect(result.current.conversations).toBe(before);
  });

  it('replaces only the renamed item when a title changes', async () => {
    const { result } = await renderLoaded();
    const before = result.current.conversations;

    act(() => {
      result.current.updateConversationTitle('conv2', 'Renamed');
    });

    const after = result.current.conversations;
    expect(after).not.toBe(before);
    expect(after[1].title).toBe('Renamed');
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
  });

  it('keeps the list when removing an id that is not in it', async () => {
    const { result } = await renderLoaded();
    const before = result.current.conversations;

    act(() => {
      result.current.removeConversationFromList('missing');
    });

    expect(result.current.conversations).toBe(before);
  });

  it('keeps the list when pinning to the current pin state and still persists it', async () => {
    const { result } = await renderLoaded();
    const before = result.current.conversations;

    let pinPromise!: Promise<void>;
    act(() => {
      pinPromise = result.current.pinConversation('conv1', false);
    });

    expect(result.current.conversations).toBe(before);
    await act(async () => {
      await pinPromise;
    });
    expect(contextMocks.setPinnedConversation).toHaveBeenCalledWith(
      'conv1',
      false,
    );
  });
});

describe('ConversationsContext — deleteAllConversations', () => {
  it('refreshes list on complete success (preserves shared/public)', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });

    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 3,
      deleted: 3,
      alreadyAbsent: 0,
      failed: [],
    });
    const afterDelete = [
      {
        id: 'shared1',
        title: 'Shared',
        isPinned: false,
        updatedAt: 0,
        sharedWithMe: true,
        publishedWithMe: false,
        isReadonly: true,
        isScheduledTask: false,
      },
    ];
    mockListConversations.mockResolvedValueOnce({ items: afterDelete });

    await act(async () => {
      await result.current.deleteAllConversations();
    });

    expect(mockListConversations).toHaveBeenCalledTimes(2);
    expect(result.current.conversations).toHaveLength(1);
  });

  it('refreshes list for empty bucket (requested: 0)', async () => {
    mockListConversations.mockResolvedValueOnce({ items: [] });

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 0,
      deleted: 0,
      alreadyAbsent: 0,
      failed: [],
    });
    mockListConversations.mockResolvedValueOnce({ items: [] });

    await act(async () => {
      await result.current.deleteAllConversations();
    });

    expect(mockListConversations).toHaveBeenCalledTimes(2);
    expect(result.current.conversations).toEqual([]);
  });

  it('calls refreshConversations on partial failure', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });

    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    const partialResult = {
      requested: 3,
      deleted: 2,
      alreadyAbsent: 0,
      failed: [
        {
          id: 'conv3',
          code: ConversationDeletionFailureDtoCodeEnum.UpstreamError,
        },
      ],
    };
    mockDeleteAllConversations.mockResolvedValueOnce(partialResult);
    const refreshedConvs = [
      {
        id: 'conv3',
        title: 'Chat 3',
        isPinned: false,
        updatedAt: 0,
        sharedWithMe: false,
        publishedWithMe: false,
        isReadonly: false,
        isScheduledTask: false,
      },
    ];
    mockListConversations.mockResolvedValueOnce({ items: refreshedConvs });

    let returned: ConversationDeletionResultDto | undefined;
    await act(async () => {
      returned = await result.current.deleteAllConversations();
    });

    expect(mockListConversations).toHaveBeenCalledTimes(2);
    expect(returned?.failed).toHaveLength(1);
  });

  it('does not modify state on total failure', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });

    await waitFor(() => expect(result.current.conversations).toHaveLength(3));
    const listCallCountBefore = mockListConversations.mock.calls.length;

    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 3,
      deleted: 0,
      alreadyAbsent: 0,
      failed: [
        {
          id: 'conv1',
          code: ConversationDeletionFailureDtoCodeEnum.UpstreamError,
        },
        {
          id: 'conv2',
          code: ConversationDeletionFailureDtoCodeEnum.UpstreamError,
        },
        {
          id: 'conv3',
          code: ConversationDeletionFailureDtoCodeEnum.UpstreamError,
        },
      ],
    });

    await act(async () => {
      await result.current.deleteAllConversations();
    });

    expect(result.current.conversations).toHaveLength(3);
    expect(mockListConversations.mock.calls.length).toBe(listCallCountBefore);
  });

  it('propagates thrown error without modifying state', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });

    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    mockDeleteAllConversations.mockRejectedValueOnce(
      new Error('Network error'),
    );

    await expect(
      act(async () => {
        await result.current.deleteAllConversations();
      }),
    ).rejects.toThrow('Network error');

    expect(result.current.conversations).toHaveLength(3);
  });
});

describe('ConversationsContext — renameConversation', () => {
  it('optimistically applies the new title before the API resolves', async () => {
    let resolveRename!: (value: { name: string }) => void;
    mockRenameConversation.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRename = resolve;
      }),
    );

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    let renamePromise!: Promise<void>;
    act(() => {
      renamePromise = result.current.renameConversation('conv1', 'New Name');
    });

    expect(
      result.current.conversations.find((c) => c.id === 'conv1')?.title,
    ).toBe('New Name');

    resolveRename({ name: 'New Name' });
    await act(async () => {
      await renamePromise;
    });
  });

  it('reconciles the title from the server response and leaves id unchanged', async () => {
    mockRenameConversation.mockResolvedValueOnce({ name: 'Sanitised Name' });

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    await act(async () => {
      await result.current.renameConversation('conv1', 'Sanitised Name!!');
    });

    const renamed = result.current.conversations.find((c) => c.id === 'conv1');
    expect(renamed?.id).toBe('conv1');
    expect(renamed?.title).toBe('Sanitised Name');
  });

  it('reverts the title on API failure', async () => {
    mockRenameConversation.mockRejectedValueOnce(new Error('rename failed'));

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    await expect(
      act(async () => {
        await result.current.renameConversation('conv1', 'New Name');
      }),
    ).rejects.toThrow('rename failed');

    expect(
      result.current.conversations.find((c) => c.id === 'conv1')?.title,
    ).toBe('Chat 1');
  });

  it('does not call any pin API during rename', async () => {
    mockRenameConversation.mockResolvedValueOnce({ name: 'New Name' });

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    await act(async () => {
      await result.current.renameConversation('conv1', 'New Name');
    });

    expect(userConfigApi.pinConversation).not.toHaveBeenCalled();
  });
});

describe('ConversationsContext — deleteConversation', () => {
  it('keeps the conversation removed when it is already absent upstream', async () => {
    mockDeleteConversation.mockRejectedValueOnce({
      response: { status: 404, json: vi.fn() },
    });

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    await act(async () => {
      await result.current.deleteConversation('conv1');
    });

    expect(result.current.conversations.map((c) => c.id)).toEqual([
      'conv2',
      'conv3',
    ]);
  });

  it('removes the row whose id differs only by encoding', async () => {
    mockListConversations.mockResolvedValueOnce({
      items: [
        ...seedConversations,
        {
          id: 'folder/chat one',
          title: 'Chat with space',
          isPinned: false,
          updatedAt: 0,
          sharedWithMe: false,
          publishedWithMe: false,
          isReadonly: false,
          isScheduledTask: false,
        },
      ],
    });
    mockDeleteConversation.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(4));

    await act(async () => {
      await result.current.deleteConversation('folder%2Fchat%20one');
    });

    expect(
      result.current.conversations.some((c) => c.id === 'folder/chat one'),
    ).toBe(false);
    expect(result.current.conversations).toHaveLength(3);
  });

  it('restores the conversation and rethrows on any other failure', async () => {
    mockDeleteConversation.mockRejectedValueOnce({
      response: { status: 502, json: vi.fn() },
    });

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    await expect(
      act(async () => {
        await result.current.deleteConversation('conv1');
      }),
    ).rejects.toBeDefined();

    expect(result.current.conversations).toHaveLength(3);
  });
});

describe('ConversationsContext — removeConversationFromList', () => {
  it('removes only the conversation matching the given id', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    act(() => {
      result.current.removeConversationFromList('conv2');
    });

    expect(result.current.conversations.map((c) => c.id)).toEqual([
      'conv1',
      'conv3',
    ]);
  });

  it('matches ids via conversationIdsMatch, including URL-encoded variants', async () => {
    mockListConversations.mockResolvedValueOnce({
      items: [
        ...seedConversations,
        {
          id: 'folder/chat one',
          title: 'Chat with space',
          isPinned: false,
          updatedAt: 0,
          sharedWithMe: false,
          publishedWithMe: false,
          isReadonly: false,
          isScheduledTask: false,
        },
      ],
    });

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(4));

    act(() => {
      result.current.removeConversationFromList('folder%2Fchat%20one');
    });

    expect(
      result.current.conversations.some((c) => c.id === 'folder/chat one'),
    ).toBe(false);
    expect(result.current.conversations).toHaveLength(3);
  });

  it('does not call the delete API', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    act(() => {
      result.current.removeConversationFromList('conv1');
    });

    expect(mockDeleteConversation).not.toHaveBeenCalled();
  });

  it('is a no-op when the id does not match any conversation', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    act(() => {
      result.current.removeConversationFromList('does-not-exist');
    });

    expect(result.current.conversations).toHaveLength(3);
  });
});

describe('ConversationsContext — bumpConversationActivity', () => {
  it('moves the bumped conversation to the top of the list', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    act(() => {
      result.current.bumpConversationActivity('conv3');
    });

    expect(result.current.conversations.map((c) => c.id)).toEqual([
      'conv3',
      'conv1',
      'conv2',
    ]);
  });

  it('stamps the bumped conversation with the current time, keeping its other fields', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    const bumpedAtLeast = Date.now();
    act(() => {
      result.current.bumpConversationActivity('conv2');
    });

    const [bumped] = result.current.conversations;
    expect(bumped).toMatchObject({ id: 'conv2', title: 'Chat 2' });
    expect(bumped.updatedAt).toBeGreaterThanOrEqual(bumpedAtLeast);
  });

  it('keeps a more recently updated conversation ahead of the bumped one', async () => {
    mockListConversations.mockResolvedValue({
      items: [
        { ...seedConversations[0], updatedAt: Date.now() + 60_000 },
        seedConversations[1],
        seedConversations[2],
      ],
    });
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    act(() => {
      result.current.bumpConversationActivity('conv3');
    });

    expect(result.current.conversations.map((c) => c.id)).toEqual([
      'conv1',
      'conv3',
      'conv2',
    ]);
  });

  it('matches ids that differ only by encoding', async () => {
    mockListConversations.mockResolvedValue({
      items: [
        seedConversations[0],
        { ...seedConversations[1], id: 'folder/my chat' },
      ],
    });
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    act(() => {
      result.current.bumpConversationActivity('folder/my%20chat');
    });

    expect(result.current.conversations.map((c) => c.id)).toEqual([
      'folder/my chat',
      'conv1',
    ]);
  });

  it('is a no-op when the id does not match any conversation', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));
    const before = result.current.conversations;

    act(() => {
      result.current.bumpConversationActivity('does-not-exist');
    });

    expect(result.current.conversations).toBe(before);
  });
});

describe('ConversationsContext — markConversationViewed', () => {
  it('discovers a completed run after navigation and marks its late metadata viewed', async () => {
    vi.useFakeTimers();
    try {
      mockListConversations.mockResolvedValue({ items: [] });
      mockMarkConversationViewed.mockResolvedValue(undefined);
      const task = {
        ...seedConversations[0],
        id: 'conversations/bucket/.scheduler/task/run',
        isScheduledTask: true,
        isUnread: true,
      };
      const { result, rerender, unmount } = renderHook(
        ({ activeId }) => {
          const context = useConversations();
          useActiveConversationSync({
            activeConversationId: activeId,
            items: context.conversations,
            refreshConversations: context.refreshConversations,
            markConversationViewed: context.markConversationViewed,
            conversationIdsMatch,
            toPanelConversationId,
          });
          return context;
        },
        {
          wrapper: ConversationsProvider,
          initialProps: { activeId: undefined as string | undefined },
        },
      );
      await act(async () => undefined);
      /* The final run status has a conversation id before list metadata exists. */
      await act(async () => result.current.refreshConversations([task.id]));
      rerender({ activeId: 'bucket/.scheduler/task/run' });
      await act(async () => undefined);
      expect(mockMarkConversationViewed).not.toHaveBeenCalled();
      mockListConversations.mockResolvedValue({ items: [task] });
      await act(async () => vi.advanceTimersByTimeAsync(2_000));
      expect(result.current.conversations[0].isUnread).toBe(false);
      expect(mockMarkConversationViewed).toHaveBeenCalledExactlyOnceWith(
        '.scheduler/task/run',
      );
      const calls = mockListConversations.mock.calls.length;
      await act(async () => vi.advanceTimersByTimeAsync(60_000));
      expect(mockListConversations).toHaveBeenCalledTimes(calls);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries discovery after a temporary list failure', async () => {
    vi.useFakeTimers();
    try {
      mockListConversations.mockResolvedValue({ items: [] });
      const { result, unmount } = renderHook(() => useConversations(), {
        wrapper: ConversationsProvider,
      });
      await act(async () => undefined);
      mockListConversations.mockRejectedValueOnce(
        new Error('temporary outage'),
      );
      await act(async () => result.current.refreshConversations(['conv1']));
      mockListConversations.mockResolvedValue({ items: seedConversations });
      await act(async () => vi.advanceTimersByTimeAsync(2_000));
      expect(result.current.conversations).toEqual(seedConversations);
      expect(result.current.error).toBeNull();
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([true, false])(
    'keeps successful discovery when a newer refresh fails (failure first: %s)',
    async (failureFirst) => {
      mockListConversations.mockResolvedValue({ items: [] });
      const { result } = renderHook(() => useConversations(), {
        wrapper: ConversationsProvider,
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const task = {
        ...seedConversations[0],
        isScheduledTask: true,
        isUnread: true,
      };
      let finishDiscovery!: (value: { items: (typeof task)[] }) => void;
      let failRefresh!: (error: Error) => void;
      mockListConversations
        .mockReturnValueOnce(
          new Promise((resolve) => {
            finishDiscovery = resolve;
          }),
        )
        .mockReturnValueOnce(
          new Promise((_resolve, reject) => {
            failRefresh = reject;
          }),
        );
      let discovery!: Promise<void>;
      let refresh!: Promise<void>;
      act(() => {
        discovery = result.current.refreshConversations();
        refresh = result.current.refreshConversations();
      });
      const completeDiscovery = async () => {
        finishDiscovery({ items: [task] });
        await discovery;
      };
      const rejectRefresh = async () => {
        failRefresh(new Error('temporary outage'));
        await refresh;
      };
      await act(failureFirst ? rejectRefresh : completeDiscovery);
      await act(failureFirst ? completeDiscovery : rejectRefresh);
      expect(result.current.conversations).toEqual([task]);
    },
  );

  it('keeps the successful initial load when an overlapping refresh fails', async () => {
    let finishLoad!: (value: { items: typeof seedConversations }) => void;
    mockListConversations.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoad = resolve;
      }),
    );
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    mockListConversations.mockRejectedValueOnce(new Error('temporary outage'));
    await act(async () => result.current.refreshConversations());
    await act(async () => {
      finishLoad({ items: seedConversations });
    });
    expect(result.current.conversations).toEqual(seedConversations);
    expect(result.current.error).toBeNull();
  });

  it('serializes viewed writes for rapidly opened chats while clearing both indicators immediately', async () => {
    const tasks = seedConversations
      .slice(0, 2)
      .map((item) => ({ ...item, isScheduledTask: true, isUnread: true }));
    mockListConversations.mockResolvedValue({ items: tasks });
    let finishFirst!: () => void;
    mockMarkConversationViewed
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.markConversationViewed('conv1');
      second = result.current.markConversationViewed('conv2');
    });
    expect(result.current.conversations.map((item) => item.isUnread)).toEqual([
      false,
      false,
    ]);
    expect(mockMarkConversationViewed).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishFirst();
      await Promise.all([first, second]);
    });
    expect(mockMarkConversationViewed.mock.calls.map(([id]) => id)).toEqual([
      'conv1',
      'conv2',
    ]);
  });

  it('does not let an older list response remove a newly discovered run', async () => {
    mockListConversations.mockResolvedValue({ items: [] });
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let finishOlder!: (value: { items: never[] }) => void;
    mockListConversations.mockReturnValueOnce(
      new Promise((resolve) => {
        finishOlder = resolve;
      }),
    );
    let older!: Promise<void>;
    act(() => {
      older = result.current.refreshConversations();
    });
    const task = {
      ...seedConversations[0],
      isScheduledTask: true,
      isUnread: true,
    };
    mockListConversations.mockResolvedValueOnce({ items: [task] });
    await act(async () => result.current.refreshConversations());
    await act(async () => {
      finishOlder({ items: [] });
      await older;
    });
    expect(result.current.conversations).toEqual([task]);
  });

  it('persists a directly opened chat after metadata loads and retries a failed write only on revisit', async () => {
    const task = {
      ...seedConversations[0],
      id: 'conversations/bucket/.scheduler/task/run',
      isScheduledTask: true,
      isUnread: true,
    };
    let finishLoad!: (value: { items: (typeof task)[] }) => void;
    mockListConversations.mockReturnValue(
      new Promise((resolve) => {
        finishLoad = resolve;
      }),
    );
    mockMarkConversationViewed
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(
      ({ activeId }) => {
        const context = useConversations();
        useActiveConversationSync({
          activeConversationId: activeId,
          items: context.conversations,
          refreshConversations: context.refreshConversations,
          markConversationViewed: context.markConversationViewed,
          conversationIdsMatch,
          toPanelConversationId,
        });
        return context;
      },
      {
        wrapper: ConversationsProvider,
        initialProps: { activeId: 'bucket/.scheduler/task/run' },
      },
    );
    await act(async () => {
      finishLoad({ items: [task] });
    });
    await waitFor(() =>
      expect(mockMarkConversationViewed).toHaveBeenCalledTimes(1),
    );
    expect(result.current.conversations[0].isUnread).toBe(true);
    await act(async () => result.current.refreshConversations());
    expect(mockMarkConversationViewed).toHaveBeenCalledTimes(1);
    rerender({ activeId: 'another-chat' });
    rerender({ activeId: 'bucket/.scheduler/task/run' });
    await waitFor(() =>
      expect(result.current.conversations[0].isUnread).toBe(false),
    );
    expect(mockMarkConversationViewed).toHaveBeenCalledTimes(2);
  });

  it('deduplicates simultaneous views and preserves read state through stale list responses', async () => {
    const task = {
      ...seedConversations[0],
      id: 'conversations/bucket/.scheduler/task/run',
      isScheduledTask: true,
      isUnread: true,
    };
    mockListConversations.mockResolvedValue({ items: [task] });
    let finishView!: () => void;
    mockMarkConversationViewed.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishView = resolve;
      }),
    );
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let viewing!: Promise<void>;
    act(() => {
      viewing = result.current.markConversationViewed(task.id);
      void result.current.markConversationViewed('bucket/.scheduler/task/run');
    });
    expect(mockMarkConversationViewed).toHaveBeenCalledTimes(1);
    expect(mockMarkConversationViewed).toHaveBeenCalledWith(
      '.scheduler/task/run',
    );
    await act(async () => result.current.refreshConversations());
    expect(result.current.conversations[0].isUnread).toBe(false);
    await act(async () => {
      finishView();
      await viewing;
    });
    await act(async () => result.current.refreshConversations());
    expect(result.current.conversations[0].isUnread).toBe(false);
    expect(mockMarkConversationViewed).toHaveBeenCalledTimes(1);
  });

  it('matches encoded route ids and only marks the selected run viewed', async () => {
    const task = {
      ...seedConversations[0],
      id: 'conversations/bucket/.scheduler/task/run 1',
      isScheduledTask: true,
      isUnread: true,
    };
    mockListConversations.mockResolvedValue({
      items: [
        task,
        { ...task, id: 'conversations/bucket/.scheduler/task/run2' },
      ],
    });
    mockMarkConversationViewed.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () =>
      result.current.markConversationViewed('bucket/.scheduler/task/run%201'),
    );
    expect(result.current.conversations.map((item) => item.isUnread)).toEqual([
      false,
      true,
    ]);
  });

  it('allows another view attempt after a failed write and refresh', async () => {
    const task = {
      ...seedConversations[0],
      isScheduledTask: true,
      isUnread: true,
    };
    mockListConversations.mockResolvedValue({ items: [task] });
    mockMarkConversationViewed
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.markConversationViewed(task.id));
    await act(async () => result.current.refreshConversations());
    expect(result.current.conversations[0].isUnread).toBe(true);
    await act(async () => result.current.markConversationViewed(task.id));
    expect(result.current.conversations[0].isUnread).toBe(false);
    expect(mockMarkConversationViewed).toHaveBeenCalledTimes(2);
  });

  it("discards the previous identity's pending refresh and failed viewed write", async () => {
    const task = {
      ...seedConversations[0],
      isScheduledTask: true,
      isUnread: true,
    };
    mockListConversations.mockResolvedValue({ items: [task] });
    let failView!: (error: Error) => void;
    mockMarkConversationViewed.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        failView = reject;
      }),
    );
    const { result, rerender } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let viewing!: Promise<void>;
    let refreshing!: Promise<void>;
    let finishRefresh!: (value: { items: (typeof task)[] }) => void;
    mockListConversations.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRefresh = resolve;
      }),
    );
    act(() => {
      viewing = result.current.markConversationViewed(task.id);
      refreshing = result.current.refreshConversations();
    });
    mockListConversations.mockResolvedValue({
      items: [{ ...task, title: 'New identity', isUnread: false }],
    });
    contextMocks.userSub = 'user-2';
    rerender();
    await waitFor(() =>
      expect(result.current.conversations[0]?.title).toBe('New identity'),
    );
    await act(async () => {
      failView(new Error('old request'));
      finishRefresh({ items: [task] });
      await Promise.all([viewing, refreshing]);
    });
    expect(result.current.conversations[0]).toMatchObject({
      title: 'New identity',
      isUnread: false,
    });
  });

  it('does not carry successful viewed ids into another identity', async () => {
    const task = {
      ...seedConversations[0],
      isScheduledTask: true,
      isUnread: true,
    };
    mockListConversations.mockResolvedValue({ items: [task] });
    mockMarkConversationViewed.mockResolvedValue(undefined);
    const { result, rerender } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.markConversationViewed(task.id));
    contextMocks.userSub = 'user-2';
    rerender();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversations[0].isUnread).toBe(true);
  });

  const unreadTaskConversations = [
    {
      id: 'task1',
      title: 'Task 1',
      isPinned: false,
      updatedAt: 0,
      sharedWithMe: false,
      publishedWithMe: false,
      isReadonly: false,
      isScheduledTask: true,
      isUnread: true,
    },
    ...seedConversations.slice(1),
  ];

  it('optimistically clears isUnread before the API resolves', async () => {
    mockListConversations.mockResolvedValueOnce({
      items: unreadTaskConversations,
    });
    let resolveMark!: () => void;
    mockMarkConversationViewed.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMark = () => resolve(undefined);
      }),
    );

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    let markPromise!: Promise<void>;
    act(() => {
      markPromise = result.current.markConversationViewed('task1');
    });

    expect(
      result.current.conversations.find((c) => c.id === 'task1')?.isUnread,
    ).toBe(false);

    resolveMark();
    await act(async () => {
      await markPromise;
    });
  });

  it('rolls back isUnread to true when the API call fails', async () => {
    mockListConversations.mockResolvedValueOnce({
      items: unreadTaskConversations,
    });
    mockMarkConversationViewed.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    await act(async () => {
      await result.current.markConversationViewed('task1');
    });

    expect(
      result.current.conversations.find((c) => c.id === 'task1')?.isUnread,
    ).toBe(true);
  });

  it('is a no-op for a conversation that is not scheduler-created', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    await act(async () => {
      await result.current.markConversationViewed('conv1');
    });

    expect(mockMarkConversationViewed).not.toHaveBeenCalled();
  });

  it('is a no-op for a scheduler-created conversation that is already read', async () => {
    mockListConversations.mockResolvedValueOnce({
      items: [
        {
          ...unreadTaskConversations[0],
          isUnread: false,
        },
        ...seedConversations.slice(1),
      ],
    });

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    await act(async () => {
      await result.current.markConversationViewed('task1');
    });

    expect(mockMarkConversationViewed).not.toHaveBeenCalled();
  });
});

describe('ConversationsContext — watchForDisplayNameUpdate', () => {
  const buildUpdateEventStream = (
    events: Array<{ action: string; url?: string }> = [{ action: 'UPDATE' }],
  ) => {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        }
        controller.close();
      },
    });
  };

  const startWatch = async (conversationId: string) => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));
    const onUpdated = vi.fn();
    act(() => {
      result.current.watchForDisplayNameUpdate(
        conversationId,
        'Old Name',
        onUpdated,
      );
    });
    return onUpdated;
  };

  it('ignores an UPDATE event for a different resource URL', async () => {
    vi.mocked(conversationsApi.watchConversation).mockResolvedValueOnce(
      buildUpdateEventStream([
        { action: 'UPDATE', url: 'conversations/bucket/other__uuid' },
      ]),
    );

    const onUpdated = await startWatch('bucket/model__title__uuid');

    await waitFor(() =>
      expect(conversationsApi.watchConversation).toHaveBeenCalled(),
    );
    /* Let the stream drain before asserting nothing was fetched. */
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(conversationsApi.getConversation).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('closes the watch connection once a qualifying update arrives', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(conversationsApi.watchConversation).mockImplementationOnce(
      async (_path, abortSignal) => {
        signal = abortSignal;
        return buildUpdateEventStream([
          {
            action: 'UPDATE',
            url: 'conversations/bucket/model__title%20one__uuid',
          },
        ]);
      },
    );
    vi.mocked(conversationsApi.getConversation).mockResolvedValueOnce({
      name: 'New Name',
    } as never);

    const onUpdated = await startWatch('bucket/model__title one__uuid');

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith('New Name'));
    expect(signal?.aborted).toBe(true);
  });

  /*
   * Regression test: `getConversation`'s backend contract requires the bucket
   * to remain in `path` (unlike `watchConversation`'s bucket-stripped body
   * field) — passing the stripped path here previously caused a 400 once the
   * conversation id embedded a slash-containing Quick App deployment id.
   */
  it('calls getConversation with the full, bucket-included conversation id while watchConversation gets the bucket-stripped path', async () => {
    const conversationId =
      'bucket/applications/bucket/My%20App__0.0.1__title__uuid';

    vi.mocked(conversationsApi.watchConversation).mockResolvedValueOnce(
      buildUpdateEventStream(),
    );
    vi.mocked(conversationsApi.getConversation).mockResolvedValueOnce({
      name: 'New Name',
    } as never);

    const { result } = renderHook(() => useConversations(), {
      wrapper: ConversationsProvider,
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    const onUpdated = vi.fn();
    act(() => {
      result.current.watchForDisplayNameUpdate(
        conversationId,
        'Old Name',
        onUpdated,
      );
    });

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith('New Name'));

    expect(conversationsApi.getConversation).toHaveBeenCalledWith(
      'bucket/applications/bucket/My App__0.0.1__title__uuid',
    );
    expect(conversationsApi.watchConversation).toHaveBeenCalledWith(
      'applications/bucket/My App__0.0.1__title__uuid',
      expect.anything(),
    );
  });
});

describe('ConversationsContext — overlay mode', () => {
  const overlayWrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      OverlayProvider,
      null,
      createElement(ConversationsProvider, null, children),
    );

  it('emits CONVERSATIONS_UPDATED once the list loads', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: overlayWrapper,
    });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: OverlayRequestType.SetOverlayOptions,
          requestId: 'setup',
          payload: { hostDomain: 'https://partner.example.com' },
        },
        source: window.parent,
        origin: 'https://partner.example.com',
      }),
    );
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    await waitFor(() => expect(result.current.conversations).toHaveLength(3));

    const eventTypes = postMessageSpy.mock.calls.map(
      ([message]) => (message as { type?: string }).type,
    );
    expect(eventTypes).toContain(OverlayEventType.ConversationsUpdated);
  });
});
