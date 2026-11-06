import { type Conversation } from '@epam/ai-dial-chat-shared';
import { useRef, useState } from 'react';
import { vi } from 'vitest';
import type {
  ConversationStreamChannel,
  ConversationStreamOverlayNotifier,
  ConversationStreamTransport,
  StreamCompletionOptions,
} from '../useConversationStream';
import { useConversationStream } from '../useConversationStream';

/*
 * Shared fixtures of the `useConversationStream` specs: a conversation
 * factory, a harness that renders the hook against component state, the
 * transport mock every spec starts from, and an SSE event stream for attach
 * and watch responses.
 */

export const makeConversation = (
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

/** Captures the `options` passed to the most recent `streamCompletion` call. */
export const useHookHarness = ({
  transport,
  conversationId,
  initialConversation,
  generationOverride,
  ...rest
}: {
  transport: ConversationStreamTransport;
  conversationId: string | undefined;
  onStopError?: (error: Error) => void;
  overlay?: ConversationStreamOverlayNotifier;
  channel?: ConversationStreamChannel;
  initialConversation?: Conversation;
  generationConflictMessage?: string;
  generationPersistenceErrorMessage?: string;
  generationInterruptedMessage?: string;
  onStreamError?: (error: Error) => void;
  batchChunksPerFrame?: boolean;
  /** Overrides the `AbortController` `startGeneration` returns, so a test can abort it directly to simulate a host-driven stop. */
  generationOverride?: () => AbortController;
}) => {
  const [conversation, setConversation] = useState<Conversation | null>(
    initialConversation ?? makeConversation(),
  );
  const conversationRef = useRef<Conversation | null>(conversation);
  conversationRef.current = conversation;

  const generation = {
    startGeneration: vi.fn(generationOverride ?? (() => new AbortController())),
    completeGeneration: vi.fn(),
  };

  const stream = useConversationStream({
    conversationId,
    state: { setConversation, conversationRef },
    transport,
    generation,
    ...rest,
  });

  return { conversation, setConversation, stream, generation };
};

/** The default transport: `streamCompletion` hands its options to `capture`, everything else is a benign mock. */
export const createStreamTestTransport = (
  capture: (options: StreamCompletionOptions) => void,
): ConversationStreamTransport => ({
  streamCompletion: vi.fn((_path, _message, _model, options) => {
    capture(options);
  }),
  stopCompletion: vi.fn().mockResolvedValue(undefined),
  watchConversation: vi.fn(),
  attachToGeneration: vi.fn().mockRejectedValue(new Error('not mocked')),
  getConversation: vi.fn().mockResolvedValue(makeConversation()),
});

const encoder = new TextEncoder();

/** An SSE stream whose `data:` events are pushed with `emit` and closed with `end`. */
export const makeAttachStream = () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });
  return {
    stream,
    emit: (event: unknown) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
    end: () => controller.close(),
  };
};
