import {
  MessageRating,
  type Conversation,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useConversationHandlers,
  type UseConversationHandlersParams,
} from '../useConversationHandlers';

const makeConversation = (
  overrides: Partial<Conversation> = {},
): Conversation => ({
  id: 'bucket/gpt-4o__Hello',
  folderId: 'bucket',
  name: 'Hello',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 1,
  messages: [],
  lastActivityDate: 1000,
  updatedAt: 2000,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
  ...overrides,
});

/** Mocks stable across re-renders (created once per test via `useRef`, not recreated on every render). */
const useStableMocks = () => {
  const ref = useRef<
    | {
        startStream: ReturnType<typeof vi.fn>;
        uploadFile: ReturnType<typeof vi.fn>;
        saveConversation: ReturnType<typeof vi.fn>;
        deleteConversation: ReturnType<typeof vi.fn>;
        rateMessage: ReturnType<typeof vi.fn>;
        onConversationDeleted: ReturnType<typeof vi.fn>;
        resolveModelId: ReturnType<typeof vi.fn>;
      }
    | undefined
  >(undefined);
  if (!ref.current) {
    ref.current = {
      startStream: vi.fn(),
      uploadFile: vi.fn().mockResolvedValue({ url: 'files/bucket/file.png' }),
      saveConversation: vi.fn().mockResolvedValue(undefined),
      deleteConversation: vi.fn().mockResolvedValue(undefined),
      rateMessage: vi.fn().mockResolvedValue(undefined),
      onConversationDeleted: vi.fn(),
      resolveModelId: vi.fn(() => 'selected-model'),
    };
  }
  return ref.current;
};

const useHarness = (overrides: Partial<UseConversationHandlersParams> = {}) => {
  const [conversation, setConversation] = useState<Conversation | null>(
    overrides.conversation !== undefined
      ? overrides.conversation
      : makeConversation(),
  );
  const conversationRef = useRef<Conversation | null>(conversation);
  conversationRef.current = conversation;

  const {
    startStream,
    uploadFile,
    saveConversation,
    deleteConversation,
    rateMessage,
    onConversationDeleted,
    resolveModelId,
  } = useStableMocks();

  const handlers = useConversationHandlers({
    conversation,
    conversationId: conversation?.id,
    bucket: 'bucket',
    isStreaming: false,
    startStream,
    state: { setConversation, conversationRef },
    filesApi: { uploadFile },
    conversationsApi: { saveConversation, deleteConversation },
    rateApi: { rateMessage },
    resolveModelId,
    onConversationDeleted,
    ...overrides,
  } as UseConversationHandlersParams);

  return {
    conversation,
    handlers,
    startStream,
    uploadFile,
    saveConversation,
    deleteConversation,
    rateMessage,
    onConversationDeleted,
    resolveModelId,
  };
};

