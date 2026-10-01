import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  ConversationGenerationService,
  GenerationCancelReason,
} from '../conversation-generation.service';
import { BackgroundGenerationStatus } from '../dto/background-generation.dto';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';
import { CompletionMode } from '../dto/send-completion.dto';
import {
  runConditionalUpdate,
  type ConversationPersistenceService,
} from '../persistence/conversation-persistence.service';
import {
  BackgroundGenerationService,
  BackgroundStartResult,
  BackgroundStopResult,
  extractOutputText,
  toTerminalFields,
} from './background-generation.service';
import {
  CoreResponseResultKind,
  type CoreResponsesClient,
} from './core-responses.client';
import {
  BackgroundGenerationOutcome,
  backgroundGenerationOutcomesTotal,
} from './generation-metrics';
import {
  RESPONSES_FAILED_MESSAGE,
  RESPONSES_INCOMPLETE_MESSAGE,
  ResponsesAdapter,
} from './responses.adapter';

const GEN = 'gen-1';
const RESPONSE_ID = 'dial_gpt_r1';

/** In-memory conversation store with DIAL-Core-like ETag semantics. */
const makeStore = (initialMessages: ConversationMessageDto[] = []) => {
  let version = 1;
  let conversation: Record<string, unknown> | null = {
    id: 'bucket/conv',
    name: 'conv',
    prompt: '',
    messages: initialMessages,
  };
  const failures = { save: 0, conflicts: 0, failingCalls: new Set<number>() };
  let saveCalls = 0;
  const persistence = {
    readConversationWithEtag: vi.fn(async () =>
      conversation
        ? {
            conversation: structuredClone(conversation),
            etag: `"v${version}"`,
          }
        : null,
    ),
    saveConversationIfMatch: vi.fn(
      async (_p: string, _t: string, _b: string, body: never, etag: string) => {
        saveCalls++;
        if (failures.failingCalls.has(saveCalls))
          throw new Error('storage down');
        if (failures.save > 0) {
          failures.save--;
          throw new Error('storage down');
        }
        if (failures.conflicts > 0) {
          failures.conflicts--;
          version++;
          return { isSaved: false };
        }
        if (etag !== `"v${version}"`) return { isSaved: false };
        conversation = structuredClone(body);
        version++;
        return { isSaved: true, conversation: body };
      },
    ),
    saveConversation: vi.fn(
      async (_p: string, _t: string, _b: string, body: never) => {
        conversation = structuredClone(body);
        version++;
        return body;
      },
    ),
    updateConversation: vi.fn(
      (
        ...args: Parameters<
          ConversationPersistenceService['updateConversation']
        >
      ) => runConditionalUpdate(persistence as never, ...args),
    ),
  };
  return {
    persistence: persistence as unknown as ConversationPersistenceService,
    mocks: persistence,
    failures,
    get messages(): ConversationMessageDto[] {
      return (conversation?.messages ?? []) as ConversationMessageDto[];
    },
    setMessages(messages: ConversationMessageDto[]) {
      conversation = { ...conversation, messages };
      version++;
    },
    setConversation(fields: Record<string, unknown>) {
      conversation = { ...conversation, ...fields };
      version++;
    },
    get conversation(): Record<string, unknown> | null {
      return conversation;
    },
    delete() {
      conversation = null;
    },
  };
};

const sse = (events: unknown[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
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

const created = {
  type: 'response.created',
  response: { id: RESPONSE_ID, status: 'queued' },
};
const delta = (text: string) => ({
  type: 'response.output_text.delta',
  delta: text,
});
const completed = {
  type: 'response.completed',
  response: { id: RESPONSE_ID, status: 'completed' },
};

const makeCore = (
  overrides: Partial<Record<keyof CoreResponsesClient, unknown>> = {},
) =>
  ({
    retrieveResponse: vi.fn(async () => ({
      kind: CoreResponseResultKind.Ok,
      response: {
        id: RESPONSE_ID,
        status: 'completed',
        output: [{ content: [{ type: 'output_text', text: 'Hello world' }] }],
      },
    })),
    cancelResponse: vi.fn(async () => ({
      kind: CoreResponseResultKind.Ok,
      response: { id: RESPONSE_ID, status: 'cancelled' },
    })),
    deleteResponse: vi.fn(async () => CoreResponseResultKind.Ok),
    replayResponse: vi.fn(),
    ...overrides,
  }) as unknown as CoreResponsesClient &
    Record<string, ReturnType<typeof vi.fn>>;

const makeService = (options: {
  store: ReturnType<typeof makeStore>;
  events?: unknown[];
  core?: ReturnType<typeof makeCore>;
  cancelReason?: GenerationCancelReason;
}) => {
  const dialClient = {
    client: {
      createResponse: vi.fn(async () => ({
        response: new Response(
          sse(
            options.events ?? [
              created,
              delta('Hello'),
              delta(' world'),
              completed,
            ],
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          },
        ),
      })),
    },
  } as unknown as DialClientService;
  const generationService = {
    complete: vi.fn(),
    beginFinalizing: vi.fn(),
    applyChunk: vi.fn(),
    getCancellation: vi.fn(() =>
      options.cancelReason
        ? { requested: true, reason: options.cancelReason }
        : { requested: false },
    ),
  } as unknown as ConversationGenerationService;
  const core = options.core ?? makeCore();
  const service = new BackgroundGenerationService(
    options.store.persistence,
    new ResponsesAdapter(dialClient),
    core,
    generationService,
  );
  return { service, dialClient, generationService, core };
};

const params = (overrides: Record<string, unknown> = {}) => ({
  lease: { abortController: new AbortController(), operationId: 1 },
  conversationPath: 'conv',
  token: 'tok',
  bucket: 'bucket',
  generationId: GEN,
  mode: CompletionMode.Append,
  message: 'Hi',
  messageIndex: undefined,
  model: 'gpt-4.1-nano',
  customContent: undefined,
  temperatureSupported: false,
  onReadyToStream: vi.fn(),
  ...overrides,
});

const drain = async (
  generator: AsyncGenerator<string, BackgroundStartResult, void>,
) => {
  const chunks: string[] = [];
  let next = await generator.next();
  while (!next.done) {
    chunks.push(next.value);
    next = await generator.next();
  }
  return { chunks, result: next.value };
};

const pendingMessage = (generationId = GEN): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: 't',
  responseId: 'dial_other',
  backgroundGeneration: {
    generationId,
    status: BackgroundGenerationStatus.Pending,
    startedAt: 1,
  },
});

