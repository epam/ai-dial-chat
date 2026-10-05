import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth/auth-source.enum';
import { resolvePrincipalKey } from '../../auth/session/principal-key';
import type { DialClientService } from '../../dial/dial-client.service';
import { ConversationGenerationService } from '../conversation-generation.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';
import { BackgroundGenerationStatus } from '../dto/background-generation.dto';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';
import { BackgroundGenerationService } from '../generation/background-generation.service';
import { neutralizeForeignPendingMessages } from '../generation/background-message';
import {
  CoreResponseResultKind,
  type CoreResponsesClient,
} from '../generation/core-responses.client';
import { ResponsesAdapter } from '../generation/responses.adapter';
import {
  runConditionalUpdate,
  type ConversationPersistenceService,
} from '../persistence/conversation-persistence.service';

const TEST_USER = {
  sid: 'test-sid',
  sub: 'test-sub',
  providerId: 'keycloak',
  at: 'test-access-token',
  bucket: 'test-bucket',
  claims: {},
  csrf: 'test-csrf',
};
const PATH = 'gpt-4o__Hello__uuid';
const GEN = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const RESPONSE_ID = 'dial_gpt-4o_r1';

const user: ConversationMessageDto = {
  role: ConversationMessageRole.User,
  content: 'Hello',
  timestamp: 't0',
};
const pending = (
  extra: Partial<ConversationMessageDto> = {},
): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: 't1',
  responseId: RESPONSE_ID,
  backgroundGeneration: {
    generationId: GEN,
    status: BackgroundGenerationStatus.Pending,
    startedAt: Date.now(),
  },
  ...extra,
});

const makeStore = (messages: ConversationMessageDto[]) => {
  let version = 1;
  let conversation = { id: `test-bucket/${PATH}`, name: 'c', messages };
  const persistence: ConversationPersistenceService = {
    readConversationWithEtag: vi.fn(async () => ({
      conversation: structuredClone(conversation),
      etag: `"v${version}"`,
    })),
    saveConversationIfMatch: vi.fn(
      async (_p: string, _t: string, _b: string, body: never, etag: string) => {
        if (etag !== `"v${version}"`) return { isSaved: false };
        conversation = structuredClone(body);
        version++;
        return { isSaved: true, conversation: body };
      },
    ),
    updateConversation: vi.fn(
      (
        ...args: Parameters<
          ConversationPersistenceService['updateConversation']
        >
      ) => runConditionalUpdate(persistence as never, ...args),
    ),
  } as unknown as ConversationPersistenceService;
  return {
    persistence,
    get messages(): ConversationMessageDto[] {
      return conversation.messages;
    },
    replace(next: ConversationMessageDto[]) {
      conversation = { ...conversation, messages: next };
      version++;
    },
  };
};

const sseBody = (events: unknown[]) => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
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

const okResponse = (status: string, text = '') => ({
  kind: CoreResponseResultKind.Ok,
  response: {
    id: RESPONSE_ID,
    status,
    output: text ? [{ content: [{ type: 'output_text', text }] }] : [],
  },
});

const parseEvents = (text: string) =>
  text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);

