import type { Conversation } from '@epam/ai-dial-chat-shared';
import {
  BackgroundGenerationStatus,
  MessageRole,
  StageStatus,
} from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BufferedGeneration } from '../buffered-generation';
import {
  createResumeIfAwaitingGeneration,
  fetchConversationForRecovery,
  findPendingBackgroundMessageIndex,
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
    depsOverrides: Partial<
      Parameters<typeof createResumeIfAwaitingGeneration>[0]
    > = {},
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
      ...depsOverrides,
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

  it('queues replayed chunks on the frame scheduler and flushes them when the replay ends', async () => {
    const events = makeEventStream();
    const setConversation = vi.fn();
    const frameScheduler = {
      schedule: vi.fn(),
      flush: vi.fn(),
      cancel: vi.fn(),
      cancelAll: vi.fn(),
    };
    const { transport, bufferedGenerationsRef, resume } = makeHarness(
      { attachToGeneration: vi.fn().mockResolvedValue(events.stream) },
      { setConversation, frameScheduler },
    );
    const onSettled = vi.fn();

    resume(CONVERSATION_ID, makeConversation(), { onSettled });
    await vi.waitFor(() =>
      expect(transport.attachToGeneration).toHaveBeenCalled(),
    );
    const textChunk = (content: string) => ({
      type: 'chunk',
      chunk: {
        id: 'response-1',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, finish_reason: null, delta: { content } }],
      },
    });
    events.emit(textChunk('a'));
    events.emit(textChunk('b'));

    await vi.waitFor(() =>
      expect(frameScheduler.schedule).toHaveBeenCalledTimes(2),
    );
    expect(frameScheduler.schedule).toHaveBeenCalledWith(
      PATH,
      expect.any(Function),
    );
    expect(setConversation).not.toHaveBeenCalled();
    expect(bufferedGenerationsRef.current.get(PATH)?.message.content).toBe(
      'ab',
    );

    events.emit({ type: 'done' });
    await vi.waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(frameScheduler.flush).toHaveBeenCalledWith(PATH);
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

describe('background generation resume', () => {
  const CONVERSATION_ID = 'bucket/gpt-4o__Hello';
  const PATH = 'gpt-4o__Hello';
  const encoder = new TextEncoder();
  const user = {
    role: MessageRole.User,
    content: 'Hello',
    timestamp: new Date().toISOString(),
  };
  const background = (status: BackgroundGenerationStatus) => ({
    role: MessageRole.Assistant,
    content: '',
    timestamp: new Date().toISOString(),
    responseId: 'dial_r1',
    backgroundGeneration: { generationId: 'gen-1', status, startedAt: 1 },
  });
  const statusMessage = {
    role: MessageRole.Status,
    content: '',
    timestamp: new Date().toISOString(),
  };

  it('treats a pending background message with a responseId as awaiting resume', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [user, background(BackgroundGenerationStatus.Pending)],
        }),
      ),
    ).toBe(true);
  });

  it('finds a pending background message even when a status message follows it', () => {
    const conversation = makeConversation({
      messages: [
        user,
        background(BackgroundGenerationStatus.Pending),
        statusMessage,
      ],
    });

    expect(isAwaitingGenerationResume(conversation)).toBe(true);
    expect(findPendingBackgroundMessageIndex(conversation)).toBe(1);
  });

  it.each([
    BackgroundGenerationStatus.Completed,
    BackgroundGenerationStatus.Stopped,
    BackgroundGenerationStatus.Failed,
  ])('does not resume a background message whose status is %s', (status) => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({ messages: [user, background(status)] }),
      ),
    ).toBe(false);
  });

  it('applies replayed chunks at the pending message and leaves the status message after it unchanged', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
      },
    });
    const emit = (event: unknown) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    const conversation = makeConversation({
      messages: [
        user,
        background(BackgroundGenerationStatus.Pending),
        statusMessage,
      ],
    });
    let displayed: Conversation = conversation;
    const setConversation = vi.fn((update: unknown) => {
      displayed =
        typeof update === 'function'
          ? (update as (prev: Conversation) => Conversation)(displayed)
          : (update as Conversation);
    });
    const bufferedGenerationsRef = {
      current: new Map<string, BufferedGeneration>(),
    };
    const resume = createResumeIfAwaitingGeneration({
      transport: {
        streamCompletion: vi.fn(),
        stopCompletion: vi.fn(),
        watchConversation: vi.fn().mockRejectedValue(new Error('no watch')),
        attachToGeneration: vi.fn().mockResolvedValue(stream),
        getConversation: vi.fn().mockReturnValue(new Promise(() => undefined)),
      },
      setConversation: setConversation as never,
      conversationRef: { current: conversation },
      resumingPathsRef: { current: new Set<string>() },
      bufferedGenerationsRef,
      addStreamingPath: vi.fn(),
      removeStreamingPath: vi.fn(),
      isPathDisplayed: () => true,
    });

    resume(CONVERSATION_ID, conversation);
    emit({
      type: 'snapshot',
      message: background(BackgroundGenerationStatus.Pending),
    });
    emit({
      type: 'chunk',
      chunk: { choices: [{ delta: { content: 'Hello' } }] },
    });
    emit({
      type: 'chunk',
      chunk: { choices: [{ delta: { content: ' world' } }] },
    });

    await vi.waitFor(() => {
      expect(displayed.messages[1].content).toBe('Hello world');
    });
    expect(bufferedGenerationsRef.current.get(PATH)?.messageIndex).toBe(1);
    expect(displayed.messages[2]).toEqual(statusMessage);
    expect(displayed.messages).toHaveLength(3);
  });

  it('shows no more replayed text once the user stopped the resumed generation', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
      },
    });
    const emit = (event: unknown) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    const conversation = makeConversation({
      messages: [user, background(BackgroundGenerationStatus.Pending)],
    });
    let displayed: Conversation = conversation;
    const setConversation = vi.fn((update: unknown) => {
      displayed =
        typeof update === 'function'
          ? (update as (prev: Conversation) => Conversation)(displayed)
          : (update as Conversation);
    });
    const stoppedGenerationIdsRef = { current: new Set<string>() };
    const resume = createResumeIfAwaitingGeneration({
      transport: {
        streamCompletion: vi.fn(),
        stopCompletion: vi.fn(),
        watchConversation: vi.fn().mockRejectedValue(new Error('no watch')),
        attachToGeneration: vi.fn().mockResolvedValue(stream),
        getConversation: vi.fn().mockResolvedValue(
          makeConversation({
            messages: [
              user,
              {
                ...background(BackgroundGenerationStatus.Stopped),
                content: 'Hello',
              },
            ],
          }),
        ),
      },
      setConversation: setConversation as never,
      conversationRef: { current: conversation },
      resumingPathsRef: { current: new Set<string>() },
      bufferedGenerationsRef: {
        current: new Map<string, BufferedGeneration>(),
      },
      addStreamingPath: vi.fn(),
      removeStreamingPath: vi.fn(),
      isPathDisplayed: () => true,
      stoppedGenerationIdsRef,
    });

    resume(CONVERSATION_ID, conversation);
    emit({
      type: 'chunk',
      chunk: { choices: [{ delta: { content: 'Hello' } }] },
    });
    await vi.waitFor(() => {
      expect(displayed.messages[1].content).toBe('Hello');
    });
    stoppedGenerationIdsRef.current.add('gen-1');
    emit({
      type: 'chunk',
      chunk: { choices: [{ delta: { content: ' world' } }] },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(displayed.messages[1].content).toBe('Hello');

    emit({ type: 'stopped' });
    await vi.waitFor(() => {
      expect(stoppedGenerationIdsRef.current.has('gen-1')).toBe(false);
    });
    expect(displayed.messages[1].content).toBe('Hello');
  });
});