describe('BackgroundGenerationService.startAndRelay', () => {
  it('stores a pending placeholder before creating the job and sends a background request', async () => {
    const store = makeStore();
    const { service, dialClient } = makeService({ store });
    let placeholderAtCreate: ConversationMessageDto | undefined;
    vi.mocked(dialClient.client.createResponse).mockImplementationOnce(
      async (init) => {
        placeholderAtCreate = store.messages.at(-1);
        expect(
          (init as unknown as { body: Record<string, unknown> }).body,
        ).toMatchObject({
          store: true,
          background: true,
          stream: true,
        });
        return {
          response: new Response(sse([created, delta('Hello'), completed]), {
            status: 200,
          }),
        } as never;
      },
    );

    await drain(service.startAndRelay(params() as never));

    expect(placeholderAtCreate?.backgroundGeneration).toMatchObject({
      generationId: GEN,
      status: BackgroundGenerationStatus.Pending,
    });
    expect(placeholderAtCreate?.responseId).toBeUndefined();
  });

  it('saves responseId before relaying the first delta', async () => {
    const store = makeStore();
    const { service } = makeService({ store });
    const generator = service.startAndRelay(params() as never);

    let next = await generator.next();
    while (!next.done && !String(next.value).includes('"content":"Hello"')) {
      next = await generator.next();
    }

    expect(store.messages.at(-1)?.responseId).toBe(RESPONSE_ID);
    expect(store.messages.at(-1)?.backgroundGeneration?.status).toBe(
      BackgroundGenerationStatus.Pending,
    );
    await drain(generator);
  });

  it('finalizes from the retrieved Core response, keeps later messages, and deletes the job', async () => {
    const store = makeStore();
    const { service, core, generationService } = makeService({ store });

    const { result } = await drain(service.startAndRelay(params() as never));

    const answer = store.messages.at(-1);
    expect(result).toBe(BackgroundStartResult.Handled);
    expect(answer).toMatchObject({
      content: 'Hello world',
      responseId: RESPONSE_ID,
      backgroundGeneration: { status: BackgroundGenerationStatus.Completed },
    });
    expect(core.retrieveResponse).toHaveBeenCalledWith(RESPONSE_ID, 'tok');
    expect(core.deleteResponse).toHaveBeenCalledWith(RESPONSE_ID, 'tok');
    expect(generationService.applyChunk).not.toHaveBeenCalled();
    expect(generationService.complete).toHaveBeenCalledOnce();
  });

  it('writes a cancelled job as stopped by the user', async () => {
    const store = makeStore();
    const core = makeCore({
      retrieveResponse: vi.fn(async () => ({
        kind: CoreResponseResultKind.Ok,
        response: { id: RESPONSE_ID, status: 'cancelled', output: [] },
      })),
    });
    const { service } = makeService({
      store,
      core,
      events: [created, delta('Hel'), { type: 'response.incomplete' }],
    });

    await drain(service.startAndRelay(params() as never));

    expect(store.messages.at(-1)).toMatchObject({
      wasStoppedByUser: true,
      backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
    });
    expect(store.messages.at(-1)).not.toHaveProperty('streamErrorMessage');
  });

  it('writes a failed job with the Core error text', async () => {
    const store = makeStore();
    const core = makeCore({
      retrieveResponse: vi.fn(async () => ({
        kind: CoreResponseResultKind.Ok,
        response: {
          id: RESPONSE_ID,
          status: 'failed',
          output: [],
          error: { message: 'quota exceeded' },
        },
      })),
    });
    const { service } = makeService({
      store,
      core,
      events: [created, { type: 'response.failed', response: {} }],
    });

    await drain(service.startAndRelay(params() as never));

    expect(store.messages.at(-1)).toMatchObject({
      streamErrorMessage: 'quota exceeded',
      backgroundGeneration: { status: BackgroundGenerationStatus.Failed },
    });
  });

  it('leaves the message pending, sends no error envelope, and deletes nothing when the final write keeps failing', async () => {
    const store = makeStore();
    const { service, core } = makeService({ store });
    const generator = service.startAndRelay(params() as never);
    const chunks: string[] = [];
    let next = await generator.next();
    while (!next.done) {
      chunks.push(next.value);
      if (String(next.value).includes('[DONE]')) store.failures.conflicts = 10;
      next = await generator.next();
    }

    expect(store.messages.at(-1)?.backgroundGeneration?.status).toBe(
      BackgroundGenerationStatus.Pending,
    );
    expect(chunks.join('')).not.toContain('conversation_save_failed');
    expect(core.deleteResponse).not.toHaveBeenCalled();
  });

  it('makes no write and no delete when the message was already stopped elsewhere', async () => {
    const store = makeStore();
    const { service, core } = makeService({ store });
    const generator = service.startAndRelay(params() as never);
    let next = await generator.next();
    while (!next.done) {
      if (String(next.value).includes('[DONE]')) {
        const messages = store.messages;
        const last = messages.at(-1) as ConversationMessageDto;
        store.setMessages([
          ...messages.slice(0, -1),
          {
            ...last,
            content: 'partial',
            backgroundGeneration: {
              ...last.backgroundGeneration!,
              status: BackgroundGenerationStatus.Stopped,
            },
          },
        ]);
      }
      next = await generator.next();
    }

    expect(store.messages.at(-1)).toMatchObject({
      content: 'partial',
      backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
    });
    expect(core.deleteResponse).not.toHaveBeenCalled();
  });

  it('cancels the job and stops relaying when the message was stopped before the responseId save', async () => {
    const store = makeStore();
    const { service, core, dialClient } = makeService({ store });
    vi.mocked(dialClient.client.createResponse).mockImplementationOnce(
      async () => {
        const messages = store.messages;
        const last = messages.at(-1) as ConversationMessageDto;
        store.setMessages([
          ...messages.slice(0, -1),
          {
            ...last,
            backgroundGeneration: {
              ...last.backgroundGeneration!,
              status: BackgroundGenerationStatus.Stopped,
            },
          },
        ]);
        return {
          response: new Response(sse([created, delta('late'), completed]), {
            status: 200,
          }),
        } as never;
      },
    );

    const { chunks } = await drain(service.startAndRelay(params() as never));

    expect(chunks.join('')).not.toContain('late');
    expect(core.cancelResponse).toHaveBeenCalledWith(RESPONSE_ID, 'tok');
    expect(core.retrieveResponse).not.toHaveBeenCalled();
  });

  it('retries a transient responseId save failure and still finalizes', async () => {
    const store = makeStore();
    /* Save call 1 is the placeholder; calls 2 and 3 are the first responseId attempts. */
    store.failures.failingCalls = new Set([2, 3]);
    const { service } = makeService({ store });

    const { chunks } = await drain(service.startAndRelay(params() as never));

    expect(chunks.join('')).toContain('Hello');
    expect(store.messages.at(-1)).toMatchObject({
      responseId: RESPONSE_ID,
      backgroundGeneration: { status: BackgroundGenerationStatus.Completed },
    });
  });

  it('keeps the responseId in the final answer when storing it never succeeded', async () => {
    const store = makeStore();
    /* Save call 1 is the placeholder; calls 2–4 are every responseId attempt. */
    store.failures.failingCalls = new Set([2, 3, 4]);
    const { service, core } = makeService({ store });

    await drain(service.startAndRelay(params() as never));

    expect(store.messages.at(-1)).toMatchObject({
      responseId: RESPONSE_ID,
      backgroundGeneration: { status: BackgroundGenerationStatus.Completed },
    });
    await vi.waitFor(() =>
      expect(core.deleteResponse).toHaveBeenCalledWith(RESPONSE_ID, 'tok'),
    );
  });

  it.each([
    [GenerationCancelReason.MaxDuration],
    [GenerationCancelReason.Shutdown],
  ])(
    'detaches without a write or a cancel when the relay is aborted for %s',
    async (reason) => {
      const store = makeStore();
      const lease = { abortController: new AbortController(), operationId: 1 };
      const { service, core } = makeService({ store, cancelReason: reason });
      const generator = service.startAndRelay(params({ lease }) as never);
      await generator.next();
      lease.abortController.abort();
      await drain(generator);

      expect(store.messages.at(-1)?.backgroundGeneration?.status).toBe(
        BackgroundGenerationStatus.Pending,
      );
      expect(core.cancelResponse).not.toHaveBeenCalled();
      expect(core.retrieveResponse).not.toHaveBeenCalled();
    },
  );

  it('saves a generation stopped through the registry as stopped and cancels its job', async () => {
    const store = makeStore();
    const lease = { abortController: new AbortController(), operationId: 1 };
    const { service, core } = makeService({
      store,
      cancelReason: GenerationCancelReason.UserStop,
    });
    const generator = service.startAndRelay(params({ lease }) as never);
    await generator.next();
    lease.abortController.abort();
    const { result } = await drain(generator);

    expect(result).toBe(BackgroundStartResult.Handled);
    expect(store.messages.at(-1)).toMatchObject({
      wasStoppedByUser: true,
      backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
    });
    expect(core.cancelResponse).toHaveBeenCalledWith(RESPONSE_ID, 'tok');
  });

  it('writes the placeholder on the version read at request start without reading again', async () => {
    const store = makeStore();
    const { service } = makeService({ store });
    const storedConversation = await store.persistence.readConversationWithEtag(
      'conv',
      'tok',
      'bucket',
    );
    store.mocks.readConversationWithEtag.mockClear();

    await drain(service.startAndRelay(params({ storedConversation }) as never));

    expect(store.mocks.saveConversationIfMatch.mock.calls[0][4]).toBe('"v1"');
    expect(
      store.mocks.readConversationWithEtag.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      store.mocks.saveConversationIfMatch.mock.invocationCallOrder[0],
    );
  });

  it('rejects a start while the conversation already has a pending background message', async () => {
    const store = makeStore([pendingMessage('gen-0')]);
    const { service, dialClient } = makeService({ store });

    await expect(
      drain(service.startAndRelay(params() as never)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dialClient.client.createResponse).not.toHaveBeenCalled();
  });

  it('retries the placeholder after an unrelated concurrent change instead of rejecting', async () => {
    const store = makeStore();
    store.failures.conflicts = 1;
    const { service, dialClient } = makeService({ store });

    await drain(service.startAndRelay(params() as never));

    expect(dialClient.client.createResponse).toHaveBeenCalledOnce();
    expect(
      store.mocks.saveConversationIfMatch.mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('falls back to the stateless path when the placeholder hits a storage error', async () => {
    const store = makeStore();
    store.failures.save = 1;
    const { service, dialClient } = makeService({ store });

    const { result } = await drain(service.startAndRelay(params() as never));

    expect(result).toBe(BackgroundStartResult.Fallback);
    expect(dialClient.client.createResponse).not.toHaveBeenCalled();
  });

  it.each([
    [CoreResponseResultKind.NotFound, false],
    [CoreResponseResultKind.Active, true],
  ])(
    'treats a delete answer %s as delete_failed=%s without changing the message',
    async (kind) => {
      const store = makeStore();
      const core = makeCore({ deleteResponse: vi.fn(async () => kind) });
      const { service } = makeService({ store, core });

      await drain(service.startAndRelay(params() as never));

      expect(store.messages.at(-1)?.backgroundGeneration?.status).toBe(
        BackgroundGenerationStatus.Completed,
      );
    },
  );
});

describe('BackgroundGenerationService.stop', () => {
  const context = { conversationPath: 'conv', token: 'tok', bucket: 'bucket' };
  const running = (): ConversationMessageDto => ({
    ...pendingMessage(),
    responseId: RESPONSE_ID,
  });

  it('saves the text the client has shown as stopped, then cancels the job', async () => {
    const store = makeStore([running()]);
    const order: string[] = [];
    const core = makeCore({
      cancelResponse: vi.fn(async () => {
        order.push(`cancel:${store.messages[0].backgroundGeneration?.status}`);
        return {
          kind: CoreResponseResultKind.Ok,
          response: { id: RESPONSE_ID, status: 'cancelled' },
        };
      }),
    });
    const { service } = makeService({ store, core });

    const result = await service.stop(context, GEN, 'Hello wor');

    expect(result).toBe(BackgroundStopResult.Handled);
    expect(store.messages[0]).toMatchObject({
      content: 'Hello wor',
      wasStoppedByUser: true,
      responseId: RESPONSE_ID,
      backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
    });
    await vi.waitFor(() =>
      expect(order).toEqual([`cancel:${BackgroundGenerationStatus.Stopped}`]),
    );
    expect(core.replayResponse).not.toHaveBeenCalled();
  });

  it('responds without waiting for the Core cancel', async () => {
    const store = makeStore([running()]);
    const core = makeCore({
      cancelResponse: vi.fn(() => new Promise(() => undefined)),
    });
    const { service } = makeService({ store, core });

    expect(await service.stop(context, GEN, 'Hi')).toBe(
      BackgroundStopResult.Handled,
    );
    expect(core.cancelResponse).toHaveBeenCalled();
  });

  it('keeps the stored text when the client sends none', async () => {
    const store = makeStore([{ ...running(), content: 'stored' }]);
    const { service } = makeService({ store });

    await service.stop(context, GEN);

    expect(store.messages[0]).toMatchObject({
      content: 'stored',
      backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
    });
  });

  it('deletes the Core response only after the cancel reports the job finished', async () => {
    const store = makeStore([running()]);
    const order: string[] = [];
    const core = makeCore({
      cancelResponse: vi.fn(async () => {
        order.push('cancel');
        return {
          kind: CoreResponseResultKind.Ok,
          response: { id: RESPONSE_ID, status: 'cancelled' },
        };
      }),
      deleteResponse: vi.fn(async () => {
        order.push('delete');
        return CoreResponseResultKind.Ok;
      }),
    });
    const { service } = makeService({ store, core });

    await service.stop(context, GEN, 'Hi');
    await vi.waitFor(() => expect(order).toEqual(['cancel', 'delete']));
  });

  it('leaves a job that keeps running after the cancel to Core expiry', async () => {
    const store = makeStore([running()]);
    const core = makeCore({
      cancelResponse: vi.fn(async () => ({
        kind: CoreResponseResultKind.Ok,
        response: { id: RESPONSE_ID, status: 'in_progress' },
      })),
    });
    const { service } = makeService({ store, core });

    await service.stop(context, GEN, 'Hi');
    await vi.waitFor(() => expect(core.cancelResponse).toHaveBeenCalled());

    expect(core.deleteResponse).not.toHaveBeenCalled();
  });

  it('fails the Stop and leaves the job running when the stopped state cannot be saved', async () => {
    const store = makeStore([running()]);
    store.failures.save = 3;
    const core = makeCore();
    const { service } = makeService({ store, core });

    await expect(service.stop(context, GEN, 'Hi')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(core.cancelResponse).not.toHaveBeenCalled();
  });

  it('uses the registry path when the conversation cannot be read', async () => {
    const store = makeStore([running()]);
    store.mocks.readConversationWithEtag.mockRejectedValueOnce(
      new Error('storage down'),
    );
    const { service } = makeService({ store });

    expect(await service.stop(context, GEN)).toBe(
      BackgroundStopResult.NotBackground,
    );
  });

  it('keeps the message stopped when Core refuses the cancel', async () => {
    const store = makeStore([running()]);
    const core = makeCore({
      cancelResponse: vi.fn(async () => ({
        kind: CoreResponseResultKind.Error,
      })),
    });
    const { service } = makeService({ store, core });

    expect(await service.stop(context, GEN, 'partial')).toBe(
      BackgroundStopResult.Handled,
    );
    expect(store.messages[0]).toMatchObject({
      content: 'partial',
      backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
    });
  });

  it('stops a message that has no responseId yet without calling Core', async () => {
    const store = makeStore([{ ...pendingMessage(), responseId: undefined }]);
    const core = makeCore();
    const { service } = makeService({ store, core });

    expect(await service.stop(context, GEN)).toBe(
      BackgroundStopResult.StoppedBeforeJob,
    );
    expect(store.messages[0]).toMatchObject({
      content: '',
      wasStoppedByUser: true,
      backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
    });
    expect(core.cancelResponse).not.toHaveBeenCalled();
  });

  it('does nothing for a message that already finished', async () => {
    const finished = {
      ...running(),
      backgroundGeneration: {
        generationId: GEN,
        status: BackgroundGenerationStatus.Completed,
        startedAt: 1,
      },
    };
    const store = makeStore([finished]);
    const core = makeCore();
    const { service } = makeService({ store, core });

    expect(await service.stop(context, GEN, 'Hi')).toBe(
      BackgroundStopResult.AlreadyFinished,
    );
    expect(store.mocks.saveConversationIfMatch).not.toHaveBeenCalled();
    expect(core.cancelResponse).not.toHaveBeenCalled();
  });

  it('cancels the job whose id the relay saved between the first read and the write', async () => {
    const store = makeStore([running()]);
    store.mocks.readConversationWithEtag.mockResolvedValueOnce({
      conversation: {
        id: 'bucket/conv',
        messages: [{ ...pendingMessage(), responseId: undefined }],
      },
      etag: '"v0"',
    } as never);
    const core = makeCore();
    const { service } = makeService({ store, core });

    expect(await service.stop(context, GEN, 'Hi')).toBe(
      BackgroundStopResult.Handled,
    );
    await vi.waitFor(() =>
      expect(core.cancelResponse).toHaveBeenCalledWith(RESPONSE_ID, 'tok'),
    );
  });

  it('never lets a failing cancel escape the Stop', async () => {
    const store = makeStore([running()]);
    const core = makeCore({
      cancelResponse: vi.fn(async () => ({
        kind: CoreResponseResultKind.Ok,
        response: undefined,
      })),
    });
    const { service } = makeService({ store, core });

    expect(await service.stop(context, GEN, 'Hi')).toBe(
      BackgroundStopResult.Handled,
    );
    await vi.waitFor(() => expect(core.cancelResponse).toHaveBeenCalled());
    expect(core.deleteResponse).not.toHaveBeenCalled();
  });

  it('reports a generation id that no background message carries', async () => {
    const store = makeStore([running()]);
    const { service } = makeService({ store });

    expect(await service.stop(context, 'unknown-gen')).toBe(
      BackgroundStopResult.NotBackground,
    );
  });
});

describe('BackgroundGenerationService.saveClientConversation', () => {
  const context = { conversationPath: 'conv', token: 'tok', bucket: 'bucket' };
  const olderAnswer: ConversationMessageDto = {
    role: ConversationMessageRole.Assistant,
    content: 'older',
    timestamp: 't0',
  };
  const runningStored = (): ConversationMessageDto => ({
    ...pendingMessage(),
    responseId: RESPONSE_ID,
  });

  it('saves a rating on an older message and keeps the stored pending message', async () => {
    const store = makeStore([olderAnswer, runningStored()]);
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [
        { ...olderAnswer, rating: 1 },
        {
          role: ConversationMessageRole.Assistant,
          content: 'Hel',
          timestamp: 't1',
        },
      ],
    } as never);

    expect(store.messages[0]).toMatchObject({ rating: 1 });
    expect(store.messages).toHaveLength(2);
    expect(store.messages[1]).toMatchObject({
      content: '',
      responseId: RESPONSE_ID,
      backgroundGeneration: { status: BackgroundGenerationStatus.Pending },
    });
  });

  it('keeps a rating on the pending message itself but never its answer fields', async () => {
    const store = makeStore([runningStored()]);
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [
        {
          ...runningStored(),
          content: 'client text',
          rating: -1,
          backgroundGeneration: undefined,
        },
      ],
    } as never);

    expect(store.messages[0]).toMatchObject({
      content: '',
      rating: -1,
      backgroundGeneration: { status: BackgroundGenerationStatus.Pending },
    });
  });

  it('re-inserts the pending message when the body dropped it', async () => {
    const store = makeStore([olderAnswer, runningStored()]);
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      prompt: 'new prompt',
      messages: [olderAnswer],
    } as never);

    expect(store.messages).toHaveLength(2);
    expect(store.messages[1].backgroundGeneration?.generationId).toBe(GEN);
  });

  it('saves a body without a pending message conditionally and strips client-sent markers', async () => {
    const store = makeStore([olderAnswer]);
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [olderAnswer, pendingMessage('forged')],
    } as never);

    expect(store.mocks.saveConversationIfMatch).toHaveBeenCalledWith(
      'conv',
      'tok',
      'bucket',
      expect.anything(),
      '"v1"',
    );
    expect(store.messages[1].backgroundGeneration?.status).toBe(
      BackgroundGenerationStatus.Failed,
    );
  });

  it('never overwrites a placeholder saved between the read and the write', async () => {
    const store = makeStore([olderAnswer]);
    const { service } = makeService({ store });
    store.mocks.saveConversationIfMatch.mockImplementationOnce(async () => {
      store.setMessages([olderAnswer, runningStored()]);
      return { isSaved: false };
    });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [{ ...olderAnswer, rating: 1 }],
    } as never);

    expect(store.messages).toHaveLength(2);
    expect(store.messages[1].backgroundGeneration?.status).toBe(
      BackgroundGenerationStatus.Pending,
    );
  });

  it('puts back the question and the pending answer that a stale tab does not have', async () => {
    const question: ConversationMessageDto = {
      role: ConversationMessageRole.User,
      content: 'second question',
      timestamp: 't1',
    };
    const store = makeStore([
      { role: ConversationMessageRole.User, content: 'q1', timestamp: 't' },
      olderAnswer,
      question,
      runningStored(),
    ]);
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [
        { role: ConversationMessageRole.User, content: 'q1', timestamp: 't' },
        { ...olderAnswer, rating: 1 },
      ],
    } as never);

    expect(store.messages.map((message) => message.content)).toEqual([
      'q1',
      'older',
      'second question',
      '',
    ]);
    expect(store.messages[1]).toMatchObject({ rating: 1 });
    expect(store.messages[3].backgroundGeneration?.generationId).toBe(GEN);
  });

  it('keeps the title LLM naming already stored', async () => {
    const store = makeStore([olderAnswer]);
    store.setConversation({ name: 'LLM title', llmNamingDone: true });
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      name: 'stale name',
      messages: [olderAnswer],
    } as never);

    expect(store.conversation).toMatchObject({
      name: 'LLM title',
      llmNamingDone: true,
    });
  });

  it('replaces an old answer a tab still shows where a regenerate is now pending', async () => {
    const store = makeStore([
      { role: ConversationMessageRole.User, content: 'q1', timestamp: 't' },
      runningStored(),
    ]);
    const { service } = makeService({ store });
    const oldAnswer = {
      ...olderAnswer,
      content: 'old answer',
      backgroundGeneration: {
        generationId: 'gen-0',
        status: BackgroundGenerationStatus.Completed,
        startedAt: 1,
      },
    };

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [
        { role: ConversationMessageRole.User, content: 'q1', timestamp: 't' },
        { ...oldAnswer, rating: 1 },
      ],
    } as never);

    expect(store.messages).toHaveLength(2);
    expect(store.messages[1]).toMatchObject({
      content: '',
      backgroundGeneration: { generationId: GEN },
    });
    expect((store.messages[1] as { rating?: number }).rating).toBeUndefined();
  });

  it('keeps a finished answer when a tab without the marker saves its copy', async () => {
    const stopped = {
      ...runningStored(),
      content: 'stopped text',
      wasStoppedByUser: true,
      backgroundGeneration: {
        generationId: GEN,
        status: BackgroundGenerationStatus.Stopped,
        startedAt: 1,
      },
    };
    const question = {
      role: ConversationMessageRole.User,
      content: 'q',
      timestamp: 't',
    };
    const store = makeStore([question, stopped]);
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [
        question,
        {
          role: ConversationMessageRole.Assistant,
          content: 'still streaming tex',
          timestamp: 't1',
          rating: 1,
        },
      ],
    } as never);

    expect(store.messages[1]).toMatchObject({
      content: 'stopped text',
      rating: 1,
      backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
    });
  });

  it('never moves a finished answer onto another answer after earlier messages were deleted', async () => {
    const finished = {
      ...runningStored(),
      content: 'background answer',
      backgroundGeneration: {
        generationId: GEN,
        status: BackgroundGenerationStatus.Completed,
        startedAt: 1,
      },
    };
    const later = {
      role: ConversationMessageRole.User,
      content: 'u2',
      timestamp: 't2',
    };
    const otherAnswer = {
      role: ConversationMessageRole.Assistant,
      content: 'other model answer',
      timestamp: 't3',
    };
    const store = makeStore([
      { role: ConversationMessageRole.User, content: 'u0', timestamp: 't0' },
      finished,
      later,
      otherAnswer,
    ]);
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [later, otherAnswer],
    } as never);

    expect(store.messages).toEqual([later, otherAnswer]);
  });

  it('never turns a finished answer back into a failed one from a stale pending copy', async () => {
    const finished = {
      ...runningStored(),
      content: 'Hello world',
      backgroundGeneration: {
        generationId: GEN,
        status: BackgroundGenerationStatus.Completed,
        startedAt: 1,
      },
    };
    const store = makeStore([finished]);
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [{ ...runningStored(), content: 'Hel', rating: 1 }],
    } as never);

    expect(store.messages[0]).toMatchObject({
      content: 'Hello world',
      rating: 1,
      backgroundGeneration: { status: BackgroundGenerationStatus.Completed },
    });
  });

  it('resolves null when the conversation cannot be read, so the caller keeps the old save', async () => {
    const store = makeStore([olderAnswer]);
    store.mocks.readConversationWithEtag.mockRejectedValueOnce(
      new Error('storage down'),
    );
    const { service } = makeService({ store });

    expect(
      await service.saveClientConversation(context, { messages: [] } as never),
    ).toBeNull();
    expect(store.mocks.saveConversationIfMatch).not.toHaveBeenCalled();
  });

  it('creates a conversation that does not exist yet with the unconditional save', async () => {
    const store = makeStore();
    store.delete();
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [olderAnswer, pendingMessage('forged')],
    } as never);

    expect(store.mocks.saveConversation).toHaveBeenCalled();
    expect(store.mocks.saveConversationIfMatch).not.toHaveBeenCalled();
    expect(store.messages[1].backgroundGeneration?.status).toBe(
      BackgroundGenerationStatus.Failed,
    );
  });

  it('re-reads and merges again after a concurrent change', async () => {
    const store = makeStore([olderAnswer, runningStored()]);
    store.failures.conflicts = 1;
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [{ ...olderAnswer, rating: 1 }, runningStored()],
    } as never);

    expect(store.messages[0]).toMatchObject({ rating: 1 });
    expect(store.mocks.saveConversationIfMatch).toHaveBeenCalledTimes(2);
  });

  it('falls back to the unconditional save when conflicts persist and nothing is pending', async () => {
    const store = makeStore([olderAnswer]);
    store.failures.conflicts = 3;
    const { service } = makeService({ store });

    await service.saveClientConversation(context, {
      id: 'bucket/conv',
      messages: [{ ...olderAnswer, rating: 1 }],
    } as never);

    expect(store.mocks.saveConversation).toHaveBeenCalledTimes(1);
    expect(store.messages[0]).toMatchObject({ rating: 1 });
  });

  it('keeps a placeholder written during the last conflict instead of saving over it', async () => {
    const store = makeStore([olderAnswer]);
    store.failures.conflicts = 3;
    const conditionalSave =
      store.mocks.saveConversationIfMatch.getMockImplementation();
    store.mocks.saveConversationIfMatch.mockImplementation(async (...args) => {
      const result = await conditionalSave?.(...args);
      if (store.mocks.saveConversationIfMatch.mock.calls.length === 3) {
        store.setMessages([olderAnswer, runningStored()]);
      }
      return result as never;
    });
    const { service } = makeService({ store });

    await expect(
      service.saveClientConversation(context, {
        id: 'bucket/conv',
        messages: [{ ...olderAnswer, rating: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(store.mocks.saveConversation).not.toHaveBeenCalled();
    expect(store.messages[1].backgroundGeneration?.status).toBe(
      BackgroundGenerationStatus.Pending,
    );
  });

  it('fails with 503 when conflicts persist while an answer is pending', async () => {
    const store = makeStore([olderAnswer, runningStored()]);
    store.failures.conflicts = 3;
    const { service } = makeService({ store });

    await expect(
      service.saveClientConversation(context, {
        id: 'bucket/conv',
        messages: [{ ...olderAnswer, rating: 1 }, runningStored()],
      } as never),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(store.mocks.saveConversation).not.toHaveBeenCalled();
  });
});

describe('background generation memory', () => {
  it('keeps no answer text in the registry for long, concurrent generations', async () => {
    const registry = new ConversationGenerationService({
      get: () => undefined,
    } as never);
    const run = async (owner: string) => {
      const store = makeStore();
      const events = [
        created,
        ...Array.from({ length: 5_000 }, (_, i) => delta(`token-${i} `)),
        completed,
      ];
      const dialClient = {
        client: {
          createResponse: vi.fn(async () => ({
            response: new Response(sse(events), { status: 200 }),
          })),
        },
      } as unknown as DialClientService;
      const service = new BackgroundGenerationService(
        store.persistence,
        new ResponsesAdapter(dialClient),
        makeCore(),
        registry,
      );
      const lease = registry.register(owner, 'conv', GEN);
      const generator = service.startAndRelay(params({ lease }) as never);
      let next = await generator.next();
      let relayed = 0;
      while (!next.done) {
        relayed++;
        if (relayed === 2_500) {
          expect(
            JSON.stringify(registry.getAssembledMessage(lease) ?? {}),
          ).not.toContain('token-');
        }
        next = await generator.next();
      }
      return relayed;
    };

    const [first, second] = await Promise.all([run('owner-a'), run('owner-b')]);

    expect(first).toBeGreaterThan(5_000);
    expect(second).toBeGreaterThan(5_000);
  });
});

describe('background generation telemetry', () => {
  it('records the outcome reason only, never ids or content', async () => {
    const addSpy = vi.spyOn(backgroundGenerationOutcomesTotal, 'add');
    const store = makeStore();
    const { service } = makeService({ store });

    await drain(service.startAndRelay(params() as never));

    expect(addSpy).toHaveBeenCalledWith(1, {
      outcome: BackgroundGenerationOutcome.FinalizedOrigin,
    });
    for (const [, attributes] of addSpy.mock.calls) {
      expect(Object.keys(attributes ?? {})).toEqual(['outcome']);
    }
    addSpy.mockRestore();
  });

  it('declares every outcome reason named by the spec', () => {
    expect(Object.values(BackgroundGenerationOutcome).sort()).toEqual(
      [
        'delete_failed',
        'detached_max_duration',
        'detached_shutdown',
        'expired',
        'finalized_origin',
        'finalized_recovery',
        'interrupted_start',
        'placeholder_fallback',
        'save_failed',
        'stopped',
        'cancel_unsupported',
      ].sort(),
    );
  });
});

describe('extractOutputText', () => {
  it('keeps only answer text, never reasoning', () => {
    expect(
      extractOutputText({
        id: RESPONSE_ID,
        status: 'completed',
        output: [
          {
            type: 'reasoning',
            content: [{ type: 'reasoning_text', text: 'thinking' }],
          },
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'Hello' },
              { type: 'refusal', text: '!' },
              { type: 'output_text', text: ' world' },
            ],
          },
        ],
      }),
    ).toBe('Hello world');
  });
});

describe('toTerminalFields', () => {
  const stored = {
    ...pendingMessage(),
    responseId: RESPONSE_ID,
    rating: 1,
  } as never;

  it('returns null while the job is running', () => {
    expect(
      toTerminalFields(stored, { id: RESPONSE_ID, status: 'in_progress' }),
    ).toBeNull();
  });

  it('maps an expired job to failed with an empty error text', () => {
    expect(toTerminalFields(stored, null)).toMatchObject({
      streamErrorMessage: '',
      backgroundGeneration: { status: BackgroundGenerationStatus.Failed },
    });
  });

  it('maps an incomplete job to failed with the same error text as the stateless path', () => {
    expect(
      toTerminalFields(stored, { id: RESPONSE_ID, status: 'incomplete' }),
    ).toMatchObject({
      streamErrorMessage: RESPONSES_INCOMPLETE_MESSAGE,
      backgroundGeneration: { status: BackgroundGenerationStatus.Failed },
    });
  });

  it('maps a failed job like the stateless path, with a fallback text', () => {
    expect(
      toTerminalFields(stored, {
        id: RESPONSE_ID,
        status: 'failed',
        error: { message: 'quota exceeded' },
      })?.streamErrorMessage,
    ).toBe('quota exceeded');
    expect(
      toTerminalFields(stored, { id: RESPONSE_ID, status: 'failed' })
        ?.streamErrorMessage,
    ).toBe(RESPONSES_FAILED_MESSAGE);
  });
});