describe('POST /conversations/completions/attach — background generations', () => {
  let app: INestApplication;
  let store: ReturnType<typeof makeStore>;
  let core: Record<string, ReturnType<typeof vi.fn>>;
  let currentUser: Partial<typeof TEST_USER> = {};
  const fallbackSave = vi.fn(async (conversation: unknown) => conversation);

  const startApp = async () => {
    const background = new BackgroundGenerationService(
      store.persistence,
      new ResponsesAdapter({ client: {} } as unknown as DialClientService),
      core as unknown as CoreResponsesClient,
      { complete: vi.fn(), beginFinalizing: vi.fn() } as never,
    );
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        {
          provide: ConversationService,
          useValue: {
            resolveBackgroundAttach: (
              path: string,
              token: string,
              bucket: string,
              signal: AbortSignal,
            ) =>
              background.resolveAttach(
                { conversationPath: path, token, bucket },
                signal,
              ),
            stopBackgroundGeneration: (
              path: string,
              token: string,
              bucket: string,
              generationId: string,
              content?: string,
            ) =>
              background.stop(
                { conversationPath: path, token, bucket },
                generationId,
                content,
              ),
            saveClientConversation: async (
              path: string,
              token: string,
              bucket: string,
              conversation: never,
            ) =>
              (await background.saveClientConversation(
                { conversationPath: path, token, bucket },
                conversation,
              )) ??
              fallbackSave({
                ...(conversation as { messages?: ConversationMessageDto[] }),
                messages: neutralizeForeignPendingMessages(
                  (conversation as { messages?: ConversationMessageDto[] })
                    .messages,
                ),
              }),
          },
        },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        ConversationGenerationService,
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(
      (req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
        req.user = { ...TEST_USER, ...currentUser };
        req.authSource = AuthSource.Cookie;
        next();
      },
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  };

  const attach = () =>
    request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });

  beforeEach(() => {
    currentUser = {};
    core = {
      retrieveResponse: vi.fn(),
      replayResponse: vi.fn(),
      cancelResponse: vi.fn(),
      deleteResponse: vi.fn(async () => CoreResponseResultKind.Ok),
    };
  });

  afterEach(async () => {
    await app?.close();
  });

  it('replays a running job from the first event on an instance that did not start it', async () => {
    store = makeStore([user, pending()]);
    core.retrieveResponse
      .mockResolvedValueOnce(okResponse('in_progress'))
      .mockResolvedValueOnce(okResponse('completed', 'Hello world'));
    core.replayResponse.mockResolvedValue({
      kind: CoreResponseResultKind.Ok,
      body: sseBody([
        {
          type: 'response.created',
          response: { id: RESPONSE_ID, status: 'queued' },
        },
        { type: 'response.output_text.delta', delta: 'Hello' },
        { type: 'response.output_text.delta', delta: ' world' },
        {
          type: 'response.completed',
          response: { id: RESPONSE_ID, status: 'completed' },
        },
      ]),
    });
    await startApp();

    const response = await attach().expect(200);

    const events = parseEvents(response.text);
    expect(events[0]).toMatchObject({
      type: 'snapshot',
      message: { content: '' },
    });
    const text = events
      .filter((event) => event.type === 'chunk')
      .map(
        (event) =>
          (event.chunk as { choices?: Array<{ delta?: { content?: string } }> })
            .choices?.[0]?.delta?.content ?? '',
      )
      .join('');
    expect(text).toBe('Hello world');
    expect(events.at(-1)).toEqual({ type: 'done' });
    expect(store.messages.at(-1)).toMatchObject({
      content: 'Hello world',
      backgroundGeneration: { status: BackgroundGenerationStatus.Completed },
    });
    expect(core.replayResponse).toHaveBeenCalledWith(
      RESPONSE_ID,
      'test-access-token',
      expect.any(AbortSignal),
    );
  });

  it('finalizes a job that already finished and sends the saved message', async () => {
    store = makeStore([user, pending()]);
    core.retrieveResponse.mockResolvedValue(
      okResponse('completed', 'Done text'),
    );
    await startApp();

    const events = parseEvents((await attach().expect(200)).text);

    expect(events).toEqual([
      {
        type: 'snapshot',
        message: expect.objectContaining({ content: 'Done text' }),
      },
      { type: 'done' },
    ]);
    expect(core.retrieveResponse).toHaveBeenCalledTimes(1);
    expect(core.replayResponse).not.toHaveBeenCalled();
    expect(core.deleteResponse).toHaveBeenCalledWith(
      RESPONSE_ID,
      'test-access-token',
    );
  });

  it('marks an expired job as failed with an empty error text', async () => {
    store = makeStore([user, pending()]);
    core.retrieveResponse.mockResolvedValue({
      kind: CoreResponseResultKind.NotFound,
    });
    await startApp();

    const events = parseEvents((await attach().expect(200)).text);

    expect(events.at(-1)).toEqual({ type: 'error' });
    expect(store.messages.at(-1)).toMatchObject({
      streamErrorMessage: '',
      backgroundGeneration: { status: BackgroundGenerationStatus.Failed },
    });
  });

  it('keeps a completed answer written in parallel instead of marking it expired', async () => {
    store = makeStore([user, pending()]);
    core.retrieveResponse.mockImplementation(async () => {
      store.replace([
        user,
        pending({
          content: 'finished elsewhere',
          backgroundGeneration: {
            generationId: GEN,
            status: BackgroundGenerationStatus.Completed,
            startedAt: 1,
          },
        }),
      ]);
      return { kind: CoreResponseResultKind.NotFound };
    });
    await startApp();

    const events = parseEvents((await attach().expect(200)).text);

    expect(events.at(-1)).toEqual({ type: 'done' });
    expect(store.messages.at(-1)).toMatchObject({
      content: 'finished elsewhere',
      backgroundGeneration: { status: BackgroundGenerationStatus.Completed },
    });
  });

  it("responds 404 without writing for another user's job", async () => {
    store = makeStore([user, pending()]);
    core.retrieveResponse.mockResolvedValue({
      kind: CoreResponseResultKind.Forbidden,
    });
    await startApp();

    await attach().expect(404);

    expect(store.messages.at(-1)?.backgroundGeneration?.status).toBe(
      BackgroundGenerationStatus.Pending,
    );
  });

  it('keeps the non-background 404 when the conversation has no pending background message', async () => {
    store = makeStore([user]);
    await startApp();

    await attach().expect(404);

    expect(core.retrieveResponse).not.toHaveBeenCalled();
  });

  it('marks a start older than 2 minutes without a responseId as failed and never resubmits', async () => {
    store = makeStore([
      user,
      pending({
        responseId: undefined,
        backgroundGeneration: {
          generationId: GEN,
          status: BackgroundGenerationStatus.Pending,
          startedAt: Date.now() - 180_000,
        },
      }),
    ]);
    await startApp();

    const events = parseEvents((await attach().expect(200)).text);

    expect(events.at(-1)).toEqual({ type: 'error' });
    expect(store.messages.at(-1)).toMatchObject({
      streamErrorMessage: '',
      backgroundGeneration: { status: BackgroundGenerationStatus.Failed },
    });
    expect(core.retrieveResponse).not.toHaveBeenCalled();
  });

  it('responds 404 without writing while a recent start is still waiting for its responseId', async () => {
    store = makeStore([
      user,
      pending({
        responseId: undefined,
        backgroundGeneration: {
          generationId: GEN,
          status: BackgroundGenerationStatus.Pending,
          startedAt: Date.now() - 5_000,
        },
      }),
    ]);
    await startApp();

    await attach().expect(404);

    expect(store.messages.at(-1)?.backgroundGeneration?.status).toBe(
      BackgroundGenerationStatus.Pending,
    );
  });

  describe('POST /conversations/completions/stop', () => {
    const stop = (generationId = GEN, content?: string) =>
      request(app.getHttpServer())
        .post('/conversations/completions/stop')
        .send({ path: PATH, generationId, content });

    it('stops a background generation from another session of the same user', async () => {
      store = makeStore([user, pending()]);
      core.cancelResponse.mockResolvedValue({
        kind: CoreResponseResultKind.Ok,
        response: { id: RESPONSE_ID, status: 'cancelled' },
      });
      currentUser = { sid: 'another-session' };
      await startApp();

      await stop(GEN, 'Partial').expect(204);

      expect(store.messages.at(-1)).toMatchObject({
        content: 'Partial',
        wasStoppedByUser: true,
        backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
      });
      expect(core.replayResponse).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(core.cancelResponse).toHaveBeenCalled());
      expect(core.cancelResponse).toHaveBeenCalledWith(
        RESPONSE_ID,
        'test-access-token',
      );
    });

    it('also ends the relay when the stopping instance runs it', async () => {
      store = makeStore([user, pending()]);
      core.replayResponse.mockResolvedValue({
        kind: CoreResponseResultKind.Error,
      });
      core.cancelResponse.mockResolvedValue({
        kind: CoreResponseResultKind.Error,
      });
      await startApp();
      const lease = app
        .get(ConversationGenerationService)
        .register(
          resolvePrincipalKey(TEST_USER as never, AuthSource.Cookie),
          PATH,
          GEN,
        );
      app.get(ConversationGenerationService).setBackground(lease, true);

      await stop().expect(204);

      expect(lease.abortController.signal.aborted).toBe(true);
    });

    it('leaves the relay running when Stop comes before the job reported its id', async () => {
      store = makeStore([user, pending({ responseId: undefined })]);
      await startApp();
      const lease = app
        .get(ConversationGenerationService)
        .register(
          resolvePrincipalKey(TEST_USER as never, AuthSource.Cookie),
          PATH,
          GEN,
        );
      app.get(ConversationGenerationService).setBackground(lease, true);

      await stop().expect(204);

      expect(store.messages.at(-1)).toMatchObject({
        wasStoppedByUser: true,
        backgroundGeneration: { status: BackgroundGenerationStatus.Stopped },
      });
      expect(lease.abortController.signal.aborted).toBe(false);
    });

    it('responds 204 without writing for a background message that already finished', async () => {
      store = makeStore([
        user,
        pending({
          backgroundGeneration: {
            generationId: GEN,
            status: BackgroundGenerationStatus.Completed,
            startedAt: 1,
          },
        }),
      ]);
      await startApp();

      await stop().expect(204);

      expect(core.replayResponse).not.toHaveBeenCalled();
      expect(core.cancelResponse).not.toHaveBeenCalled();
    });

    it('stops a non-background generation running here without reading the conversation, ignoring the shown text', async () => {
      store = makeStore([user]);
      await startApp();
      const lease = app
        .get(ConversationGenerationService)
        .register(
          resolvePrincipalKey(TEST_USER as never, AuthSource.Cookie),
          PATH,
          GEN,
        );

      await stop(GEN, 'client text').expect(204);

      expect(lease.abortController.signal.aborted).toBe(true);
      expect(store.persistence.readConversationWithEtag).not.toHaveBeenCalled();
      expect(store.persistence.saveConversationIfMatch).not.toHaveBeenCalled();
    });

    it('leaves the relay running on a second Stop of an already stopped message', async () => {
      store = makeStore([
        user,
        pending({
          responseId: undefined,
          wasStoppedByUser: true,
          backgroundGeneration: {
            generationId: GEN,
            status: BackgroundGenerationStatus.Stopped,
            startedAt: Date.now(),
          },
        } as never),
      ]);
      await startApp();
      const registry = app.get(ConversationGenerationService);
      const lease = registry.register(
        resolvePrincipalKey(TEST_USER as never, AuthSource.Cookie),
        PATH,
        GEN,
      );
      registry.setBackground(lease, true);

      await stop(GEN, 'Hi').expect(204);

      expect(lease.abortController.signal.aborted).toBe(false);
    });

    it('keeps the registry 404 when no background message carries the generation id', async () => {
      store = makeStore([user]);
      await startApp();

      await stop().expect(404);

      expect(core.cancelResponse).not.toHaveBeenCalled();
    });
  });

  describe('PUT /conversations', () => {
    const save = (body: unknown) =>
      request(app.getHttpServer())
        .put('/conversations')
        .query({ path: PATH })
        .send({ conversation: body });

    it('keeps a pending background message when the client saves a rating on an older message', async () => {
      const older: ConversationMessageDto = {
        role: ConversationMessageRole.Assistant,
        content: 'older',
        timestamp: 't',
      };
      store = makeStore([user, older, user, pending()]);
      await startApp();

      const response = await save({
        id: `test-bucket/${PATH}`,
        name: 'c',
        messages: [
          user,
          { ...older, rating: 1 },
          user,
          {
            role: ConversationMessageRole.Assistant,
            content: 'Hel',
            timestamp: 't1',
          },
        ],
      }).expect(200);

      expect(store.messages[1]).toMatchObject({ rating: 1 });
      expect(store.messages[3]).toMatchObject({
        content: '',
        backgroundGeneration: { status: BackgroundGenerationStatus.Pending },
      });
      expect(response.body.messages[3].backgroundGeneration.status).toBe(
        BackgroundGenerationStatus.Pending,
      );
      expect(fallbackSave).not.toHaveBeenCalled();
    });

    it('never lets a client body create a pending marker, so an imported copy cannot adopt a live job', async () => {
      store = makeStore([user]);
      await startApp();

      await save({
        id: `test-bucket/${PATH}`,
        name: 'c',
        messages: [user, pending()],
      }).expect(200);

      expect(store.messages).toEqual([
        user,
        expect.objectContaining({
          streamErrorMessage: '',
          backgroundGeneration: expect.objectContaining({
            status: BackgroundGenerationStatus.Failed,
          }),
        }),
      ]);
    });

    it('saves a conversation without a pending background message with If-Match', async () => {
      store = makeStore([user]);
      await startApp();
      const body = { id: `test-bucket/${PATH}`, name: 'c', messages: [user] };

      await save(body).expect(200);

      expect(
        vi.mocked(store.persistence.saveConversationIfMatch),
      ).toHaveBeenCalledWith(
        PATH,
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ messages: [user] }),
        expect.any(String),
      );
      expect(fallbackSave).not.toHaveBeenCalled();
    });

    it('keeps the unconditional save when the conversation cannot be read', async () => {
      store = makeStore([]);
      vi.mocked(store.persistence.readConversationWithEtag).mockRejectedValue(
        new Error('storage down'),
      );
      await startApp();
      const body = { id: `test-bucket/${PATH}`, name: 'c', messages: [user] };

      await save(body).expect(200);

      expect(fallbackSave).toHaveBeenCalledWith(body);
    });
  });
});
