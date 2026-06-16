import type { Conversation } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { streamCompletion } from '../../../server-api/chat-stream.api';
import { saveConversation } from '../../../server-api/conversations.api';
import { useConversationStream } from '../useConversationStream';

vi.mock('../../../server-api/chat-stream.api', () => ({
  streamCompletion: vi.fn(),
}));
vi.mock('../../../server-api/conversations.api', () => ({
  saveConversation: vi.fn().mockResolvedValue(undefined),
}));

const mockStreamCompletion = vi.mocked(streamCompletion);
const mockSaveConversation = vi.mocked(saveConversation);

describe('useConversationStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamCompletion.mockImplementation(
      (_path, _message, _model, options) => {
        void options.onComplete();
      },
    );
  });

  it('streams with the full conversation id and saves with the storage path', async () => {
    const conversation = {
      id: 'conversation-1',
      messages: [],
    } as unknown as Conversation;
    const params = {
      conversationId:
        'bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
      stoppedGeneratingText: 'Stopped',
      setConversation: vi.fn(),
      conversationRef: { current: conversation },
    };

    const { result } = renderHook(() => useConversationStream(params));

    await act(async () => {
      result.current.startStream(
        'bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
        'hello',
        0,
        'applications/catalog/Team%2FApp%20One__0.0.1',
      );
    });

    expect(mockStreamCompletion).toHaveBeenCalledWith(
      'bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
      'hello',
      'applications/catalog/Team%2FApp%20One__0.0.1',
      expect.any(Object),
      undefined,
    );
    await waitFor(() => {
      expect(mockSaveConversation).toHaveBeenCalledWith(
        'applications/catalog/Team%2FApp%20One__0.0.1__title',
        conversation,
      );
    });
  });
});