describe('useConversationHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSend', () => {
    it('appends an optimistic user+assistant pair before streaming', async () => {
      const { result } = renderHook(() => useHarness());

      await act(() => result.current.handlers.handleSend('hi', []));

      expect(result.current.conversation?.messages).toHaveLength(2);
      expect(result.current.startStream).toHaveBeenCalledOnce();
    });

    it('calls startStream with the resolved model id', async () => {
      const { result } = renderHook(() => useHarness());

      await act(() => result.current.handlers.handleSend('hi', []));

      expect(result.current.startStream).toHaveBeenCalledWith(
        'bucket/gpt-4o__Hello',
        'hi',
        1,
        'selected-model',
        undefined,
        expect.any(String),
        'append',
      );
    });

    it('returns early when there is no conversation id', async () => {
      const { result } = renderHook(() =>
        useHarness({ conversation: null, conversationId: undefined }),
      );

      await act(() => result.current.handlers.handleSend('hi', []));

      expect(result.current.startStream).not.toHaveBeenCalled();
    });

    it('forwards active tool configuration in custom_content', async () => {
      const { result } = renderHook(() =>
        useHarness({ toolConfigurationValue: { web: true } }),
      );

      await act(() => result.current.handlers.handleSend('hi', []));

      expect(result.current.startStream).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        { configuration_value: { web: true } },
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('handleRegenerateMessage', () => {
    it('truncates the assistant message and restarts the stream', () => {
      const conversation = makeConversation({
        messages: [
          { role: 'user' as never, content: 'hi', timestamp: 't' },
          { role: 'assistant' as never, content: 'old', timestamp: 't' },
        ],
      });
      const { result } = renderHook(() => useHarness({ conversation }));

      act(() => result.current.handlers.handleRegenerateMessage(1));

      expect(result.current.conversation?.messages[1].content).toBe('');
      expect(result.current.startStream).toHaveBeenCalledWith(
        conversation.id,
        'hi',
        1,
        'selected-model',
        undefined,
        expect.any(String),
        'regenerate',
      );
    });

    it('does nothing while streaming', () => {
      const conversation = makeConversation({
        messages: [
          { role: 'user' as never, content: 'hi', timestamp: 't' },
          { role: 'assistant' as never, content: 'old', timestamp: 't' },
        ],
      });
      const { result } = renderHook(() =>
        useHarness({ conversation, isStreaming: true }),
      );

      act(() => result.current.handlers.handleRegenerateMessage(1));

      expect(result.current.startStream).not.toHaveBeenCalled();
    });
  });

  describe('handleConfirmDelete', () => {
    it('removes a user+assistant pair and saves the conversation', () => {
      const conversation = makeConversation({
        messages: [
          { role: 'user' as never, content: 'a', timestamp: 't' },
          { role: 'assistant' as never, content: 'b', timestamp: 't' },
          { role: 'user' as never, content: 'c', timestamp: 't' },
          { role: 'assistant' as never, content: 'd', timestamp: 't' },
        ],
      });
      const { result } = renderHook(() => useHarness({ conversation }));

      act(() => result.current.handlers.handleDeleteMessage(2));
      act(() => result.current.handlers.handleConfirmDelete());

      expect(result.current.conversation?.messages).toHaveLength(2);
      expect(result.current.saveConversation).toHaveBeenCalledOnce();
      expect(result.current.deleteConversation).not.toHaveBeenCalled();
    });

    it('deletes the whole conversation when it empties to nothing', () => {
      const conversation = makeConversation({
        messages: [
          { role: 'user' as never, content: 'a', timestamp: 't' },
          { role: 'assistant' as never, content: 'b', timestamp: 't' },
        ],
      });
      const { result } = renderHook(() => useHarness({ conversation }));

      act(() => result.current.handlers.handleDeleteMessage(0));
      act(() => result.current.handlers.handleConfirmDelete());

      expect(result.current.deleteConversation).toHaveBeenCalledOnce();
      expect(result.current.onConversationDeleted).toHaveBeenCalledOnce();
      expect(result.current.saveConversation).not.toHaveBeenCalled();
    });
  });

  describe('handleRateMessage', () => {
    const conversationWithResponse = makeConversation({
      messages: [
        {
          role: 'assistant' as never,
          content: 'hi',
          timestamp: 't',
          responseId: 'r1',
        } as never,
      ],
    });

    it('calls rateApi.rateMessage with rate 1 on like and returns true', async () => {
      const { result } = renderHook(() =>
        useHarness({ conversation: conversationWithResponse }),
      );

      const ok = await act(() =>
        result.current.handlers.handleRateMessage(0, MessageRating.Like),
      );

      expect(result.current.rateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          rateMessageDto: expect.objectContaining({ rate: MessageRating.Like }),
        }),
      );
      expect(ok).toBe(true);
    });

    it('reverts the optimistic rating when rateMessage fails', async () => {
      const { result } = renderHook(() =>
        useHarness({ conversation: conversationWithResponse }),
      );
      result.current.rateMessage.mockRejectedValueOnce(new Error('fail'));

      const ok = await act(() =>
        result.current.handlers.handleRateMessage(0, MessageRating.Like),
      );

      expect(ok).toBe(false);
      expect(result.current.conversation?.messages[0].rating).toBeUndefined();
    });

    it('returns false without calling rateMessage when the message has no responseId', async () => {
      const conversation = makeConversation({
        messages: [
          { role: 'assistant' as never, content: 'hi', timestamp: 't' },
        ],
      });
      const { result } = renderHook(() => useHarness({ conversation }));

      const ok = await act(() =>
        result.current.handlers.handleRateMessage(0, MessageRating.Like),
      );

      expect(ok).toBe(false);
      expect(result.current.rateMessage).not.toHaveBeenCalled();
    });

    it('saves without calling rateMessage when toggling the rating off', async () => {
      const { result } = renderHook(() =>
        useHarness({ conversation: conversationWithResponse }),
      );

      const ok = await act(() =>
        result.current.handlers.handleRateMessage(0, null),
      );

      expect(result.current.rateMessage).not.toHaveBeenCalled();
      expect(result.current.saveConversation).toHaveBeenCalledOnce();
      expect(ok).toBe(true);
    });
  });

  describe('starter submission', () => {
    const starter = {
      const: 1,
      title: 'Starter',
      'dial:widgetOptions': {},
    } as unknown as StarterOption;

    it('submits directly when no confirmation is configured', () => {
      const { result } = renderHook(() => useHarness());

      act(() => result.current.handlers.handleButtonSelect(starter));

      expect(result.current.startStream).toHaveBeenCalledOnce();
    });

    it('holds the starter pending when a confirmation message is configured', () => {
      const confirmStarter = {
        ...starter,
        'dial:widgetOptions': { confirmationMessage: 'Are you sure?' },
      } as unknown as StarterOption;
      const { result } = renderHook(() => useHarness());

      act(() => result.current.handlers.handleButtonSelect(confirmStarter));
      expect(result.current.startStream).not.toHaveBeenCalled();
      expect(result.current.handlers.pendingStarterContext).not.toBeNull();

      act(() => result.current.handlers.handleConfirmStarter());
      expect(result.current.startStream).toHaveBeenCalledOnce();
    });
  });

  describe('handleUploadAttachment', () => {
    it('delegates to the injected filesApi', async () => {
      const { result } = renderHook(() => useHarness());

      await act(() =>
        result.current.handlers.handleUploadAttachment({
          name: 'file.png',
          contentType: 'image/png',
          file: new File([], 'file.png'),
        } as never),
      );

      expect(result.current.uploadFile).toHaveBeenCalledOnce();
    });
  });

  describe('handleStartEdit / handleCancelEdit', () => {
    it('marks a message index as editing and clears it on cancel', () => {
      const { result } = renderHook(() => useHarness());

      act(() => result.current.handlers.handleStartEdit(0));
      expect(result.current.handlers.editingMessageIndexes.has(0)).toBe(true);

      act(() => result.current.handlers.handleCancelEdit(0));
      expect(result.current.handlers.editingMessageIndexes.has(0)).toBe(false);
    });
  });

  describe('handleEditMessage', () => {
    const editableConversation = () =>
      makeConversation({
        messages: [
          {
            role: 'user' as never,
            content: 'Original question',
            timestamp: 't',
            custom_content: {
              configuration_value: { deep_research: true },
              attachments: [
                {
                  title: 'kept.pdf',
                  url: 'files/bucket/kept.pdf',
                  type: 'application/pdf',
                },
                {
                  title: 'dropped.pdf',
                  url: 'files/bucket/dropped.pdf',
                  type: 'application/pdf',
                },
              ],
            } as never,
          },
          {
            role: 'assistant' as never,
            content: 'Original answer',
            timestamp: 't',
          },
        ],
      });

    it('preserves non-attachment custom_content and restarts the stream in edit mode', async () => {
      const conversation = editableConversation();
      const { result } = renderHook(() => useHarness({ conversation }));

      await act(() =>
        result.current.handlers.handleEditMessage(
          0,
          'Edited question',
          [
            {
              id: 'files/bucket/kept.pdf',
              name: 'kept.pdf',
            } as never,
          ],
          [],
        ),
      );

      expect(result.current.startStream).toHaveBeenCalledWith(
        conversation.id,
        'Edited question',
        1,
        'selected-model',
        expect.objectContaining({
          configuration_value: { deep_research: true },
          attachments: [expect.objectContaining({ title: 'kept.pdf' })],
        }),
        expect.any(String),
        'edit',
      );
    });

    it('merges newly uploaded attachments alongside kept ones', async () => {
      const conversation = editableConversation();
      const { result } = renderHook(() => useHarness({ conversation }));

      await act(() =>
        result.current.handlers.handleEditMessage(
          0,
          'Edited question',
          [
            {
              id: 'files/bucket/kept.pdf',
              name: 'kept.pdf',
            } as never,
          ],
          [
            {
              name: 'new.png',
              contentType: 'image/png',
              url: 'files/bucket/new.png',
            } as never,
          ],
        ),
      );

      const [, , , , customContent] = result.current.startStream.mock.calls[0];
      expect(customContent.attachments).toHaveLength(2);
      expect(customContent.attachments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'kept.pdf' }),
          expect.objectContaining({ title: 'new.png' }),
        ]),
      );
    });

    it('clears editing state without restarting the stream when nothing changed', async () => {
      const conversation = editableConversation();
      const { result } = renderHook(() => useHarness({ conversation }));
      act(() => result.current.handlers.handleStartEdit(0));

      await act(() =>
        result.current.handlers.handleEditMessage(
          0,
          'Original question',
          [
            { id: 'files/bucket/kept.pdf', name: 'kept.pdf' } as never,
            { id: 'files/bucket/dropped.pdf', name: 'dropped.pdf' } as never,
          ],
          [],
        ),
      );

      expect(result.current.startStream).not.toHaveBeenCalled();
      expect(result.current.handlers.editingMessageIndexes.has(0)).toBe(false);
    });

    it('does nothing while streaming', async () => {
      const conversation = editableConversation();
      const { result } = renderHook(() =>
        useHarness({ conversation, isStreaming: true }),
      );

      await act(() =>
        result.current.handlers.handleEditMessage(0, 'Edited question', [], []),
      );

      expect(result.current.startStream).not.toHaveBeenCalled();
    });

    it('does nothing when the target message is not a user message', async () => {
      const conversation = editableConversation();
      const { result } = renderHook(() => useHarness({ conversation }));

      await act(() =>
        result.current.handlers.handleEditMessage(1, 'Edited answer', [], []),
      );

      expect(result.current.startStream).not.toHaveBeenCalled();
    });
  });
});
