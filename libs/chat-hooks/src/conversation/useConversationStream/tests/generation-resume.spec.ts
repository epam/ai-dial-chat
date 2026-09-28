import type { Conversation } from '@epam/ai-dial-chat-shared';
import { MessageRole, StageStatus } from '@epam/ai-dial-chat-shared';
import { describe, expect, it, vi } from 'vitest';
import type { BufferedGeneration } from '../buffered-generation';
import {
  createResumeIfAwaitingGeneration,
  isAwaitingGenerationResume,
} from '../generation-resume';
import type { ConversationStreamTransport } from '../useConversationStream';

const makeConversation = (
  overrides: Partial<Conversation> = {},
): Conversation =>
  ({
    id: 'bucket/gpt-4o__Hello',
    folderId: 'bucket',
    name: 'Hello',
    model: { id: 'gpt-4o' },
    prompt: '',
    temperature: 1,
    messages: [
      {
        role: MessageRole.User,
        content: 'Hello',
        timestamp: new Date().toISOString(),
      },
      {
        role: MessageRole.Assistant,
        content: '',
        timestamp: new Date().toISOString(),
      },
    ],
    lastActivityDate: Date.now(),
    updatedAt: Date.now(),
    selectedAddons: [],
    assistantModelId: 'gpt-4o',
    ...overrides,
  }) as Conversation;

describe('isAwaitingGenerationResume', () => {
  it('returns true when the last message is an empty assistant placeholder', () => {
    expect(isAwaitingGenerationResume(makeConversation())).toBe(true);
  });

  it('returns false when the last assistant message has content', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: 'Hi there',
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the placeholder has a streamErrorMessage (empty string — error with no specific text)', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              streamErrorMessage: '',
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the placeholder has a streamErrorMessage', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              streamErrorMessage: 'Generation failed',
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the placeholder is flagged wasStoppedByUser', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              wasStoppedByUser: true,
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the last assistant message has only attachments (image generation produces no text)', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Draw a cat',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              custom_content: {
                attachments: [
                  { title: 'cat.png', type: 'image/png', url: 'files/cat.png' },
                ],
              },
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the last assistant message has only stages', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Draw a cat',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              custom_content: {
                stages: [
                  {
                    index: 0,
                    name: 'Generating image',
                    status: StageStatus.Completed,
                  },
                ],
              },
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the last assistant message carries a responseId but no text', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Draw a cat',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              responseId: 'resp-1',
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns true when the placeholder carries an empty custom_content', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Draw a cat',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              custom_content: { attachments: [], stages: [] },
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('returns false when last message is from the user', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when there are no messages', () => {
    expect(isAwaitingGenerationResume(makeConversation({ messages: [] }))).toBe(
      false,
    );
  });
});

describe('createResumeIfAwaitingGeneration — options', () => {
  const CONVERSATION_ID = 'bucket/gpt-4o__Hello';
  const PATH = 'gpt-4o__Hello';
  const encoder = new TextEncoder();

  /** An SSE stream the test pushes attach events into. */
  const makeEventStream = () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
      },
    });
    return {
      stream,
      emit: (event: unknown) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        ),
      end: () => controller.close(),
    };
  };

  const makeHarness = (
    transportOverrides: Partial<ConversationStreamTransport> = {},
  ) => {
    const transport: ConversationStreamTransport = {
      streamCompletion: vi.fn(),
      stopCompletion: vi.fn(),
      watchConversation: vi.fn().mockRejectedValue(new Error('no watch')),
      attachToGeneration: vi.fn().mockRejectedValue(new Error('no attach')),
      getConversation: vi.fn().mockResolvedValue(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: 'Final answer',
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      ),
      ...transportOverrides,
    };
    const bufferedGenerationsRef = {
      current: new Map<string, BufferedGeneration>(),
    };
    const resumingPathsRef = { current: new Set<string>() };
    const conversationRef = { current: null as Conversation | null };
    const resume = createResumeIfAwaitingGeneration({
      transport,
      setConversation: vi.fn(),
      conversationRef,
      resumingPathsRef,
      bufferedGenerationsRef,
      addStreamingPath: vi.fn(),
      removeStreamingPath: vi.fn(),
      isPathDisplayed: () => true,
    });
    return { transport, bufferedGenerationsRef, resumingPathsRef, resume };
  };

  const partialMessage = {
    role: MessageRole.Assistant,
    content: 'Partial answer so far',
    timestamp: new Date().toISOString(),
  };

  it('seeds the buffered message with the supplied live partial instead of the stored placeholder', () => {
    const { bufferedGenerationsRef, resume } = makeHarness();

    resume(CONVERSATION_ID, makeConversation(), {
      seedMessage: partialMessage,
    });

    expect(bufferedGenerationsRef.current.get(PATH)?.message).toBe(
      partialMessage,
    );
  });

  it('calls onSettled once after the attach stream reports done and the reload is applied', async () => {
    const events = makeEventStream();
    const { transport, resume } = makeHarness({
      attachToGeneration: vi.fn().mockResolvedValue(events.stream),
    });
    const onSettled = vi.fn();

    resume(CONVERSATION_ID, makeConversation(), { onSettled });
    await vi.waitFor(() =>
      expect(transport.attachToGeneration).toHaveBeenCalled(),
    );
    events.emit({ type: 'snapshot', message: partialMessage });
    expect(onSettled).not.toHaveBeenCalled();
    events.emit({ type: 'done' });

    await vi.waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(transport.getConversation).toHaveBeenCalledOnce();
  });

  it('calls onSettled once after falling back to a final check when neither attach nor watch is available', async () => {
    const { transport, resume } = makeHarness();
    const onSettled = vi.fn();

    resume(CONVERSATION_ID, makeConversation(), { onSettled });

    await vi.waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(transport.getConversation).toHaveBeenCalledOnce();
  });

  it('calls onSettled when a newer generation takes over the path mid-attach', async () => {
    const events = makeEventStream();
    const { bufferedGenerationsRef, resume, transport } = makeHarness({
      attachToGeneration: vi.fn().mockResolvedValue(events.stream),
    });
    const onSettled = vi.fn();

    resume(CONVERSATION_ID, makeConversation(), { onSettled });
    await vi.waitFor(() =>
      expect(transport.attachToGeneration).toHaveBeenCalled(),
    );
    bufferedGenerationsRef.current.set(PATH, {
      generationId: 'newer',
      messageIndex: 1,
      message: partialMessage,
    });
    events.emit({ type: 'chunk', chunk: {} });

    await vi.waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(bufferedGenerationsRef.current.get(PATH)?.generationId).toBe(
      'newer',
    );
  });

  it('calls onSettled immediately when the conversation is not awaiting a generation', () => {
    const { transport, resume } = makeHarness();
    const onSettled = vi.fn();

    resume(
      CONVERSATION_ID,
      makeConversation({
        messages: [
          {
            role: MessageRole.User,
            content: 'Hello',
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      { onSettled },
    );

    expect(onSettled).toHaveBeenCalledOnce();
    expect(transport.attachToGeneration).not.toHaveBeenCalled();
  });

  it('stays a no-op for a path another caller already reserved, unless told to skip the dedupe', async () => {
    const { transport, resumingPathsRef, resume } = makeHarness();
    resumingPathsRef.current.add(PATH);

    resume(CONVERSATION_ID, makeConversation());
    expect(transport.attachToGeneration).not.toHaveBeenCalled();

    resume(CONVERSATION_ID, makeConversation(), { skipDedupe: true });
    await vi.waitFor(() =>
      expect(transport.attachToGeneration).toHaveBeenCalledOnce(),
    );
  });
});
