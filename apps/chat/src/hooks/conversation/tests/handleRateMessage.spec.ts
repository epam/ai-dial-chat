import { MessageRating, MessageRole } from '@epam/ai-dial-chat-shared';
import type { Conversation, Message } from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveConversation } from '../../../server-api/conversations.api';
import { rateMessage } from '../../../server-api/rate.api';
import { useConversationHandlers } from '../useConversationHandlers';

vi.mock('../../../utils/attachment-to-dto', () => ({
  attachmentsToDtos: vi.fn(),
}));
vi.mock('../../../utils/build-upload-path', () => ({
  buildUploadPath: vi.fn((fileName: string) => `uploads/${fileName}`),
}));
vi.mock('../../../server-api/files.api', () => ({
  uploadFile: vi.fn(),
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(() => ({ selectedItemId: 'model-id' })),
}));
vi.mock('../../../server-api/conversations.api', () => ({
  deleteConversation: vi.fn(),
  saveConversation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../server-api/rate.api', () => ({
  rateMessage: vi.fn().mockResolvedValue(undefined),
}));

const mockSaveConversation = vi.mocked(saveConversation);
const mockRateMessage = vi.mocked(rateMessage);

const makeAssistantMessage = (overrides?: Partial<Message>): Message =>
  ({
    role: MessageRole.Assistant,
    content: 'assistant response',
    responseId: 'resp-abc',
    ...overrides,
  }) as Message;

const makeConversation = (messages: Message[] = []): Conversation =>
  ({
    id: 'bucket/conv-1',
    name: 'Test',
    model: { id: 'gpt-4o' },
    messages,
    folderId: '',
    prompt: '',
    temperature: 0,
    lastActivityDate: Date.now(),
    updatedAt: Date.now(),
    selectedAddons: [],
    assistantModelId: '',
  }) as Conversation;

const makeParams = (conversation: Conversation) => {
  const conversationRef = { current: conversation };
  const setConversation = vi.fn(
    (value: SetStateAction<Conversation | null>) => {
      if (typeof value === 'function') {
        const next = value(conversationRef.current);
        if (next != null) conversationRef.current = next;
      }
    },
  ) as unknown as Dispatch<SetStateAction<Conversation | null>>;
  return {
    conversation,
    conversationId: 'bucket/conv-1',
    bucket: 'bucket',
    isStreaming: false,
    startStream: vi.fn(),
    conversationRef,
    setConversation,
    navigate: vi.fn(),
  };
};

describe('useConversationHandlers — handleRateMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls rateMessage API with rate 1 on Like and returns true', async () => {
    const msg = makeAssistantMessage({ responseId: 'resp-abc' });
    const conversation = makeConversation([msg]);
    const params = makeParams(conversation);
    const { result } = renderHook(() => useConversationHandlers(params));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleRateMessage(0, MessageRating.Like);
    });

    expect(success).toBe(true);
    expect(mockRateMessage).toHaveBeenCalledWith({
      conversationId: 'bucket/conv-1',
      responseId: 'resp-abc',
      modelId: 'gpt-4o',
      rate: MessageRating.Like,
    });
    expect(mockSaveConversation).toHaveBeenCalledOnce();
  });

  it('calls rateMessage API with rate -1 and comment on Dislike', async () => {
    const msg = makeAssistantMessage({ responseId: 'resp-abc' });
    const conversation = makeConversation([msg]);
    const params = makeParams(conversation);
    const { result } = renderHook(() => useConversationHandlers(params));

    await act(async () => {
      await result.current.handleRateMessage(
        0,
        MessageRating.Dislike,
        'Overactive refusal: Too cautious',
      );
    });

    expect(mockRateMessage).toHaveBeenCalledWith({
      conversationId: 'bucket/conv-1',
      responseId: 'resp-abc',
      modelId: 'gpt-4o',
      rate: MessageRating.Dislike,
      comment: 'Overactive refusal: Too cautious',
    });
  });

  it('does not call rateMessage when toggling off (rating null), saves and returns true', async () => {
    const msg = makeAssistantMessage({ rating: MessageRating.Like });
    const conversation = makeConversation([msg]);
    const params = makeParams(conversation);
    const { result } = renderHook(() => useConversationHandlers(params));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleRateMessage(0, null);
    });

    expect(success).toBe(true);
    expect(mockRateMessage).not.toHaveBeenCalled();
    expect(mockSaveConversation).toHaveBeenCalledOnce();
  });

  it('applies optimistic update before API call', async () => {
    const msg = makeAssistantMessage({ rating: undefined });
    const conversation = makeConversation([msg]);
    const params = makeParams(conversation);
    const { result } = renderHook(() => useConversationHandlers(params));

    mockRateMessage.mockImplementation(() => {
      expect(params.conversationRef.current.messages[0].rating).toBe(
        MessageRating.Like,
      );
      return Promise.resolve();
    });

    await act(async () => {
      await result.current.handleRateMessage(0, MessageRating.Like);
    });
  });

  it('reverts optimistic update when rateMessage API fails', async () => {
    const msg = makeAssistantMessage({ rating: undefined });
    const conversation = makeConversation([msg]);
    const params = makeParams(conversation);
    const { result } = renderHook(() => useConversationHandlers(params));

    mockRateMessage.mockRejectedValue(new Error('network error'));

    await act(async () => {
      const success = await result.current.handleRateMessage(
        0,
        MessageRating.Like,
      );
      expect(success).toBe(false);
    });

    expect(params.conversationRef.current.messages[0].rating).toBeUndefined();
  });

  it('reverts optimistic update when saveConversation fails after API succeeds', async () => {
    const msg = makeAssistantMessage({ rating: undefined });
    const conversation = makeConversation([msg]);
    const params = makeParams(conversation);
    const { result } = renderHook(() => useConversationHandlers(params));

    mockSaveConversation.mockRejectedValue(new Error('save error'));

    await act(async () => {
      const success = await result.current.handleRateMessage(
        0,
        MessageRating.Like,
      );
      expect(success).toBe(false);
    });

    expect(params.conversationRef.current.messages[0].rating).toBeUndefined();
  });

  it('returns false and reverts when message has no responseId', async () => {
    const msg = makeAssistantMessage({ responseId: undefined });
    const conversation = makeConversation([msg]);
    const params = makeParams(conversation);
    const { result } = renderHook(() => useConversationHandlers(params));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleRateMessage(0, MessageRating.Like);
    });

    expect(success).toBe(false);
    expect(mockRateMessage).not.toHaveBeenCalled();
  });

  it('returns false when conversationId is undefined', async () => {
    const conversation = makeConversation([makeAssistantMessage()]);
    const params = makeParams(conversation);
    const paramsWithoutId = { ...params, conversationId: undefined };
    const { result } = renderHook(() =>
      useConversationHandlers(paramsWithoutId),
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleRateMessage(0, MessageRating.Like);
    });

    expect(success).toBe(false);
    expect(mockRateMessage).not.toHaveBeenCalled();
  });
});
