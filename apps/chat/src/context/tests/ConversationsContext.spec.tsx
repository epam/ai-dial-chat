import {
  OverlayEventType,
  OverlayRequestType,
} from '@epam/ai-dial-chat-overlay';
import {
  ConversationDeletionFailureDtoCodeEnum,
  type ConversationDeletionResultDto,
} from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as conversationsApi from '../../server-api/conversations.api';
import * as userConfigApi from '../../server-api/user-config.api';
import { AuthStatus } from '../../types/auth-status';
import {
  ConversationsProvider,
  useConversations,
} from '../ConversationsContext';
import { OverlayProvider } from '../overlay/OverlayContext';

const contextMocks = vi.hoisted(() => ({
  userSub: 'user-1' as string | undefined,
}));

vi.mock('../../server-api/conversations.api');
vi.mock('../../server-api/user-config.api');
vi.mock('../UserConfigContext', () => ({
  useUserConfig: () => ({
    setPinnedConversation: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock('../AppConfigContext', () => ({
  useAppConfig: () => ({
    config: { overlayAllowedOrigins: ['https://partner.example.com'] },
  }),
}));
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
const mockRenameConversation = vi.mocked(conversationsApi.renameConversation);

const seedConversations = [
  {
    id: 'conv1',
    title: 'Chat 1',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
    isReadonly: false,
  },
  {
    id: 'conv2',
    title: 'Chat 2',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
    isReadonly: false,
  },
  {
    id: 'conv3',
    title: 'Chat 3',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
    isReadonly: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  contextMocks.userSub = 'user-1';
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

    act(() => {
      rerender();
    });

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

describe('ConversationsContext — watchForDisplayNameUpdate', () => {
  const buildUpdateEventStream = () => {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ action: 'UPDATE' })}\n\n`),
        );
        controller.close();
      },
    });
  };

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
