import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { DeploymentsService } from '../../../deployments/deployments.service';
import type { DialClientService } from '../../../dial/dial-client.service';
import {
  ConversationGenerationService,
  GenerationStatus,
} from '../../conversation-generation.service';
import {
  ConversationMessageRole,
  StatusEvent,
} from '../../dto/conversation-message.dto';
import { CompletionMode } from '../../dto/send-completion.dto';
import { ResponsesAdapter } from '../../generation/responses.adapter';
import { ConversationPersistenceService } from '../../persistence/conversation-persistence.service';
import { ConversationStreamingService } from '../conversation-streaming.service';

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
      register: vi.fn().mockReturnValue(new AbortController()),
      abort: vi.fn().mockReturnValue(true),
      complete: vi.fn(),
      error: vi.fn(),
      getStatus: vi.fn().mockReturnValue(GenerationStatus.Active),
    } as unknown as ConversationGenerationService;
    mockDeploymentsService = {
      getDeploymentDetails: vi.fn().mockResolvedValue({
        id: 'gpt-4o',
        type: 'model',
        modelDetails: { features: { chatCompletion: true } },
      }),
    } as unknown as DeploymentsService;
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
    );
    vi.spyOn(
      service['dialClient'].client,
      'saveConversation',
    ).mockResolvedValue({
      data: {},
    } as never);
    vi.spyOn(service['dialClient'].client, 'getConversation').mockRejectedValue(
      {
        error: { status: 404 },
      } as never,
    );
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
    ) => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
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
        .spyOn(service['dialClient'].client, 'sendChatCompletionRequest')
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

    it('uses Responses API when the server-resolved deployment supports it', async () => {
      vi.mocked(mockDeploymentsService.getDeploymentDetails).mockResolvedValue({
        id: 'gpt-4o',
        type: 'model',
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
      );

      expect(createResponseSpy).toHaveBeenCalledOnce();
      expect(createResponseSpy.mock.calls[0][0].body).toMatchObject({
        model: 'gpt-4o',
        stream: true,
        store: false,
        temperature: 1,
      });
      expect(sendSpy).not.toHaveBeenCalled();
      expect(res.getWritten()).toContain('Hello');
      expect(res.getWritten()).toContain('data: [DONE]');
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
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      vi.spyOn(
        service['dialClient'].client,
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
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
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
        service['dialClient'].client,
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

    it('writes SSE chunks to res and saves conversation on completion', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const firstChunk =
        'data: {"id":"resp-1","choices":[{"delta":{"content":"Hello"}}]}\n\n';
      const doneChunk = 'data: [DONE]\n\n';
      vi.spyOn(
        service['dialClient'].client,
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
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      ).mockResolvedValue({
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
        service['dialClient'].client,
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
      expect(mockGenerationService.complete).toHaveBeenCalledWith(
        'test-session-id',
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-gen-id',
      );
      expect(mockGenerationService.error).not.toHaveBeenCalled();
    });
  });
});