describe('createResumeIfAwaitingGeneration — watch fallback', () => {
  const CONVERSATION_ID = 'bucket/gpt-4o__Hello';
  const encoder = new TextEncoder();

  const finishedConversation = () =>
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
    });

  /** A watch stream the test pushes resource-update events into; never ends on its own. */
  const makeWatchStream = () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
      },
    });
    return {
      stream,
      emitUpdate: () =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ action: 'UPDATE' })}\n\n`),
        ),
    };
  };

  const makeHarness = (
    getConversation: ConversationStreamTransport['getConversation'],
  ) => {
    const watch = makeWatchStream();
    let watchSignal: AbortSignal | undefined;
    const transport: ConversationStreamTransport = {
      streamCompletion: vi.fn(),
      stopCompletion: vi.fn(),
      attachToGeneration: vi.fn().mockRejectedValue(new Error('no attach')),
      watchConversation: vi.fn((_path: string, signal: AbortSignal) => {
        watchSignal = signal;
        return Promise.resolve(watch.stream);
      }),
      getConversation,
    };
    const setConversation = vi.fn();
    const resume = createResumeIfAwaitingGeneration({
      transport,
      setConversation,
      conversationRef: { current: null },
      resumingPathsRef: { current: new Set<string>() },
      bufferedGenerationsRef: {
        current: new Map<string, BufferedGeneration>(),
      },
      addStreamingPath: vi.fn(),
      removeStreamingPath: vi.fn(),
      isPathDisplayed: () => true,
    });
    return {
      transport,
      setConversation,
      resume,
      watch,
      getWatchSignal: () => watchSignal,
    };
  };

  it('finishes as soon as the watch opens when the generation had already finished', async () => {
    const finished = finishedConversation();
    const { resume, setConversation, getWatchSignal } = makeHarness(
      vi.fn().mockResolvedValue(finished),
    );
    const onSettled = vi.fn();

    resume(CONVERSATION_ID, makeConversation(), { onSettled });

    await vi.waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(setConversation).toHaveBeenCalledWith(finished);
    expect(getWatchSignal()?.aborted).toBe(true);
  });

  it('keeps watching when the generation is still running once the watch opens', async () => {
    const finished = finishedConversation();
    const getConversation = vi
      .fn()
      .mockResolvedValueOnce(makeConversation())
      .mockResolvedValue(finished);
    const { resume, setConversation, watch } = makeHarness(getConversation);
    const onSettled = vi.fn();

    resume(CONVERSATION_ID, makeConversation(), { onSettled });
    await vi.waitFor(() => expect(getConversation).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSettled).not.toHaveBeenCalled();

    watch.emitUpdate();

    await vi.waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(setConversation).toHaveBeenCalledWith(finished);
  });

  it('keeps watching when the check made once the watch opens fails', async () => {
    const finished = finishedConversation();
    const getConversation = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(finished);
    const { resume, setConversation, watch } = makeHarness(getConversation);
    const onSettled = vi.fn();

    resume(CONVERSATION_ID, makeConversation(), { onSettled });
    await vi.waitFor(() => expect(getConversation).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSettled).not.toHaveBeenCalled();

    watch.emitUpdate();

    await vi.waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(setConversation).toHaveBeenCalledWith(finished);
  });
});

describe('fetchConversationForRecovery — pending results', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const userOnly = () =>
    makeConversation({
      messages: [
        {
          role: MessageRole.User,
          content: 'Hello',
          timestamp: new Date().toISOString(),
        },
      ],
    });
  const isUserLast = (conversation: Conversation) =>
    conversation.messages.at(-1)?.role === MessageRole.User;

  it('retries a pending result on the backoff schedule and returns the first settled one', async () => {
    vi.useFakeTimers();
    const settled = makeConversation();
    const load = vi
      .fn()
      .mockResolvedValueOnce(userOnly())
      .mockResolvedValueOnce(userOnly())
      .mockResolvedValue(settled);

    const result = fetchConversationForRecovery(load, () => false, isUserLast);
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toBe(settled);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('returns null when the result is still pending after the last attempt', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue(userOnly());

    const result = fetchConversationForRecovery(load, () => false, isUserLast);
    await vi.advanceTimersByTimeAsync(31_000);

    await expect(result).resolves.toBeNull();
    expect(load).toHaveBeenCalledTimes(6);
  });

  it('returns the first result unchanged when no predicate is given', async () => {
    const first = userOnly();
    const load = vi.fn().mockResolvedValue(first);

    await expect(fetchConversationForRecovery(load, () => false)).resolves.toBe(
      first,
    );
    expect(load).toHaveBeenCalledOnce();
  });
});
