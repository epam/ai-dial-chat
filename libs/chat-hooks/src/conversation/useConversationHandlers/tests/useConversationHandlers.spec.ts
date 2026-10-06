import {
  MessageRating,
  MessageRole,
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

const useHarness = (
  overrides: Partial<UseConversationHandlersParams> = {},
  options: { keepRefInSync?: boolean } = {},
) => {
  const { keepRefInSync = true } = options;
  const [conversation, setConversation] = useState<Conversation | null>(
    overrides.conversation !== undefined
      ? overrides.conversation
      : makeConversation(),
  );
  const conversationRef = useRef<Conversation | null>(conversation);
  if (keepRefInSync) {
    conversationRef.current = conversation;
  }

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
    conversationRef,
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

    it.each([
      [false, true],
      [true, false],
    ])(
      'regenerates with the current tool toggle (stored deep_research: %s, current: %s)',
      (storedValue, currentValue) => {
        const conversation = makeConversation({
          messages: [
            {
              role: 'user' as never,
              content: 'hi',
              timestamp: 't',
              custom_content: {
                configuration_value: { deep_research: storedValue },
                attachments: [
                  {
                    title: 'a.pdf',
                    url: 'files/bucket/a.pdf',
                    type: 'application/pdf',
                  },
                ],
              } as never,
            },
            {
              role: 'assistant' as never,
              content: 'partial',
              timestamp: 't',
              wasStoppedByUser: true,
            },
          ],
        });
        const { result } = renderHook(() =>
          useHarness({
            conversation,
            toolConfigurationValue: { deep_research: currentValue },
          }),
        );

        act(() => result.current.handlers.handleRegenerateMessage(1));

        const expectedCustomContent = {
          configuration_value: { deep_research: currentValue },
          attachments: [expect.objectContaining({ title: 'a.pdf' })],
        };
        expect(result.current.startStream).toHaveBeenCalledWith(
          conversation.id,
          'hi',
          1,
          'selected-model',
          expectedCustomContent,
          expect.any(String),
          'regenerate',
        );
        expect(result.current.conversation?.messages[0].custom_content).toEqual(
          expectedCustomContent,
        );
      },
    );

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

    /**
     * Regression coverage for a code-review finding: handleConfirmDelete
     * reads `state.conversationRef.current` as its source of truth (moved
     * out of the `setConversation` updater so the delete side effects stay
     * outside React's render phase). The hook has no way to verify that ref
     * is actually kept in sync with `conversationId` — that contract is the
     * caller's responsibility (see `Conversation.tsx`'s ref sync fix). These
     * tests pin the hook's own behavior at each end of that contract.
     */
    it('is a safe no-op when conversationRef.current was never synced (null)', () => {
      const conversation = makeConversation({
        messages: [
          { role: 'user' as never, content: 'a', timestamp: 't' },
          { role: 'assistant' as never, content: 'b', timestamp: 't' },
        ],
      });
      const { result } = renderHook(() =>
        useHarness({ conversation }, { keepRefInSync: false }),
      );
      result.current.conversationRef.current = null;

      act(() => result.current.handlers.handleDeleteMessage(0));
      act(() => result.current.handlers.handleConfirmDelete());

      expect(result.current.deleteConversation).not.toHaveBeenCalled();
      expect(result.current.saveConversation).not.toHaveBeenCalled();
      expect(result.current.onConversationDeleted).not.toHaveBeenCalled();
    });

    it('computes the deletion from conversationRef.current, not the conversation prop', () => {
      const conversation = makeConversation({
        messages: [
          { role: 'user' as never, content: 'a', timestamp: 't' },
          { role: 'assistant' as never, content: 'b', timestamp: 't' },
          { role: 'user' as never, content: 'c', timestamp: 't' },
          { role: 'assistant' as never, content: 'd', timestamp: 't' },
        ],
      });
      const staleRefConversation = makeConversation({
        messages: [
          { role: 'user' as never, content: 'X', timestamp: 't' },
          { role: 'assistant' as never, content: 'Y', timestamp: 't' },
          { role: 'user' as never, content: 'Z', timestamp: 't' },
          { role: 'assistant' as never, content: 'W', timestamp: 't' },
        ],
      });
      const { result } = renderHook(() =>
        useHarness({ conversation }, { keepRefInSync: false }),
      );
      result.current.conversationRef.current = staleRefConversation;

      act(() => result.current.handlers.handleDeleteMessage(2));
      act(() => result.current.handlers.handleConfirmDelete());

      expect(result.current.saveConversation).toHaveBeenCalledOnce();
      const savedConversation = result.current.saveConversation.mock.calls[0][0]
        .saveConversationBodyDto.conversation as Conversation;
      expect(savedConversation.messages).toEqual([
        { role: 'user', content: 'X', timestamp: 't' },
        { role: 'assistant', content: 'Y', timestamp: 't' },
      ]);
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

    it('calls rateApi.rateMessage with rate null and saves when clearing an active Like', async () => {
      const conversationWithLike = makeConversation({
        messages: [
          {
            role: 'assistant' as never,
            content: 'hi',
            timestamp: 't',
            responseId: 'r1',
            rating: MessageRating.Like,
          } as never,
        ],
      });
      const { result } = renderHook(() =>
        useHarness({ conversation: conversationWithLike }),
      );

      const ok = await act(() =>
        result.current.handlers.handleRateMessage(0, null),
      );

      expect(result.current.rateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          rateMessageDto: expect.objectContaining({ rate: null }),
        }),
      );
      expect(result.current.saveConversation).toHaveBeenCalledOnce();
      expect(result.current.conversation?.messages[0].rating).toBeUndefined();
      expect(ok).toBe(true);
    });

    it('calls rateApi.rateMessage with rate null and saves when clearing an active Dislike', async () => {
      const conversationWithDislike = makeConversation({
        messages: [
          {
            role: 'assistant' as never,
            content: 'hi',
            timestamp: 't',
            responseId: 'r1',
            rating: MessageRating.Dislike,
          } as never,
        ],
      });
      const { result } = renderHook(() =>
        useHarness({ conversation: conversationWithDislike }),
      );

      const ok = await act(() =>
        result.current.handlers.handleRateMessage(0, null),
      );

      expect(result.current.rateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          rateMessageDto: expect.objectContaining({ rate: null }),
        }),
      );
      expect(result.current.saveConversation).toHaveBeenCalledOnce();
      expect(result.current.conversation?.messages[0].rating).toBeUndefined();
      expect(ok).toBe(true);
    });

    it('reverts the rating and does not save when the clear API call fails', async () => {
      const conversationWithLike = makeConversation({
        messages: [
          {
            role: 'assistant' as never,
            content: 'hi',
            timestamp: 't',
            responseId: 'r1',
            rating: MessageRating.Like,
          } as never,
        ],
      });
      const { result } = renderHook(() =>
        useHarness({ conversation: conversationWithLike }),
      );
      result.current.rateMessage.mockRejectedValueOnce(new Error('fail'));

      const ok = await act(() =>
        result.current.handlers.handleRateMessage(0, null),
      );

      expect(ok).toBe(false);
      expect(result.current.saveConversation).not.toHaveBeenCalled();
      expect(result.current.conversation?.messages[0].rating).toBe(
        MessageRating.Like,
      );
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

    it("submits the clicked starter's populateText, not the group description", () => {
      const followUp = {
        const: 0,
        title: 'How does feature X work?',
        'dial:widgetOptions': {
          populateText:
            'How does feature X work, and what are its configuration options?',
          submit: true,
          confirmationMessage: null,
        },
      } as StarterOption;
      const { result } = renderHook(() => useHarness());

      act(() =>
        result.current.handlers.handleButtonSelect(
          followUp,
          'button',
          'Follow-Up Questions',
        ),
      );

      expect(result.current.startStream).toHaveBeenCalledWith(
        'bucket/gpt-4o__Hello',
        'How does feature X work, and what are its configuration options?',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(result.current.conversation?.messages[0].content).toBe(
        'How does feature X work, and what are its configuration options?',
      );
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

    it.each([
      [true, false],
      [false, true],
    ])(
      'resubmits with the current tool toggle (stored deep_research: %s, current: %s)',
      async (storedValue, currentValue) => {
        const conversation = editableConversation();
        conversation.messages[0].custom_content = {
          ...conversation.messages[0].custom_content,
          configuration_value: { deep_research: storedValue },
        };
        const { result } = renderHook(() =>
          useHarness({
            conversation,
            toolConfigurationValue: { deep_research: currentValue },
          }),
        );

        await act(() =>
          result.current.handlers.handleEditMessage(
            0,
            'Edited question',
            [{ id: 'files/bucket/kept.pdf', name: 'kept.pdf' } as never],
            [],
          ),
        );

        const expectedCustomContent = {
          configuration_value: { deep_research: currentValue },
          attachments: [expect.objectContaining({ title: 'kept.pdf' })],
        };
        expect(result.current.startStream).toHaveBeenCalledWith(
          conversation.id,
          'Edited question',
          1,
          'selected-model',
          expectedCustomContent,
          expect.any(String),
          'edit',
        );
        expect(result.current.conversation?.messages[0].custom_content).toEqual(
          expectedCustomContent,
        );
      },
    );

    it('forwards an active tool configuration when the edited message had no custom_content', async () => {
      const conversation = makeConversation({
        messages: [
          {
            role: 'user' as never,
            content: 'Original question',
            timestamp: 't',
          },
          { role: 'assistant' as never, content: 'Answer', timestamp: 't' },
        ],
      });
      const { result } = renderHook(() =>
        useHarness({
          conversation,
          toolConfigurationValue: { deep_research: true },
        }),
      );

      await act(() =>
        result.current.handlers.handleEditMessage(0, 'Edited question', [], []),
      );

      expect(result.current.startStream).toHaveBeenCalledWith(
        conversation.id,
        'Edited question',
        1,
        'selected-model',
        { configuration_value: { deep_research: true } },
        expect.any(String),
        'edit',
      );
    });

    it('uses the tool configuration from the latest render', async () => {
      const conversation = makeConversation({
        messages: [
          {
            role: 'user' as never,
            content: 'Original question',
            timestamp: 't',
          },
          { role: 'assistant' as never, content: 'Answer', timestamp: 't' },
        ],
      });
      const { result, rerender } = renderHook(
        ({ toolConfigurationValue }) =>
          useHarness({ conversation, toolConfigurationValue }),
        {
          initialProps: {
            toolConfigurationValue: undefined as
              Record<string, boolean> | undefined,
          },
        },
      );
      rerender({ toolConfigurationValue: { deep_research: true } });

      await act(() =>
        result.current.handlers.handleEditMessage(0, 'Edited question', [], []),
      );

      expect(result.current.startStream).toHaveBeenCalledWith(
        conversation.id,
        'Edited question',
        1,
        'selected-model',
        { configuration_value: { deep_research: true } },
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

    it('re-runs the generation when nothing changed but the answer was stopped', async () => {
      const conversation = makeConversation({
        messages: [
          {
            role: 'user' as never,
            content: 'Original question',
            timestamp: 't',
          },
          {
            role: 'assistant' as never,
            content: 'Partial answer',
            timestamp: 't',
            wasStoppedByUser: true,
          },
        ],
      });
      const { result } = renderHook(() => useHarness({ conversation }));
      act(() => result.current.handlers.handleStartEdit(0));

      await act(() =>
        result.current.handlers.handleEditMessage(
          0,
          'Original question',
          [],
          [],
        ),
      );

      expect(result.current.startStream).toHaveBeenCalledWith(
        conversation.id,
        'Original question',
        1,
        'selected-model',
        undefined,
        expect.any(String),
        'edit',
      );
      expect(result.current.handlers.editingMessageIndexes.has(0)).toBe(false);
    });

    it('updates conversationRef before starting the stream', async () => {
      const conversation = editableConversation();
      const { result } = renderHook(() =>
        useHarness({ conversation }, { keepRefInSync: false }),
      );
      /* startStream seeds its live-message buffer from the ref, so the edit has
         to be visible there by the time it runs. */
      const refMessagesAtStreamStart: unknown[] = [];
      result.current.startStream.mockImplementation(() => {
        refMessagesAtStreamStart.push(
          result.current.conversationRef.current?.messages,
        );
      });

      await act(() =>
        result.current.handlers.handleEditMessage(0, 'Edited question', [], []),
      );

      expect(refMessagesAtStreamStart[0]).toEqual([
        expect.objectContaining({ content: 'Edited question' }),
        expect.objectContaining({ role: 'assistant', content: '' }),
      ]);
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

describe('useConversationHandlers — identity across conversation updates', () => {
  const withRatedAnswer = (content: string): Conversation =>
    makeConversation({
      messages: [
        { role: MessageRole.User, content: 'question' },
        {
          role: MessageRole.Assistant,
          content,
          responseId: 'response-1',
          rating: MessageRating.Like,
        },
      ] as Conversation['messages'],
    });

  const renderWithConversation = (initial: Conversation) => {
    const conversationRef: { current: Conversation | null } = {
      current: initial,
    };
    const saveConversation = vi.fn().mockResolvedValue(undefined);
    const rateMessage = vi.fn().mockResolvedValue(undefined);
    const base = {
      conversationId: initial.id,
      bucket: 'bucket',
      isStreaming: false,
      startStream: vi.fn(),
      state: { setConversation: vi.fn(), conversationRef },
      filesApi: { uploadFile: vi.fn() },
      conversationsApi: {
        saveConversation,
        deleteConversation: vi.fn(),
      },
      rateApi: { rateMessage },
      resolveModelId: () => 'selected-model',
      onConversationDeleted: vi.fn(),
    } as unknown as Omit<UseConversationHandlersParams, 'conversation'>;
    const view = renderHook(
      ({ conversation }: { conversation: Conversation }) =>
        useConversationHandlers({ ...base, conversation }),
      { initialProps: { conversation: initial } },
    );
    return { ...view, conversationRef, saveConversation };
  };

  it('keeps the conversation-reading callbacks when the conversation object changes', () => {
    const first = withRatedAnswer('first');
    const { result, rerender, conversationRef } = renderWithConversation(first);
    const before = result.current;

    const second = withRatedAnswer('second');
    conversationRef.current = second;
    rerender({ conversation: second });

    expect(result.current.handleRegenerateMessage).toBe(
      before.handleRegenerateMessage,
    );
    expect(result.current.handleRateMessage).toBe(before.handleRateMessage);
    expect(result.current.handleButtonSelect).toBe(before.handleButtonSelect);
    expect(result.current.handleEditMessage).toBe(before.handleEditMessage);
  });

  it('acts on the latest conversation through a callback obtained earlier', async () => {
    const first = withRatedAnswer('first');
    const { result, rerender, conversationRef, saveConversation } =
      renderWithConversation(first);
    const { handleRateMessage } = result.current;

    const second = withRatedAnswer('second');
    conversationRef.current = second;
    rerender({ conversation: second });

    await act(async () => {
      await handleRateMessage(1, null);
    });

    const saved =
      saveConversation.mock.calls[0][0].saveConversationBodyDto.conversation;
    expect(saved.messages[1].content).toBe('second');
    expect(saved.messages[1].rating).toBeUndefined();
  });

  it('does not persist a rating whose rate request failed', async () => {
    /* keepRefInSync: false — only the handlers write the ref, as in a host. */
    const conversation = makeConversation({
      messages: [
        { role: MessageRole.User, content: 'q1' },
        { role: MessageRole.Assistant, content: 'a1', responseId: 'r1' },
        { role: MessageRole.User, content: 'q2' },
        { role: MessageRole.Assistant, content: 'a2', responseId: 'r2' },
      ] as Conversation['messages'],
    });
    const rateMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('rate failed'))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useHarness(
        { conversation, rateApi: { rateMessage } },
        { keepRefInSync: false },
      ),
    );

    await act(async () => {
      await result.current.handlers.handleRateMessage(1, MessageRating.Like);
    });
    await act(async () => {
      await result.current.handlers.handleRateMessage(3, MessageRating.Like);
    });

    const saved = result.current.saveConversation.mock.calls[0][0]
      .saveConversationBodyDto.conversation as Conversation;
    expect(saved.messages[1].rating).toBeUndefined();
    expect(saved.messages[3].rating).toBe(MessageRating.Like);
  });
});
