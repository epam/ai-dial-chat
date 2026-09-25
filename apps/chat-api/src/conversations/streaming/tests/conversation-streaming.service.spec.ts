import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { FeatureFlagsService } from '../../../app-config/feature-flags/feature-flags.service';
import { FeatureKey } from '../../../app-config/feature-flags/feature-key.enum';
import type { DeploymentsService } from '../../../deployments/deployments.service';
import { DeploymentItemType } from '../../../deployments/dto/deployment-item.dto';
import type { DialClientService } from '../../../dial/dial-client.service';
import {
  ConversationGenerationService,
  GenerationCancelReason,
  type GenerationLease,
} from '../../conversation-generation.service';
import {
  ConversationMessageRole,
  StatusEvent,
} from '../../dto/conversation-message.dto';
import { CompletionMode } from '../../dto/send-completion.dto';
import { generationRequestsTotal } from '../../generation/generation-metrics';
import { ResponsesAdapter } from '../../generation/responses.adapter';
import { ConversationPersistenceService } from '../../persistence/conversation-persistence.service';
import { mergeHtmlTagAnnotationsIntoViewState } from '../../utils/conversation-view-state.server';
import { ConversationStreamingService } from '../conversation-streaming.service';

vi.mock(
  '../../utils/conversation-view-state.server',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../utils/conversation-view-state.server')
      >();
    return {
      ...actual,
      mergeHtmlTagAnnotationsIntoViewState: vi.fn(
        actual.mergeHtmlTagAnnotationsIntoViewState,
      ),
    };
  },
);

const TEST_CONVERSATION = {
  id: 'test-bucket/gpt-4o__Test__11111111-1111-1111-1111-111111111111',
  folderId: 'test-bucket',
  name: 'Test',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 1,
  messages: [],
  lastActivityDate: 0,
  updatedAt: 0,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
};

const makeMockRes = () => {
  const written: Uint8Array[] = [];
  return {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: Uint8Array | string) => {
      if (typeof chunk === 'string') {
        written.push(new TextEncoder().encode(chunk));
      } else {
        written.push(chunk);
      }
    }),
    end: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    writableEnded: false,
    status: vi.fn().mockReturnThis(),
    getWritten: () =>
      new TextDecoder().decode(
        Buffer.concat(written.map((b) => Buffer.from(b))),
      ),
  };
};

const makeLease = (
  abortController = new AbortController(),
): GenerationLease => ({
  abortController,
  operationId: 1,
});

const textToStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
};

