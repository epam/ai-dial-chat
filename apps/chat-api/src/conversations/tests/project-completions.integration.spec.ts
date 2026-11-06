import { ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagsService } from '../../app-config/feature-flags/feature-flags.service';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DeploymentsService } from '../../deployments/deployments.service';
import type { DialClientService } from '../../dial/dial-client.service';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import { BackgroundGenerationStatus } from '../dto/background-generation.dto';
import {
  type ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';
import { CompletionMode } from '../dto/send-completion.dto';
import { BackgroundGenerationService } from '../generation/background-generation.service';
import { ChatCompletionsAdapter } from '../generation/chat-completions.adapter';
import { ConversationGenerationService } from '../generation/conversation-generation.service';
import {
  CoreResponseResultKind,
  type CoreResponsesClient,
} from '../generation/core-responses.client';
import { GenerationApiSelector } from '../generation/generation-api-selector.service';
import { ResponsesAdapter } from '../generation/responses.adapter';
import {
  runConditionalUpdate,
  type ConversationPersistenceService,
} from '../persistence/conversation-persistence.service';
import { ConversationStreamingService } from '../streaming/conversation-streaming.service';

const LOCATOR = 'projects/a1b2c3/support-quality/conversations/gpt-4o__Hi__1';
const TOP_LEVEL = 'a1b2c3/gpt-4o__Hi__1';
const GEN = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

const sse = (chunks: string[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
    { status: 200 },
  );

const makeHarness = () => {
  const stored: ConversationResponseDto = {
    id: LOCATOR,
    folderId: 'projects/a1b2c3/support-quality',
    name: 'Hi',
    prompt: 'Answer in English.',
    messages: [],
  } as unknown as ConversationResponseDto;
  const client = {
    sendChatCompletionRequest: vi.fn(async () => ({
      response: sse([
        'data: {"choices":[{"delta":{"content":"Ok"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    })),
    downloadProjectFile: vi.fn(),
    listProjectFileMetadata: vi.fn(),
  };
  const dial = {
    client,
    dialApiVersion: '2024-02-01',
  } as unknown as DialClientService;
  /* Storage is consistent: a conditional writer's re-read sees what was written last. */
  let current = structuredClone(stored);
  const persistence = {
    getConversationWithStoredVersion: vi.fn(async () => ({
      conversation: structuredClone(current),
      stored: { conversation: structuredClone(current), etag: '"sha256:x"' },
    })),
    readConversationWithEtag: vi.fn(async () => ({
      conversation: structuredClone(current),
      etag: '"sha256:x"',
    })),
    saveConversationIfMatch: vi.fn(
      async (
        _p: string,
        _t: string,
        _b: string,
        body: ConversationResponseDto,
      ) => {
        current = structuredClone(body);
        return { isSaved: true, conversation: body };
      },
    ),
    saveConversation: vi.fn(
      async (
        _p: string,
        _t: string,
        _b: string,
        body: ConversationResponseDto,
      ) => {
        current = structuredClone(body);
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
  } as unknown as ConversationPersistenceService;
  const deployments = {
    resolveDeploymentItem: vi.fn().mockResolvedValue(null),
    getDeploymentDetails: vi.fn().mockResolvedValue({
      modelDetails: { features: { chatCompletion: true } },
    }),
  } as unknown as DeploymentsService;
  const config = new ConfigService<EnvironmentVariables>({});
  const registry = new ConversationGenerationService(config);
  const streaming = new ConversationStreamingService(
    dial,
    registry,
    persistence,
    deployments,
    new ResponsesAdapter(dial),
    new ChatCompletionsAdapter(dial),
    new GenerationApiSelector(deployments, {
      isEnabled: vi.fn().mockResolvedValue(false),
    } as unknown as FeatureFlagsService),
    {} as BackgroundGenerationService,
    config,
  );
  const run = async (path: string) => {
    const stream = streaming.streamCompletion(
      path,
      'token',
      'a1b2c3',
      GEN,
      CompletionMode.Append,
      'Summarize the tickets',
      undefined,
      'gpt-4o',
      undefined,
      'c:session',
      () => undefined,
      'sub',
    );
    for await (const chunk of stream) void chunk;
  };
  const request = () => {
    const [, init] = client.sendChatCompletionRequest.mock
      .calls[0] as unknown as [
      string,
      {
        headers: Record<string, string>;
        body: {
          messages: {
            role: string;
            content: string;
            custom_content?: { attachments?: unknown[] };
          }[];
        };
      },
    ];
    return init;
  };
  return { run, request, client };
};

describe('project conversation completions', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends x-project-id and nothing else project-specific', async () => {
    const projectHarness = makeHarness();
    const topLevelHarness = makeHarness();

    await projectHarness.run(LOCATOR);
    await topLevelHarness.run(TOP_LEVEL);

    const project = projectHarness.request();
    expect(project.headers['x-project-id']).toBe(
      'projects/a1b2c3/support-quality',
    );
    expect(project.body).toEqual(topLevelHarness.request().body);
    expect(project.body.messages[0]).toEqual({
      role: 'system',
      content: 'Answer in English.',
    });
    expect(project.body.messages[1]).not.toHaveProperty('custom_content');
  });

  it('reads no project file before the model call', async () => {
    const harness = makeHarness();

    await harness.run(LOCATOR);

    expect(harness.client.downloadProjectFile).not.toHaveBeenCalled();
    expect(harness.client.listProjectFileMetadata).not.toHaveBeenCalled();
  });

  it('leaves a top-level conversation request unchanged', async () => {
    const harness = makeHarness();

    await harness.run(TOP_LEVEL);

    const { headers, body } = harness.request();
    expect(headers).not.toHaveProperty('x-project-id');
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: 'Answer in English.',
    });
    expect(body.messages[1]).not.toHaveProperty('custom_content');
  });
});

describe('project conversation background replay', () => {
  it('sends x-project-id on the DIAL Core replay', async () => {
    const pending: ConversationMessageDto = {
      role: ConversationMessageRole.Assistant,
      content: '',
      responseId: 'dial_r1',
      backgroundGeneration: {
        generationId: GEN,
        status: BackgroundGenerationStatus.Pending,
        startedAt: Date.now(),
      },
    } as ConversationMessageDto;
    const persistence = {
      readConversationWithEtag: vi.fn(async () => ({
        conversation: {
          id: LOCATOR,
          messages: [
            { role: ConversationMessageRole.User, content: 'Hi' },
            pending,
          ],
        },
        etag: '"sha256:x"',
      })),
    } as unknown as ConversationPersistenceService;
    const core = {
      retrieveResponse: vi.fn(async () => ({
        kind: CoreResponseResultKind.Ok,
        response: { id: 'dial_r1', status: 'in_progress', output: [] },
      })),
      replayResponse: vi.fn(async () => ({
        kind: CoreResponseResultKind.Error,
      })),
    };
    const background = new BackgroundGenerationService(
      persistence,
      new ResponsesAdapter({ client: {} } as unknown as DialClientService),
      core as unknown as CoreResponsesClient,
      { complete: vi.fn(), beginFinalizing: vi.fn() } as never,
    );
    const signal = new AbortController().signal;

    const plan = await background.resolveAttach(
      { conversationPath: LOCATOR, token: 'token', bucket: 'a1b2c3' },
      signal,
    );
    expect(plan?.kind).toBe('stream');
    if (plan?.kind !== 'stream') return;
    await plan.events.next();
    await plan.events.next().catch(() => undefined);

    expect(core.replayResponse).toHaveBeenCalledWith(
      'dial_r1',
      'token',
      signal,
      {
        'x-project-id': 'projects/a1b2c3/support-quality',
      },
    );
  });
});

/*
 * Two BFF instances (each with its own process-local registry) sharing one versioned
 * store that behaves like DIAL Core's compare-and-set: the issue #9731 scenario.
 */
describe('two instances sending into one conversation', () => {
  interface SharedStore {
    current: ConversationResponseDto;
    version: number;
    /* Runs once, before the next conditional write is checked. */
    beforeWrite?: () => Promise<void>;
  }

  const makeSharedStore = (path: string): SharedStore => ({
    current: {
      id: path,
      folderId: 'projects/a1b2c3/support-quality',
      name: 'Hi',
      prompt: '',
      messages: [],
    } as unknown as ConversationResponseDto,
    version: 1,
  });

  const makeInstance = (store: SharedStore, ownerKey: string) => {
    const read = () => ({
      conversation: structuredClone(store.current),
      etag: `"v${store.version}"`,
    });
    const persistence = {
      getConversationWithStoredVersion: vi.fn(async () => {
        const stored = read();
        return { conversation: stored.conversation, stored };
      }),
      readConversationWithEtag: vi.fn(async () => read()),
      saveConversationIfMatch: vi.fn(
        async (
          _p: string,
          _t: string,
          _b: string,
          body: ConversationResponseDto,
          etag: string,
        ) => {
          const hook = store.beforeWrite;
          store.beforeWrite = undefined;
          await hook?.();
          if (etag !== `"v${store.version}"`) return { isSaved: false };
          store.current = structuredClone(body);
          store.version += 1;
          return { isSaved: true, conversation: body };
        },
      ),
      saveConversation: vi.fn(),
      updateConversation: vi.fn(
        (
          ...args: Parameters<
            ConversationPersistenceService['updateConversation']
          >
        ) => runConditionalUpdate(persistence as never, ...args),
      ),
    } as unknown as ConversationPersistenceService;
    const client = {
      sendChatCompletionRequest: vi.fn(async () => ({
        response: sse([
          `data: {"choices":[{"delta":{"content":"Answer for ${ownerKey}"}}]}\n\n`,
          'data: [DONE]\n\n',
        ]),
      })),
    };
    const dial = {
      client,
      dialApiVersion: '2024-02-01',
    } as unknown as DialClientService;
    const deployments = {
      resolveDeploymentItem: vi.fn().mockResolvedValue(null),
      getDeploymentDetails: vi.fn().mockResolvedValue({
        modelDetails: { features: { chatCompletion: true } },
      }),
    } as unknown as DeploymentsService;
    const config = new ConfigService<EnvironmentVariables>({});
    const streaming = new ConversationStreamingService(
      dial,
      new ConversationGenerationService(config),
      persistence,
      deployments,
      new ResponsesAdapter(dial),
      new ChatCompletionsAdapter(dial),
      new GenerationApiSelector(deployments, {
        isEnabled: vi.fn().mockResolvedValue(false),
      } as unknown as FeatureFlagsService),
      {} as BackgroundGenerationService,
      config,
    );
    let headersSent = false;
    const send = async (path: string, generationId: string, text: string) => {
      const stream = streaming.streamCompletion(
        path,
        'token',
        'a1b2c3',
        generationId,
        CompletionMode.Append,
        text,
        undefined,
        'gpt-4o',
        undefined,
        ownerKey,
        () => {
          headersSent = true;
        },
        'sub',
      );
      for await (const chunk of stream) void chunk;
    };
    return {
      send: (path: string, generationId: string, text: string) =>
        send(path, generationId, text).then(
          () => undefined,
          (err: unknown) => err,
        ),
      client,
      headersSent: () => headersSent,
    };
  };

  const OWNER_GEN = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const EDITOR_GEN = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [
      'a project conversation, owner and editor',
      LOCATOR,
      'c:owner',
      'c:editor',
    ],
    [
      'a personal conversation, two cookie sessions of one user',
      TOP_LEVEL,
      'c:session-laptop',
      'c:session-phone',
    ],
  ])(
    'lets exactly one of two senders that read the same version generate in %s',
    async (_case, path, firstOwner, secondOwner) => {
      const store = makeSharedStore(path);
      const first = makeInstance(store, firstOwner);
      const second = makeInstance(store, secondOwner);
      let secondOutcome: Promise<unknown> | undefined;
      let releaseSecondModel: () => void = () => undefined;
      const secondStreaming = new Promise<void>((resolve) => {
        vi.mocked(
          second.client.sendChatCompletionRequest,
        ).mockImplementationOnce(async () => {
          resolve();
          await new Promise<void>((release) => {
            releaseSecondModel = release;
          });
          return {
            response: sse([
              `data: {"choices":[{"delta":{"content":"Answer for ${secondOwner}"}}]}\n\n`,
              'data: [DONE]\n\n',
            ]),
          };
        });
      });
      /*
       * Both senders read the same version: the second one stores its start state and
       * starts streaming before the first sender's start write is checked.
       */
      store.beforeWrite = async () => {
        secondOutcome = second.send(path, EDITOR_GEN, 'Second question');
        await secondStreaming;
      };

      const firstOutcome = await first.send(path, OWNER_GEN, 'First question');
      releaseSecondModel();

      expect(firstOutcome).toBeInstanceOf(ConflictException);
      expect(await secondOutcome).toBeUndefined();
      expect(first.headersSent()).toBe(false);
      expect(first.client.sendChatCompletionRequest).not.toHaveBeenCalled();
      expect(store.current.messages.map((message) => message.content)).toEqual([
        'Second question',
        `Answer for ${secondOwner}`,
      ]);
      expect(store.current.messages.at(-1)).not.toHaveProperty(
        'foregroundGeneration',
      );
    },
  );

  it('refuses a sender that reads after the other start state was stored, and keeps both exchanges intact', async () => {
    const store = makeSharedStore(LOCATOR);
    const owner = makeInstance(store, 'c:owner');
    const editor = makeInstance(store, 'c:editor');
    let editorOutcome: unknown;
    vi.mocked(owner.client.sendChatCompletionRequest).mockImplementationOnce(
      async () => {
        editorOutcome = await editor.send(
          LOCATOR,
          EDITOR_GEN,
          'Editor question',
        );
        return {
          response: sse([
            'data: {"choices":[{"delta":{"content":"Owner answer"}}]}\n\n',
            'data: [DONE]\n\n',
          ]),
        };
      },
    );

    expect(
      await owner.send(LOCATOR, OWNER_GEN, 'Owner question'),
    ).toBeUndefined();

    expect(editorOutcome).toBeInstanceOf(ConflictException);
    expect(editor.client.sendChatCompletionRequest).not.toHaveBeenCalled();
    expect(store.current.messages.map((message) => message.content)).toEqual([
      'Owner question',
      'Owner answer',
    ]);
  });
});
