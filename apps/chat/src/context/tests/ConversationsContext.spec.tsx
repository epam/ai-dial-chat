import {
  ConversationDeletionFailureDtoCodeEnum,
  type ConversationDeletionResultDto,
} from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as conversationsApi from '../../server-api/conversations.api';
import * as userConfigApi from '../../server-api/user-config.api';
import {
  ConversationsProvider,
  useConversations,
} from '../ConversationsContext';

vi.mock('../../server-api/conversations.api');
vi.mock('../../server-api/user-config.api');
vi.mock('../../utils/conversation-path', () => ({
  getConversationPath: (id: string) => id,
}));

const mockListConversations = vi.mocked(conversationsApi.listConversations);
const mockDeleteAllConversations = vi.mocked(
  conversationsApi.deleteAllConversations,
);

const seedConversations = [
  {
    id: 'conv1',
    title: 'Chat 1',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
  },
  {
    id: 'conv2',
    title: 'Chat 2',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
  },
  {
    id: 'conv3',
    title: 'Chat 3',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userConfigApi.pinConversation).mockResolvedValue(undefined);
  mockListConversations.mockResolvedValue({ items: seedConversations });
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
      },
    ];
    mockListConversations.mockResolvedValueOnce({ items: refreshedConvs });

    let returned: ConversationDeletionResultDto | undefined;
    await act(async () => {
      returned = await result.current.deleteAllConversations();
    });

    expect(mockListConversations).toHaveBeenCalledTimes(2);
    expect(returned!.failed).toHaveLength(1);
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