describe('ConversationStreamingService', () => {
  let service: ConversationStreamingService;
  let mockDialClient: DialClientService;
  let mockGenerationService: ConversationGenerationService;
  let mockDeploymentsService: DeploymentsService;
  let mockFeatureFlagsService: FeatureFlagsService;
  let mockConversationNamingService: {
    maybeRenameAfterFirstReply: ReturnType<typeof vi.fn>;
  };
  let persistenceService: ConversationPersistenceService;

  /*
   * Mirrors ConversationController.streamCompletion: sets SSE headers via the
   * `onReadyToStream` callback at the exact point the service is ready to
   * stream, then writes every yielded chunk to `res` — the same split of
   * responsibility the controller uses in production.
   */
  const runStreamCompletion = async (
    conversationPath: string,
    token: string,
    bucket: string,
    generationId: string,
    mode: CompletionMode,
    message: string | undefined,
    messageIndex: number | undefined,
    model: string,
    customContent: unknown,
    sessionId: string,
    res: ReturnType<typeof makeMockRes>,
    clientChannelId?: string,
    timezone?: string,
    jobTitle?: string,
  ) => {
    const stream = service.streamCompletion(
      conversationPath,
      token,
      bucket,
      generationId,
      mode,
      message,
      messageIndex,
      model,
      customContent as never,
      sessionId,
      () => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
      },
      'user1',
      clientChannelId,
      timezone,
      jobTitle,
    );
    for await (const chunk of stream) {
      res.write(chunk);
    }
  };

  beforeEach(() => {
    mockDialClient = {
      client: {
        createResponse: vi.fn(),
        deleteConversation: vi.fn(),
        getConversation: vi.fn(),
        getConversationMetadata: vi.fn(),
        getSharedResources: vi.fn().mockResolvedValue({ data: undefined }),
        moveResource: vi.fn(),
        saveConversation: vi.fn(),
        sendChatCompletionRequest: vi.fn(),
        subscribeToResources: vi.fn(),
      },
      baseUrl: 'http://localhost:3000',
      dialApiVersion: '2024-10-21',
    } as unknown as DialClientService;
    mockConversationNamingService = {
      maybeRenameAfterFirstReply: vi.fn(),
    };
    mockGenerationService = {
      register: vi.fn().mockReturnValue(makeLease()),
      abort: vi.fn().mockReturnValue(true),
      complete: vi.fn(),
      error: vi.fn(),
      beginFinalizing: vi.fn(),
      getCancellation: vi.fn().mockReturnValue({ requested: false }),
      getAssembledMessage: vi.fn(),
      seedAssembledMessage: vi.fn(),
      applyChunk: vi.fn(),
      attach: vi.fn(),
    } as unknown as ConversationGenerationService;
    mockDeploymentsService = {
      getDeploymentDetails: vi.fn().mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { chatCompletion: true } },
      }),
    } as unknown as DeploymentsService;
    /*
     * Defaults to enabled so existing Responses-selection tests (which cover
     * resolveGenerationApi's own capability logic, not the feature flag)
     * don't need to know about the flag. Tests covering the flag itself
     * override this per-case.
     */
    mockFeatureFlagsService = {
      isEnabled: vi.fn().mockResolvedValue(true),
    } as unknown as FeatureFlagsService;
    persistenceService = new ConversationPersistenceService(
      mockDialClient,
      mockConversationNamingService as never,
    );
    service = new ConversationStreamingService(
      mockDialClient,
      mockGenerationService,
      persistenceService,
      mockDeploymentsService,
      new ResponsesAdapter(mockDialClient),
      mockFeatureFlagsService,
    );
    vi.spyOn(mockDialClient.client, 'saveConversation').mockResolvedValue({
      data: {},
    } as never);
    vi.spyOn(mockDialClient.client, 'getConversation').mockRejectedValue({
      error: { status: 404 },
    } as never);
  });

  describe('streamCompletion', () => {
    const baseConversation = {
      id: 'test-bucket/test-path',
      folderId: 'test-bucket',
      name: 'Test',
      model: { id: 'gpt-4o' },
      prompt: '',
      temperature: 1,
      selectedAddons: [],
      lastActivityDate: 0,
      updatedAt: 0,
    };

    const callStream = async (
      conversationData: object,
      message: string,
      model: string,
      customContent?: Record<string, unknown>,
      mode = CompletionMode.Append,
      streamChunks = [': keepalive\n\n'],
      clientChannelId?: string,
      timezone?: string,
      jobTitle?: string,
    ) => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: conversationData,
      } as never);
      const res = makeMockRes();
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const c of streamChunks) controller.enqueue(encoder.encode(c));
          controller.close();
        },
      });
      const sendSpy = vi
        .spyOn(mockDialClient.client, 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: new Response(mockStream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        } as never);
      await runStreamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'test-gen-id',
        mode,
        message,
        undefined,
        model,
        customContent as never,
        'test-session-id',
        res as never,
        clientChannelId,
        timezone,
        jobTitle,
      );
      return { sendSpy, res };
    };

    it('forwards the client channel id as X-DIAL-CLIENT-CHANNEL-ID when provided', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
        undefined,
        CompletionMode.Append,
        [': keepalive\n\n'],
        'channel-123',
      );

      expect(sendSpy.mock.calls[0][1].headers).toMatchObject({
        'X-DIAL-CLIENT-CHANNEL-ID': 'channel-123',
      });
    });

    it('forwards the stable conversation id as X-CONVERSATION-ID for Chat Completions', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(sendSpy.mock.calls[0][1].headers).toMatchObject({
        'X-CONVERSATION-ID': baseConversation.id,
      });
    });

    it('forwards the job title as X-JOB-TITLE for Chat Completions', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
        undefined,
        CompletionMode.Append,
        [': keepalive\n\n'],
        undefined,
        undefined,
        'Lead Software Engineer',
      );

      expect(sendSpy.mock.calls[0][1].headers).toMatchObject({
        'X-JOB-TITLE': 'Lead Software Engineer',
      });
    });

    it('omits X-JOB-TITLE for Chat Completions when no job title is provided', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(sendSpy.mock.calls[0][1].headers).not.toHaveProperty(
        'X-JOB-TITLE',
      );
    });

    it('percent-encodes non-Latin-1 characters in X-CONVERSATION-ID so the request reaches DIAL Core', async () => {
      /*
       * A new conversation's id embeds the user-authored title, so a prompt
       * containing an em dash / Cyrillic / an emoji used to make every
       * completion request for it throw a ByteString conversion TypeError.
       */
      const conversation = {
        ...baseConversation,
        id: 'test-bucket/gpt-4o__Привет — 🙂__11111111-1111-1111-1111-111111111111',
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      const headerValue = (
        sendSpy.mock.calls[0][1].headers as Record<string, string>
      )['X-CONVERSATION-ID'];
      expect(headerValue).toBe(
        'test-bucket/gpt-4o__%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82 %E2%80%94 %F0%9F%99%82__11111111-1111-1111-1111-111111111111',
      );
      expect(decodeURIComponent(headerValue)).toBe(conversation.id);
      expect(() =>
        new Headers().set('X-CONVERSATION-ID', headerValue),
      ).not.toThrow();
    });

    it('omits X-DIAL-CLIENT-CHANNEL-ID when no channel id is provided', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(sendSpy.mock.calls[0][1].headers).not.toHaveProperty(
        'X-DIAL-CLIENT-CHANNEL-ID',
      );
    });

    it('forwards the request timezone as X-Timezone when provided', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
        undefined,
        CompletionMode.Append,
        [': keepalive\n\n'],
        undefined,
        'Asia/Tokyo',
      );

      expect(sendSpy.mock.calls[0][1].headers).toMatchObject({
        'X-Timezone': 'Asia/Tokyo',
      });
    });

    it('omits X-Timezone when no request timezone is provided', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(sendSpy.mock.calls[0][1].headers).not.toHaveProperty('X-Timezone');
    });

    it('keeps timezone values isolated across concurrent completion requests', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: conversation,
      } as never);
      const sendSpy = vi
        .spyOn(mockDialClient.client, 'sendChatCompletionRequest')
        .mockImplementation(async () => ({
          data: {},
          response: new Response(textToStream(['data: [DONE]\n\n']), {
            status: 200,
          }),
        })) as ReturnType<typeof vi.fn>;

      await Promise.all([
        runStreamCompletion(
          'test-path-a',
          'test-token',
          'test-bucket',
          'test-gen-id-a',
          CompletionMode.Append,
          'First',
          undefined,
          'gpt-4o',
          undefined,
          'test-session-id',
          makeMockRes(),
          undefined,
          'Europe/Warsaw',
        ),
        runStreamCompletion(
          'test-path-b',
          'test-token',
          'test-bucket',
          'test-gen-id-b',
          CompletionMode.Append,
          'Second',
          undefined,
          'gpt-4o',
          undefined,
          'test-session-id',
          makeMockRes(),
          undefined,
          'Asia/Tokyo',
        ),
      ]);

      const timezones = sendSpy.mock.calls.map(
        (call) => (call[1].headers as Record<string, string>)['X-Timezone'],
      );
      expect(timezones).toEqual(
        expect.arrayContaining(['Europe/Warsaw', 'Asia/Tokyo']),
      );
    });

    it('does not include the request timezone in service logs', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };
      const debugSpy = vi.spyOn(service['logger'], 'debug');
      const logSpy = vi.spyOn(service['logger'], 'log');
      const warnSpy = vi.spyOn(service['logger'], 'warn');
      const errorSpy = vi.spyOn(service['logger'], 'error');

      await callStream(
        conversation,
        'Next message',
        'gpt-4o',
        undefined,
        CompletionMode.Append,
        [': keepalive\n\n'],
        undefined,
        'Pacific/Auckland',
      );

      const loggedValues = [debugSpy, logSpy, warnSpy, errorSpy]
        .flatMap((spy) => spy.mock.calls)
        .flat()
        .join(' ');
      expect(loggedValues).not.toContain('Pacific/Auckland');
    });

    it('uses Responses API when the server-resolved deployment supports it', async () => {
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: {
          features: { responsesApi: true, temperature: true },
        },
      });
      const createResponseSpy = vi
        .spyOn(mockDialClient.client, 'createResponse')
        .mockResolvedValue({
          response: new Response(
            textToStream([
              'data: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
              'data: {"type":"response.completed","response":{"id":"resp-1","status":"completed"}}\n\n',
            ]),
            { status: 200 },
          ),
        } as never);

      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy, res } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
        undefined,
        CompletionMode.Append,
        [': keepalive\n\n'],
        undefined,
        'Europe/Warsaw',
      );

      expect(createResponseSpy).toHaveBeenCalledOnce();
      expect(createResponseSpy.mock.calls[0][0].body).toMatchObject({
        model: 'gpt-4o',
        stream: true,
        store: false,
        temperature: 1,
      });
      expect(createResponseSpy.mock.calls[0][0].headers).toMatchObject({
        'X-Timezone': 'Europe/Warsaw',
        'X-CONVERSATION-ID': baseConversation.id,
      });
      expect(sendSpy).not.toHaveBeenCalled();
      expect(res.getWritten()).toContain('Hello');
      expect(res.getWritten()).toContain('data: [DONE]');
    });

    it('forwards the job title as X-JOB-TITLE for the Responses API', async () => {
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { responsesApi: true } },
      });
      const createResponseSpy = vi
        .spyOn(mockDialClient.client, 'createResponse')
        .mockResolvedValue({
          response: new Response(
            textToStream([
              'data: {"type":"response.completed","response":{"id":"resp-1","status":"completed"}}\n\n',
            ]),
            { status: 200 },
          ),
        } as never);

      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      await callStream(
        conversation,
        'Next message',
        'gpt-4o',
        undefined,
        CompletionMode.Append,
        [': keepalive\n\n'],
        undefined,
        undefined,
        'Lead Software Engineer',
      );

      expect(createResponseSpy.mock.calls[0][0].headers).toMatchObject({
        'X-JOB-TITLE': 'Lead Software Engineer',
      });
    });

    it('resolves the feature flag via FeatureFlagsService.isEnabled with the fixed server context', async () => {
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { responsesApi: true } },
      });

      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      await callStream(conversation, 'Next message', 'gpt-4o');

      expect(mockFeatureFlagsService.isEnabled).toHaveBeenCalledWith(
        FeatureKey.ResponsesApiEnabled,
        { appId: 'chat-api' },
      );
    });

    it('falls back to Chat Completions when the feature flag is disabled, even though the deployment supports Responses', async () => {
      vi.mocked(mockFeatureFlagsService.isEnabled).mockResolvedValue(false);
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { responsesApi: true, temperature: true } },
      });
      const createResponseSpy = vi.spyOn(
        mockDialClient.client,
        'createResponse',
      );

      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(sendSpy).toHaveBeenCalledOnce();
      expect(createResponseSpy).not.toHaveBeenCalled();
    });

    it('uses Chat Completions when the flag is enabled but the deployment does not support Responses', async () => {
      vi.mocked(mockFeatureFlagsService.isEnabled).mockResolvedValue(true);
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { responsesApi: false } },
      });
      const createResponseSpy = vi.spyOn(
        mockDialClient.client,
        'createResponse',
      );

      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(sendSpy).toHaveBeenCalledOnce();
      expect(createResponseSpy).not.toHaveBeenCalled();
    });

    it('falls back to Chat Completions when feature-flag resolution has already failed closed', async () => {
      /*
       * FeatureFlagsService.isEnabled never rejects — it catches internally
       * and resolves `false` on any resolution failure (see
       * feature-flags.service.ts). ConversationStreamingService relies on
       * that contract rather than adding its own catch, so this test mocks
       * the already-fail-closed outcome rather than a rejected promise.
       */
      vi.mocked(mockFeatureFlagsService.isEnabled).mockResolvedValue(false);
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { responsesApi: true } },
      });
      const createResponseSpy = vi.spyOn(
        mockDialClient.client,
        'createResponse',
      );

      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy, res } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(sendSpy).toHaveBeenCalledOnce();
      expect(createResponseSpy).not.toHaveBeenCalled();
      expect(mockGenerationService.error).not.toHaveBeenCalled();
      expect(res.getWritten()).not.toBe('');
    });

    it('omits temperature from the Chat Completions request when the deployment does not support it', async () => {
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { temperature: false } },
      });

      const conversation = {
        ...baseConversation,
        temperature: 1,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(sendSpy.mock.calls[0][1].body).not.toHaveProperty('temperature');
    });

    it('includes temperature in the Chat Completions request when the deployment supports it', async () => {
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { temperature: true } },
      });

      const conversation = {
        ...baseConversation,
        temperature: 1,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(sendSpy.mock.calls[0][1].body).toMatchObject({ temperature: 1 });
    });

    it('still rejects a toolset target with 400 regardless of the feature flag state', async () => {
      for (const flagEnabled of [true, false]) {
        vi.mocked(mockFeatureFlagsService.isEnabled).mockResolvedValue(
          flagEnabled,
        );
        vi.mocked(
          mockDeploymentsService.getDeploymentDetails,
        ).mockResolvedValue({
          id: 'my-toolset',
          type: 'toolset',
        } as never);

        const res = makeMockRes();
        await expect(
          runStreamCompletion(
            'test-path',
            'test-token',
            'test-bucket',
            'test-gen-id',
            CompletionMode.Append,
            'Hello',
            undefined,
            'my-toolset',
            undefined,
            'test-session-id',
            res as never,
          ),
        ).rejects.toThrow(/toolset and cannot be used for generation/);
      }
    });

    it('records generation.requests with generation.api=chat_completions when the flag suppresses an otherwise-eligible Responses selection', async () => {
      vi.mocked(mockFeatureFlagsService.isEnabled).mockResolvedValue(false);
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { responsesApi: true } },
      });
      const addSpy = vi.spyOn(generationRequestsTotal, 'add');

      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      await callStream(conversation, 'Next message', 'gpt-4o');

      expect(addSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ 'generation.api': 'chat_completions' }),
      );
    });

    it('does not retry through Chat Completions when a Responses request fails after it has started (flag enabled)', async () => {
      vi.mocked(mockFeatureFlagsService.isEnabled).mockResolvedValue(true);
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { responsesApi: true } },
      });
      const createResponseSpy = vi
        .spyOn(mockDialClient.client, 'createResponse')
        .mockResolvedValue({
          response: new Response(null, {
            status: 502,
            statusText: 'Bad Gateway',
          }),
        } as never);

      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );

      expect(createResponseSpy).toHaveBeenCalledOnce();
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('excludes ConversationMessageRole.Status messages from the DIAL Core payload', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 's1',
            role: ConversationMessageRole.Status,
            content: '',
            timestamp: '2024-01-01T00:00:01.000Z',
            custom_content: {
              event_type: StatusEvent.ModelChanged,
              previous_deployment_id: null,
              new_deployment_id: 'gpt-4o',
            },
          },
          {
            id: 'a1',
            role: ConversationMessageRole.Assistant,
            content: 'Hi there',
            timestamp: '2024-01-01T00:00:02.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Next message',
        'gpt-4o',
      );
      const sentMessages: { role: string }[] =
        sendSpy.mock.calls[0][1].body.messages;
      expect(
        sentMessages.some((m) => m.role === ConversationMessageRole.Status),
      ).toBe(false);
      expect(
        sentMessages.some((m) => m.role === ConversationMessageRole.User),
      ).toBe(true);
      expect(
        sentMessages.some((m) => m.role === ConversationMessageRole.Assistant),
      ).toBe(true);
    });

    it('includes all non-status messages in the DIAL Core payload', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'First',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 's1',
            role: ConversationMessageRole.Status,
            content: '',
            timestamp: '2024-01-01T00:00:01.000Z',
            custom_content: {
              event_type: StatusEvent.ModelChanged,
              previous_deployment_id: 'old-model',
              new_deployment_id: 'gpt-4o',
            },
          },
          {
            id: 'a1',
            role: ConversationMessageRole.Assistant,
            content: 'Response',
            timestamp: '2024-01-01T00:00:02.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(conversation, 'Follow-up', 'gpt-4o');
      const sentMessages = sendSpy.mock.calls[0][1].body.messages as {
        role: string;
        content: string;
      }[];
      expect(sentMessages).toHaveLength(3); // user + assistant + new user
      expect(sentMessages[0]).toMatchObject({
        role: ConversationMessageRole.User,
        content: 'First',
      });
      expect(sentMessages[1]).toMatchObject({
        role: ConversationMessageRole.Assistant,
        content: 'Response',
      });
      expect(sentMessages[2]).toMatchObject({
        role: ConversationMessageRole.User,
        content: 'Follow-up',
      });
    });

    it('moves current starter configuration to top-level custom_fields without clearing message content', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Pick a number',
            timestamp: '2024-01-01T00:00:00.000Z',
            custom_content: { configuration_value: { button: 1 } },
          },
        ],
      };

      // Conversation ends with user — use ContinueLastUser so history builder doesn't add another user msg
      const { sendSpy } = await callStream(
        conversation,
        '',
        'form-example',
        { configuration_value: { button: 1 } },
        CompletionMode.ContinueLastUser,
      );

      expect(sendSpy.mock.calls[0][1].body).toMatchObject({
        messages: [
          {
            role: ConversationMessageRole.User,
            content: 'Pick a number',
          },
        ],
        stream: true,
        custom_fields: { configuration: { button: 1 } },
      });
      expect(
        (sendSpy.mock.calls[0][1].body.messages[0] as Record<string, unknown>)
          .custom_content,
      ).toBeUndefined();
    });

    it('sends tool configuration_value as custom_fields.configuration', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Research this topic',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const { sendSpy } = await callStream(
        conversation,
        'Research this topic',
        'gpt-4o',
        { configuration_value: { deep_research: true } },
      );

      expect(sendSpy.mock.calls[0][1].body).toMatchObject({
        messages: expect.arrayContaining([
          {
            role: ConversationMessageRole.User,
            content: 'Research this topic',
          },
        ]),
        custom_fields: { configuration: { deep_research: true } },
      });
    });

    it('moves persisted form configuration to custom_fields without clearing message content', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: ConversationMessageRole.User,
            content: 'Pick a number',
            timestamp: '2024-01-01T00:00:00.000Z',
            custom_content: { configuration_value: { button: 1 } },
          },
          {
            id: 'a1',
            role: ConversationMessageRole.Assistant,
            content: 'Pick a number',
            timestamp: '2024-01-01T00:00:01.000Z',
            custom_content: {
              stages: [
                {
                  index: 0,
                  name: 'User message',
                  status: 'completed',
                  content: 'Content',
                },
              ],
              form_schema: {
                type: 'object',
                properties: { button: { type: 'number' } },
              },
            },
          },
          {
            id: 's1',
            role: ConversationMessageRole.Status,
            content: '',
            timestamp: '2024-01-01T00:00:02.000Z',
            custom_content: {
              event_type: StatusEvent.ModelChanged,
              previous_deployment_id: 'gpt-4o',
              new_deployment_id: 'form-example',
            },
          },
        ],
      };

      const { sendSpy } = await callStream(conversation, '', 'form-example', {
        form_value: { button: 2 },
      });

      expect(sendSpy.mock.calls[0][1].body.messages).toEqual([
        {
          role: ConversationMessageRole.User,
          content: 'Pick a number',
        },
        {
          role: ConversationMessageRole.Assistant,
          content: 'Pick a number',
          custom_content: {
            form_schema: {
              type: 'object',
              properties: { button: { type: 'number' } },
            },
          },
        },
        {
          role: ConversationMessageRole.User,
          content: '',
          custom_content: { form_value: { button: 2 } },
        },
      ]);
      expect(sendSpy.mock.calls[0][1].body.custom_fields).toEqual({
        configuration: { button: 1 },
      });
    });

    it('saves partial message with streamErrorMessage when DIAL Core returns non-ok response', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(null, {
          status: 400,
          statusText: 'Bad Request',
        }),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      // Should have saved at start (placeholder) + at error (partial with streamErrorMessage)
      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const errorSave = saveConversationSpy.mock.calls[1][2].body as {
        messages: { streamErrorMessage?: string }[];
      };
      const assistantMsg = errorSave.messages.at(-1) as Record<string, unknown>;
      /* 400 response has no JSON body in this mock — streamErrorMessage is '' (error with no specific text) */
      expect(assistantMsg.streamErrorMessage).toBe('');
    });

    it('saves partial message with streamErrorMessage for an in-band DIAL error chunk (no choices)', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      const encoder = new TextEncoder();
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"index":0,"finish_reason":null,"delta":{"role":"assistant"}}]}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"error":{"message":"Failed to connect to upstream server","type":"runtime_error","code":"BAD_GATEWAY","display_message":"Failed to connect to upstream server"}}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(mockStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const errorSave = saveConversationSpy.mock.calls[1][2].body as {
        messages: { content?: string; streamErrorMessage?: string }[];
      };
      const assistantMsg = errorSave.messages.at(-1) as Record<string, unknown>;
      expect(assistantMsg.streamErrorMessage).toBe(
        'Failed to connect to upstream server',
      );
      expect(assistantMsg.content).toBe('');
    });

    it('persists no raw error text when the upstream stream is terminated mid-response', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const errorSpy = vi.spyOn(service['logger'], 'error');
      const terminated = new TypeError('terminated');

      const encoder = new TextEncoder();
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"index":0,"finish_reason":null,"delta":{"role":"assistant","content":"Partial"}}]}\n\n',
            ),
          );
        },
        pull(controller) {
          controller.error(terminated);
        },
      });
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(mockStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const errorSave = saveConversationSpy.mock.calls[1][2].body as {
        messages: { content?: string; streamErrorMessage?: string }[];
      };
      const assistantMsg = errorSave.messages.at(-1);
      expect(assistantMsg?.streamErrorMessage).toBe('');
      expect(assistantMsg?.content).toBe('Partial');
      expect(JSON.stringify(errorSave)).not.toContain('terminated');
      expect(mockGenerationService.error).toHaveBeenCalledWith(
        expect.anything(),
        '',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'DIAL Core streamCompletion failed',
        terminated,
      );
    });

    it('writes SSE chunks to res and saves conversation on completion', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const firstChunk =
        'data: {"id":"resp-1","choices":[{"delta":{"content":"Hello"}}]}\n\n';
      const doneChunk = 'data: [DONE]\n\n';
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(textToStream([firstChunk, doneChunk]), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      // Written SSE data should contain our chunks
      const written = res.getWritten();
      expect(written).toContain('Hello');
      // Final save should include assembled content
      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const finalSave = saveConversationSpy.mock.calls[1][2].body as {
        messages: { content?: string }[];
      };
      expect(finalSave.messages.at(-1)?.content).toBe('Hello');
    });

    it('finalizes the generation on [DONE] even when the upstream keeps the connection open', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      vi.spyOn(mockDialClient.client, 'saveConversation').mockResolvedValue({
        data: {},
      } as never);

      const encoder = new TextEncoder();
      /*
       * Stream that emits content + [DONE] but is intentionally never closed,
       * mimicking a provider that holds the SSE socket open after [DONE].
       */
      const neverClosingStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"id":"resp-1","choices":[{"delta":{"content":"Hi"}}]}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          // no controller.close() — would hang the old "wait for socket close" logic
        },
      });
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(neverClosingStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      /*
       * The generation is released (complete), not left active — so a
       * subsequent request (e.g. regenerate) would not get a 409.
       */
      expect(mockGenerationService.complete).toHaveBeenCalledOnce();
      expect(mockGenerationService.error).not.toHaveBeenCalled();
    });

    it('stops and saves a pending tool-call stream without waiting for another upstream event', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const generationAbortController = new AbortController();
      const lease = makeLease(generationAbortController);
      vi.mocked(mockGenerationService.register).mockReturnValue(lease);
      vi.mocked(mockGenerationService.getCancellation).mockReturnValue({
        requested: true,
        reason: GenerationCancelReason.UserStop,
      });

      const encoder = new TextEncoder();
      const cancel = vi.fn();
      const pendingToolCallStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"custom_content":{"stages":[{"index":0,"name":"Calling tool","status":"in_progress"}]}}}]}\n\n',
            ),
          );
        },
        cancel,
      });
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(pendingToolCallStream, { status: 200 }),
      } as never);

      const res = makeMockRes();
      const streamPromise = runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Use a tool',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );
      await vi.waitFor(() => expect(res.write).toHaveBeenCalled());

      generationAbortController.abort();
      await streamPromise;

      expect(cancel).toHaveBeenCalledTimes(1);
      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const stoppedSave = saveConversationSpy.mock.calls[1][2].body as {
        messages: { wasStoppedByUser?: boolean }[];
      };
      expect(stoppedSave.messages.at(-1)?.wasStoppedByUser).toBe(true);
      expect(mockGenerationService.complete).not.toHaveBeenCalled();
      expect(mockGenerationService.error).toHaveBeenCalledWith(
        lease,
        undefined,
      );
    });

    it('finalizes as an error and releases the registry entry when the consumer is abandoned for a reason other than a relay terminal outcome (defensive backstop)', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const generationAbortController = new AbortController();
      const lease = makeLease(generationAbortController);
      vi.mocked(mockGenerationService.register).mockReturnValue(lease);

      const encoder = new TextEncoder();
      const cancel = vi.fn();
      const neverEndingStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
            ),
          );
          // never close — the consumer abandons before any more data arrives
        },
        cancel,
      });
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(neverEndingStream, { status: 200 }),
      } as never);

      const stream = service.streamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        () => undefined,
        'user1',
      );

      /*
       * `ConversationController.streamCompletion` no longer abandons its
       * consuming loop merely because the downstream response closed (see
       * backend-owned-generation-persistence) — it keeps calling `.next()`
       * to the generator's natural end regardless of disconnect. This test
       * instead exercises the `finally` block's remaining, genuinely
       * defensive purpose: some other caller (or an unexpected failure)
       * abandons the generator before the relay reaches a terminal
       * outcome. `break` here triggers the JS runtime to call `.return()`
       * on `stream`, the same way any such abandonment would.
       */
      for await (const _chunk of stream) {
        break;
      }

      expect(generationAbortController.signal.aborted).toBe(true);
      expect(mockGenerationService.complete).not.toHaveBeenCalled();
      expect(mockGenerationService.error).toHaveBeenCalledOnce();
      expect(mockGenerationService.error).toHaveBeenCalledWith(lease, '');
      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const partialSave = saveConversationSpy.mock.calls[1][2].body as {
        messages: { streamErrorMessage?: string }[];
      };
      expect(partialSave.messages.at(-1)?.streamErrorMessage).toBe('');
    });

    it("reaches Done and finalizes exactly once when the consumer drains to the relay's natural terminal outcome — the same unconditional-drain path the controller now uses after the downstream response has detached (e.g. a client disconnect)", async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      vi.spyOn(mockDialClient.client, 'saveConversation').mockResolvedValue({
        data: {},
      } as never);
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(
          textToStream([
            'data: {"id":"resp-1","choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: [DONE]\n\n',
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res,
      );

      expect(mockGenerationService.complete).toHaveBeenCalledOnce();
      expect(mockGenerationService.error).not.toHaveBeenCalled();
    });

    /*
     * `generation-registry` requires the aborted-outcome classification to
     * read cancellation state through the lease identity, never through
     * whatever entry currently occupies the owner+path key — so a
     * replacement that reused the same client generationId can never fool
     * this read. Keying the mock off lease identity (rather than always
     * answering the same way) proves the service passes the lease through,
     * not just "the current entry".
     */
    it('classifies the aborted outcome by lease identity, not by whatever occupies the registry key', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const lease = makeLease();
      vi.mocked(mockGenerationService.register).mockReturnValue(lease);
      vi.mocked(mockGenerationService.getCancellation).mockImplementation(
        (candidate: GenerationLease) =>
          candidate === lease
            ? { requested: true, reason: GenerationCancelReason.UserStop }
            : { requested: false },
      );

      const encoder = new TextEncoder();
      const pendingToolCallStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
            ),
          );
        },
      });
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(pendingToolCallStream, { status: 200 }),
      } as never);

      const res = makeMockRes();
      const streamPromise = runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );
      await vi.waitFor(() => expect(res.write).toHaveBeenCalled());
      lease.abortController.abort();
      await streamPromise;

      expect(mockGenerationService.getCancellation).toHaveBeenCalledWith(lease);
      const finalSave = saveConversationSpy.mock.calls.at(-1)?.[2].body as {
        messages: { wasStoppedByUser?: boolean }[];
      };
      expect(finalSave.messages.at(-1)?.wasStoppedByUser).toBe(true);
    });

    /*
     * `responses-api-generation` shares this single `finalize` path with
     * Chat Completions (`relayIterator`/`finalize` in `streamCompletion`), so
     * the same lease-scoped classification requirement must hold for a
     * Responses-API generation too.
     */
    it('classifies a stale-cancelled Responses-API generation by lease identity as well', async () => {
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: DeploymentItemType.Model,
        modelDetails: { features: { responsesApi: true } },
      });
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const lease = makeLease();
      vi.mocked(mockGenerationService.register).mockReturnValue(lease);
      vi.mocked(mockGenerationService.getCancellation).mockImplementation(
        (candidate: GenerationLease) =>
          candidate === lease
            ? { requested: true, reason: GenerationCancelReason.StaleExpiry }
            : { requested: false },
      );

      const encoder = new TextEncoder();
      const pendingResponseStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"response.output_text.delta","delta":"partial"}\n\n',
            ),
          );
        },
      });
      vi.spyOn(mockDialClient.client, 'createResponse').mockResolvedValue({
        response: new Response(pendingResponseStream, { status: 200 }),
      } as never);

      const res = makeMockRes();
      const streamPromise = runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );
      await vi.waitFor(() => expect(res.write).toHaveBeenCalled());
      lease.abortController.abort();
      await streamPromise;

      expect(mockGenerationService.getCancellation).toHaveBeenCalledWith(lease);
      const finalSave = saveConversationSpy.mock.calls.at(-1)?.[2].body as {
        messages: { streamErrorMessage?: string; wasStoppedByUser?: boolean }[];
      };
      /* Stale expiry — a non-user abort, never a user Stop. */
      expect(finalSave.messages.at(-1)?.streamErrorMessage).toBe('');
      expect(finalSave.messages.at(-1)?.wasStoppedByUser).toBeUndefined();
    });

    /*
     * Same requirement for the abandoned-generator `finally` branch: it must
     * fall back to the locally-held `assembledMessage` rather than reading
     * whatever entry currently occupies the key once the lease's own entry
     * has been replaced (`getAssembledMessage` returns `undefined` for a
     * stale lease per `generation-registry`).
     */
    it('falls back to the locally-held assembled message when the lease has been replaced, in the abandoned-generator branch', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const lease = makeLease();
      vi.mocked(mockGenerationService.register).mockReturnValue(lease);
      /* Simulates a replacement: this lease's entry no longer resolves. */
      vi.mocked(mockGenerationService.getCancellation).mockReturnValue(
        undefined,
      );
      vi.mocked(mockGenerationService.getAssembledMessage).mockReturnValue(
        undefined,
      );

      const encoder = new TextEncoder();
      const neverEndingStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"locally-held"}}]}\n\n',
            ),
          );
        },
      });
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(neverEndingStream, { status: 200 }),
      } as never);

      const stream = service.streamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        () => undefined,
        'user1',
      );

      for await (const _chunk of stream) {
        break;
      }

      expect(mockGenerationService.getAssembledMessage).toHaveBeenCalledWith(
        lease,
      );
      /*
       * A stale lease resolves no registry state, so the branch falls back
       * to whatever it holds locally rather than throwing or reading a
       * replacement's content — proven by finalize completing at all with a
       * defined body, not by a specific fallback value.
       */
      const finalSave = saveConversationSpy.mock.calls.at(-1)?.[2].body as {
        messages: { content?: string }[];
      };
      expect(finalSave.messages.at(-1)?.content).toBeDefined();
    });

    /*
     * A terminal write dispatched before a cancellation arrives cannot be
     * made harmless by any identity check performed before the `await` — the
     * write is already issued. This constructs a deferred `saveConversation`
     * so the assertion can only pass if the actually-persisted body is the
     * one the dispatched write carried, not a call count that a pre-save
     * check could satisfy by accident.
     */
    it('does not let a cancellation arriving after the terminal write was dispatched change what gets persisted', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      let resolveSave: (() => void) | undefined;
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockImplementation((...args: unknown[]) => {
          const body = (args[2] as { body: unknown }).body as {
            messages: { role: string; content?: string }[];
          };
          /*
           * Only gate the terminal write — it carries the completed content —
           * not the start-state write, whose assistant placeholder is empty.
           */
          if (body.messages.some((m) => m.role === 'assistant' && m.content)) {
            return new Promise((resolve) => {
              resolveSave = () => resolve({ data: {} } as never);
            });
          }
          return Promise.resolve({ data: {} } as never);
        });
      const lease = makeLease();
      vi.mocked(mockGenerationService.register).mockReturnValue(lease);

      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(
          textToStream([
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: [DONE]\n\n',
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      } as never);

      const res = makeMockRes();
      const streamPromise = runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      await vi.waitFor(() =>
        expect(mockGenerationService.beginFinalizing).toHaveBeenCalled(),
      );
      /* Cancellation arrives only after the write was already dispatched. */
      vi.mocked(mockGenerationService.getCancellation).mockReturnValue({
        requested: true,
        reason: GenerationCancelReason.UserStop,
      });
      lease.abortController.abort();
      resolveSave?.();
      await streamPromise;

      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const finalSave = saveConversationSpy.mock.calls.at(-1)?.[2].body as {
        messages: { content?: string; wasStoppedByUser?: boolean }[];
      };
      /* The completed content, not a stopped/partial one — one write, one outcome. */
      expect(finalSave.messages.at(-1)?.content).toContain('Hello');
      expect(mockGenerationService.complete).toHaveBeenCalledOnce();
      expect(mockGenerationService.error).not.toHaveBeenCalled();
    });

    it('releases ownership without a second write when the terminal write rejects ambiguously', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValueOnce({ data: {} } as never) // start-state write
        .mockRejectedValueOnce(new Error('ambiguous failure')); // terminal write

      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(
          textToStream([
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: [DONE]\n\n',
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      /* The worker is demonstrably finished, so ownership still releases. */
      expect(mockGenerationService.complete).toHaveBeenCalledOnce();
      expect(mockGenerationService.error).not.toHaveBeenCalled();
    });
  });

  describe('streamCompletion — customViewState annotation pool', () => {
    const htmlTagAnnotationChunk = (id: string, url = 'files/bucket/doc.pdf') =>
      `data: {"choices":[{"delta":{"content":"cited","custom_content":{"annotations":[{"target":{"selector":{"type":"html_tag","tag":"cit","id":"${id}"}},"body":{"source":{"type":"attachment","attachment":{"type":"application/pdf","url":"${url}"}}}}]}}}]}\n\n`;
    const doneChunk = 'data: [DONE]\n\n';

    it("writes a finished agent message's html_tag annotations into customViewState.annotations", async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(
          textToStream([htmlTagAnnotationChunk('e1'), doneChunk]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const finalSave = saveConversationSpy.mock.calls[1][2].body as {
        customViewState?: {
          annotations: { target: { selector: { id: string } } }[];
        };
      };
      expect(
        finalSave.customViewState?.annotations.map((a) => a.target.selector.id),
      ).toEqual(['e1']);
    });

    it('does not duplicate a re-cited id across two generations', async () => {
      const existingAnnotation = {
        target: { selector: { type: 'html_tag', tag: 'cit', id: 'e1' } },
        body: {
          source: {
            type: 'attachment',
            attachment: {
              type: 'application/pdf',
              url: 'files/bucket/original.pdf',
            },
          },
        },
      };
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: {
          ...TEST_CONVERSATION,
          customViewState: { annotations: [existingAnnotation] },
        },
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(
          textToStream([
            htmlTagAnnotationChunk('e1', 'files/bucket/new.pdf'),
            doneChunk,
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello again',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      const finalSave = saveConversationSpy.mock.calls[1][2].body as {
        customViewState?: {
          annotations: { body: { source: { attachment: { url: string } } } }[];
        };
      };
      expect(finalSave.customViewState?.annotations).toHaveLength(1);
      expect(
        finalSave.customViewState?.annotations[0].body.source.attachment.url,
      ).toBe('files/bucket/original.pdf');
    });

    it('preserves an unrelated customViewState key while adding a new pooled entry', async () => {
      const existingAnnotation = {
        target: { selector: { type: 'html_tag', tag: 'cit', id: 'e1' } },
        body: {
          source: {
            type: 'attachment',
            attachment: { type: 'application/pdf', url: 'files/bucket/e1.pdf' },
          },
        },
      };
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: {
          ...TEST_CONVERSATION,
          customViewState: {
            annotations: [existingAnnotation],
            layout: 'wide',
          },
        },
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(
          textToStream([htmlTagAnnotationChunk('e2'), doneChunk]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      const finalSave = saveConversationSpy.mock.calls[1][2].body as {
        customViewState?: {
          annotations: { target: { selector: { id: string } } }[];
          layout?: string;
        };
      };
      expect(finalSave.customViewState?.layout).toBe('wide');
      expect(
        finalSave.customViewState?.annotations.map((a) => a.target.selector.id),
      ).toEqual(['e1', 'e2']);
    });

    it('still contributes a citation from a stopped generation', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const generationAbortController = new AbortController();
      const lease = makeLease(generationAbortController);
      vi.mocked(mockGenerationService.register).mockReturnValue(lease);
      vi.mocked(mockGenerationService.getCancellation).mockReturnValue({
        requested: true,
        reason: GenerationCancelReason.UserStop,
      });

      const cancel = vi.fn();
      const encoder = new TextEncoder();
      const pendingStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(htmlTagAnnotationChunk('e9')));
        },
        cancel,
      });
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(pendingStream, { status: 200 }),
      } as never);

      const res = makeMockRes();
      const streamPromise = runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Use a tool',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );
      await vi.waitFor(() => expect(res.write).toHaveBeenCalled());

      generationAbortController.abort();
      await streamPromise;

      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const stoppedSave = saveConversationSpy.mock.calls[1][2].body as {
        messages: { wasStoppedByUser?: boolean }[];
        customViewState?: {
          annotations: { target: { selector: { id: string } } }[];
        };
      };
      expect(stoppedSave.messages.at(-1)?.wasStoppedByUser).toBe(true);
      expect(
        stoppedSave.customViewState?.annotations.map(
          (a) => a.target.selector.id,
        ),
      ).toEqual(['e9']);
    });

    it('still saves the messages and logs a warning when the merge throws', async () => {
      vi.mocked(mergeHtmlTagAnnotationsIntoViewState).mockImplementationOnce(
        () => {
          throw new Error('merge exploded');
        },
      );
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(
          textToStream([htmlTagAnnotationChunk('e1'), doneChunk]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const finalSave = saveConversationSpy.mock.calls[1][2].body as {
        messages: { content?: string }[];
        customViewState?: unknown;
      };
      expect(finalSave.messages.at(-1)?.content).toBe('cited');
      expect(finalSave.customViewState).toBeUndefined();
    });
  });

  /*
   * Cross-layer coverage against the real `ConversationGenerationService`
   * rather than the mock — the only way to show that a stale cancellation
   * mid-write, and a never-settling terminal write, behave per
   * `generation-registry` end-to-end through `streamCompletion`.
   */
  describe('streamCompletion — cross-layer races against the real registry', () => {
    let realGenerationService: ConversationGenerationService;

    beforeEach(() => {
      realGenerationService = new ConversationGenerationService({
        get: (key: string) =>
          key === 'GENERATION_FINALIZE_TIMEOUT_MS' ? 5000 : undefined,
      } as never);
      service = new ConversationStreamingService(
        mockDialClient,
        realGenerationService,
        persistenceService,
        mockDeploymentsService,
        new ResponsesAdapter(mockDialClient),
        mockFeatureFlagsService,
      );
    });

    afterEach(() => {
      realGenerationService.onModuleDestroy();
    });

    it('a stale-cancelled worker still performs its own terminal save and releases the entry, never orphaning it', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(
          textToStream([
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: [DONE]\n\n',
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      } as never);

      const res = makeMockRes();
      await runStreamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        res as never,
      );

      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      /* The key is released — a later request for the same owner+path is admitted. */
      expect(() =>
        realGenerationService.register(
          'test-session-id',
          'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
          'another-gen-id',
        ),
      ).not.toThrow();
    });

    it('releases subscribers while retaining ownership when the terminal write never settles', async () => {
      vi.spyOn(mockDialClient.client, 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      vi.spyOn(mockDialClient.client, 'saveConversation')
        .mockResolvedValueOnce({ data: {} } as never) // start-state write
        .mockImplementationOnce(() => new Promise(() => undefined)); // terminal write never settles
      vi.spyOn(
        mockDialClient.client,
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(
          textToStream([
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: [DONE]\n\n',
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      } as never);

      const res = makeMockRes();
      vi.useFakeTimers();
      try {
        /*
         * Deliberately not awaited: the terminal write never settles, so
         * `streamCompletion`'s own generator never returns either — this
         * test asserts the registry's bounded release, not that the bound
         * makes the generator finish.
         */
        void runStreamCompletion(
          'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
          'test-token',
          'test-bucket',
          'test-gen-id',
          CompletionMode.Append,
          'Hello',
          undefined,
          'gpt-4o',
          undefined,
          'test-session-id',
          res as never,
        );
        await vi.waitFor(() => expect(res.write).toHaveBeenCalled(), {
          timeout: 1000,
        });
        await vi.advanceTimersByTimeAsync(5000);
      } finally {
        vi.useRealTimers();
      }

      /*
       * Ownership is retained (not this test's claim that the bound
       * cancelled the remote write — it never resolves): a later request for
       * the same owner+path is still rejected.
       */
      expect(() =>
        realGenerationService.register(
          'test-session-id',
          'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
          'another-gen-id',
        ),
      ).toThrow();
    });
  });
});
