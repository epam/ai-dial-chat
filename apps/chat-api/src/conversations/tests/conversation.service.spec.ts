import { MessageRole, StatusEvent } from '@epam/ai-dial-chat-shared';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleDialError } from '../../common/utils/dial-error';
import { ConversationService } from '../conversation.service';

vi.mock('../../common/utils/dial-error', () => ({
  handleDialError: vi.fn(),
}));

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
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

const readStreamText = async (
  stream: ReadableStream<Uint8Array>,
): Promise<string> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        return text;
      }

      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
};

describe('ConversationService', () => {
  let service: ConversationService;
  let mockConfigService: Partial<ConfigService>;
  let mockUserConfigService: {
    getPinnedIds: ReturnType<typeof vi.fn>;
    updatePin: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'DIAL_CORE_URL') return 'http://localhost:3000';
        if (key === 'DIAL_API_KEY') return 'test-api-key';
        return undefined;
      }),
    };
    mockUserConfigService = {
      getPinnedIds: vi.fn().mockResolvedValue([]),
      updatePin: vi.fn().mockResolvedValue(undefined),
    };
    service = new ConversationService(
      mockConfigService as ConfigService,
      mockUserConfigService as never,
    );
    vi.mocked(handleDialError).mockReset();
    vi.spyOn(service['client'], 'saveConversation').mockResolvedValue({
      data: {},
    } as never);
    // Default: empty bucket so fetchAllUserTitles returns an empty set.
    // Individual createConversation tests override this when needed.
    vi.spyOn(service['client'], 'getConversationMetadata').mockResolvedValue({
      data: { items: [] },
    } as never);
  });

  describe('createConversation', () => {
    it('saves the conversation using the expected Core resource name', async () => {
      const saveConversationSpy = vi.spyOn(
        service['client'],
        'saveConversation',
      );

      await service.createConversation(
        'What do you want to do?',
        'test-token',
        'test-bucket',
        'form-example',
      );

      expect(saveConversationSpy).toHaveBeenCalledWith(
        'test-bucket',
        'form-example__What%20do%20you%20want%20to%20do%3F',
        expect.any(Object),
      );
    });

    it('uses a non-empty fallback name for conversations without message text', async () => {
      const result = await service.createConversation(
        '',
        'test-token',
        'test-bucket',
        'form-example',
        { form_value: { answer: 'yes' } },
      );

      expect(result.name).toBe('New chat');
      expect(result.id).toBe('test-bucket/form-example__New chat');
    });

    it('returns a conversation with a UUID-format id', async () => {
      const result = await service.createConversation(
        'Hello',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(result.id).toMatch(/.*__.*/); // id format: folderId/path
    });

    it('returns a conversation with one user message containing the firstMessage content', async () => {
      const result = await service.createConversation(
        'Hello world',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello world');
    });

    it('gives the message a UUID-format id', async () => {
      const result = await service.createConversation(
        'Hello',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(result.messages[0].id).toMatch(UUID_REGEX);
    });

    it('gives the message an ISO-8601 timestamp', async () => {
      const result = await service.createConversation(
        'Hello',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(result.messages[0].timestamp).toMatch(ISO_REGEX);
    });

    it('generates a unique id for each conversation', async () => {
      const a = await service.createConversation(
        'First',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      const b = await service.createConversation(
        'Second',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(a.id).not.toBe(b.id);
    });

    it('uses deploymentId for model.id and assistantModelId', async () => {
      const result = await service.createConversation(
        'Hello',
        'test-token',
        'test-bucket',
        'my-catalog-item',
      );
      expect(result.model.id).toBe('my-catalog-item');
      expect(result.assistantModelId).toBe('my-catalog-item');
    });

    it('uses the base name when no conversation with that title exists', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockResolvedValue({
        data: { items: [] },
      } as never);

      const result = await service.createConversation(
        'What is AI?',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );

      expect(result.name).toBe('What is AI?');
    });

    it('appends _1 when a conversation with the same title already exists', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockResolvedValue({
        data: {
          items: [
            { name: 'gpt-4o__What is AI?__existing-uuid', nodeType: 'FILE' },
          ],
        },
      } as never);

      const result = await service.createConversation(
        'What is AI?',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );

      expect(result.name).toBe('What is AI? 1');
    });

    it('appends _2 when both the base name and _1 variant already exist', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockResolvedValue({
        data: {
          items: [
            { name: 'gpt-4o__What is AI?__uuid1', nodeType: 'FILE' },
            { name: 'gpt-4o__What is AI? 1__uuid2', nodeType: 'FILE' },
          ],
        },
      } as never);

      const result = await service.createConversation(
        'What is AI?',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );

      expect(result.name).toBe('What is AI? 2');
    });

    it('uses base name when fetching existing titles fails', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockRejectedValue(
        new Error('DIAL Core unreachable'),
      );

      const result = await service.createConversation(
        'What is AI?',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );

      expect(result.name).toBe('What is AI?');
    });

    it('passes each nextToken to the following metadata request', async () => {
      const getMetadataSpy = vi
        .spyOn(service['client'], 'getConversationMetadata')
        .mockImplementation((_bucket, _path, init) => {
          const token = init?.params?.query?.token;
          if (token === 'page-2') {
            return Promise.resolve({
              data: {
                items: [
                  {
                    name: 'gpt-4o__What is AI? 1',
                    nodeType: 'FILE',
                  },
                ],
              },
            } as never);
          }

          return Promise.resolve({
            data: {
              items: [
                {
                  name: 'gpt-4o__What is AI?',
                  nodeType: 'FILE',
                },
              ],
              nextToken: 'page-2',
            },
          } as never);
        });

      const result = await service.createConversation(
        'What is AI?',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );

      expect(getMetadataSpy).toHaveBeenNthCalledWith(
        2,
        'test-bucket',
        '',
        expect.objectContaining({
          params: {
            query: expect.objectContaining({ token: 'page-2' }),
          },
        }),
      );
      expect(result.name).toBe('What is AI? 2');
    });
  });

  describe('getConversation', () => {
    it('uses session bucket and encodes reserved URL characters for a flat path', async () => {
      const spy = vi
        .spyOn(service['client'], 'getConversation')
        .mockResolvedValue({ data: TEST_CONVERSATION } as never);

      await service.getConversation(
        'statgpt-sample__What datasets are available?__uuid',
        'test-token',
        'test-bucket',
      );

      expect(spy).toHaveBeenCalledWith(
        'test-bucket',
        'statgpt-sample__What%20datasets%20are%20available%3F__uuid',
        expect.any(Object),
      );
    });

    it('extracts bucket from the first path segment when a slash is present', async () => {
      const spy = vi
        .spyOn(service['client'], 'getConversation')
        .mockResolvedValue({ data: TEST_CONVERSATION } as never);

      await service.getConversation(
        'public/gpt-4o__My chat__uuid',
        'test-token',
        'test-bucket',
      );

      expect(spy).toHaveBeenCalledWith(
        'public',
        'gpt-4o__My%20chat__uuid',
        expect.any(Object),
      );
    });

    it('uses session bucket for a path with no slash', async () => {
      const spy = vi
        .spyOn(service['client'], 'getConversation')
        .mockResolvedValue({ data: TEST_CONVERSATION } as never);

      await service.getConversation(
        'gpt-4o__My chat__uuid',
        'test-token',
        'test-bucket',
      );

      expect(spy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__My%20chat__uuid',
        expect.any(Object),
      );
    });
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

    it('excludes MessageRole.Status messages from the DIAL Core payload', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: MessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 's1',
            role: MessageRole.Status,
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
            role: MessageRole.Assistant,
            content: 'Hi there',
            timestamp: '2024-01-01T00:00:02.000Z',
          },
        ],
      };

      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: conversation,
      } as never);

      const mockStream = new ReadableStream();
      const sendSpy = vi
        .spyOn(service['client'], 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: { ok: true, body: mockStream } as Response,
        } as never);

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'Next message',
        'gpt-4o',
      );

      const sentMessages: { role: string }[] =
        sendSpy.mock.calls[0][1].body.messages;
      expect(sentMessages.some((m) => m.role === MessageRole.Status)).toBe(
        false,
      );
      expect(sentMessages.some((m) => m.role === MessageRole.User)).toBe(true);
      expect(sentMessages.some((m) => m.role === MessageRole.Assistant)).toBe(
        true,
      );
    });

    it('includes all non-status messages in the DIAL Core payload', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: MessageRole.User,
            content: 'First',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 's1',
            role: MessageRole.Status,
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
            role: MessageRole.Assistant,
            content: 'Response',
            timestamp: '2024-01-01T00:00:02.000Z',
          },
        ],
      };

      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: conversation,
      } as never);

      const mockStream = new ReadableStream();
      const sendSpy = vi
        .spyOn(service['client'], 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: { ok: true, body: mockStream } as Response,
        } as never);

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'Follow-up',
        'gpt-4o',
      );

      const sentMessages: { role: string; content: string }[] =
        sendSpy.mock.calls[0][1].body.messages;
      expect(sentMessages).toHaveLength(3); // user + assistant + new user
      expect(sentMessages[0]).toMatchObject({
        role: MessageRole.User,
        content: 'First',
      });
      expect(sentMessages[1]).toMatchObject({
        role: MessageRole.Assistant,
        content: 'Response',
      });
      expect(sentMessages[2]).toMatchObject({
        role: MessageRole.User,
        content: 'Follow-up',
      });
    });

    it('sends current starter configuration only as top-level custom_fields', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: MessageRole.User,
            content: 'Pick a number',
            timestamp: '2024-01-01T00:00:00.000Z',
            custom_content: {
              configuration_value: { button: 1 },
            },
          },
        ],
      };

      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: conversation,
      } as never);

      const mockStream = new ReadableStream();
      const sendSpy = vi
        .spyOn(service['client'], 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: { ok: true, body: mockStream } as Response,
        } as never);

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        '',
        'form-example',
        { configuration_value: { button: 1 } },
      );

      expect(sendSpy.mock.calls[0][1].body).toMatchObject({
        messages: [
          {
            role: MessageRole.User,
            content: '',
          },
        ],
        stream: true,
        custom_fields: {
          configuration: { button: 1 },
        },
      });
      expect(
        sendSpy.mock.calls[0][1].body.messages[0].custom_content,
      ).toBeUndefined();
    });

    it('moves persisted form configuration to custom_fields and submits form_value messages', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: MessageRole.User,
            content: 'Pick a number',
            timestamp: '2024-01-01T00:00:00.000Z',
            custom_content: {
              configuration_value: { button: 1 },
            },
          },
          {
            id: 'a1',
            role: MessageRole.Assistant,
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
            role: MessageRole.Status,
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

      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: conversation,
      } as never);

      const mockStream = new ReadableStream();
      const sendSpy = vi
        .spyOn(service['client'], 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: { ok: true, body: mockStream } as Response,
        } as never);

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        '',
        'form-example',
        { form_value: { button: 2 } },
      );

      expect(sendSpy.mock.calls[0][1].body.messages).toEqual([
        {
          role: MessageRole.User,
          content: '',
        },
        {
          role: MessageRole.Assistant,
          content: 'Pick a number',
          custom_content: {
            form_schema: {
              type: 'object',
              properties: { button: { type: 'number' } },
            },
          },
        },
        {
          role: MessageRole.User,
          content: '',
          custom_content: {
            form_value: { button: 2 },
          },
        },
      ]);
      expect(sendSpy.mock.calls[0][1].body.custom_fields).toEqual({
        configuration: { button: 1 },
      });
    });

    it('logs and delegates to handleDialError when completion stream is rejected', async () => {
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      vi.mocked(handleDialError).mockImplementation(() => {
        throw new Error('mapped DIAL error');
      });
      const logError = vi
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);
      vi.spyOn(
        service['client'],
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(null, {
          status: 400,
          statusText: 'Bad Request',
        }),
      } as never);

      await expect(
        service.streamCompletion(
          'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
          'test-token',
          'test-bucket',
          'Hello',
          'gpt-4o',
        ),
      ).rejects.toThrow('mapped DIAL error');

      expect(logError).toHaveBeenCalled();
      expect(handleDialError).toHaveBeenCalledWith({ status: 400 });
    });

    it('passes the stream through when completion succeeds', async () => {
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const firstChunk =
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
      const secondChunk = 'data: [DONE]\n\n';
      const sendCompletionSpy = vi.spyOn(
        service['client'],
        'sendChatCompletionRequest',
      );
      sendCompletionSpy.mockResolvedValue({
        response: new Response(textToStream([firstChunk, secondChunk]), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      } as never);

      const stream = await service.streamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'Hello',
        'gpt-4o',
      );

      await expect(readStreamText(stream)).resolves.toBe(
        `${firstChunk}${secondChunk}`,
      );
      expect(sendCompletionSpy).toHaveBeenCalledWith(
        'gpt-4o',
        expect.objectContaining({
          params: { query: { 'api-version': '2024-10-21' } },
        }),
      );
      expect(handleDialError).not.toHaveBeenCalled();
    });
  });

  describe('listConversations', () => {
    type MetadataItem = { url: string; nodeType: string; updatedAt?: number };

    const mockMetadata = (
      userItems: MetadataItem[],
      publicItems: MetadataItem[] = [],
    ) => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockImplementation(
        (bucket: string) => {
          if (bucket === 'test-bucket') {
            return Promise.resolve({ data: { items: userItems } }) as never;
          }
          return Promise.resolve({ data: { items: publicItems } }) as never;
        },
      );
      vi.spyOn(service['client'], 'getSharedResources').mockResolvedValue({
        data: { resources: [] },
      } as never);
    };

    it('passes pagination through SDK params.query', async () => {
      const getMetadataSpy = vi
        .spyOn(service['client'], 'getConversationMetadata')
        .mockResolvedValue({ data: { items: [] } } as never);
      vi.spyOn(service['client'], 'getSharedResources').mockResolvedValue({
        data: { resources: [] },
      } as never);

      await service.listConversations(
        'test-token',
        'test-bucket',
        50,
        'user-cursor',
      );

      expect(getMetadataSpy).toHaveBeenCalledWith(
        'test-bucket',
        '',
        expect.objectContaining({
          params: {
            query: {
              recursive: true,
              limit: 50,
              token: 'user-cursor',
            },
          },
        }),
      );
    });

    it('sets isPinned: true on items whose id is in the pins list', async () => {
      mockMetadata([
        { url: 'conversations/bucket/conv-1', nodeType: 'FILE' },
        { url: 'conversations/bucket/conv-2', nodeType: 'FILE' },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([
        'conversations/bucket/conv-1',
      ]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'conversations/bucket/conv-1',
            isPinned: true,
          }),
          expect.objectContaining({
            id: 'conversations/bucket/conv-2',
            isPinned: false,
          }),
        ]),
      );
    });

    it('sets isPinned: false on items not in the pins list', async () => {
      mockMetadata([
        { url: 'conversations/bucket/conv-3', nodeType: 'FILE' },
        { url: 'conversations/bucket/conv-4', nodeType: 'FILE' },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([
        'conversations/bucket/conv-5',
      ]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items.every((item) => item.isPinned === false)).toBe(true);
    });

    it('sets isPinned: false on all items when getPinnedIds returns empty', async () => {
      mockMetadata([
        { url: 'conversations/bucket/conv-a', nodeType: 'FILE' },
        { url: 'conversations/bucket/conv-b', nodeType: 'FILE' },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items.every((item) => item.isPinned === false)).toBe(true);
    });

    it('merges items from user and public buckets', async () => {
      mockMetadata(
        [
          {
            url: 'conversations/test-bucket/user-conv',
            nodeType: 'FILE',
            updatedAt: 2000,
          },
        ],
        [
          {
            url: 'conversations/public/pub-conv',
            nodeType: 'FILE',
            updatedAt: 1000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(2);
      expect(result.items.map((i) => i.id)).toContain(
        'conversations/test-bucket/user-conv',
      );
      expect(result.items.map((i) => i.id)).toContain(
        'conversations/public/pub-conv',
      );
    });

    it('sets publishedWithMe: true on all items from the public bucket', async () => {
      mockMetadata(
        [
          {
            url: 'conversations/test-bucket/user-conv',
            nodeType: 'FILE',
            updatedAt: 2000,
          },
        ],
        [
          {
            url: 'conversations/public/pub-conv',
            nodeType: 'FILE',
            updatedAt: 1000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      const userItem = result.items.find(
        (i) => i.id === 'conversations/test-bucket/user-conv',
      );
      const pubItem = result.items.find(
        (i) => i.id === 'conversations/public/pub-conv',
      );
      expect(userItem?.publishedWithMe).toBe(false);
      expect(pubItem?.publishedWithMe).toBe(true);
    });

    it('merges items from getSharedResources and sets sharedWithMe: true', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/user-conv',
          nodeType: 'FILE',
          updatedAt: 3000,
        },
      ]);
      vi.spyOn(service['client'], 'getSharedResources').mockResolvedValue({
        data: {
          resources: [
            { url: 'conversations/other-bucket/shared-conv', nodeType: 'FILE' },
          ],
        },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(2);
      const sharedItem = result.items.find(
        (i) => i.id === 'conversations/other-bucket/shared-conv',
      );
      expect(sharedItem?.sharedWithMe).toBe(true);
      expect(sharedItem?.publishedWithMe).toBe(false);
    });

    it('calls getSharedResources with resourceTypes CONVERSATION and with me', async () => {
      mockMetadata([]);
      const spy = vi
        .spyOn(service['client'], 'getSharedResources')
        .mockResolvedValue({
          data: { resources: [] },
        } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      await service.listConversations('test-token', 'test-bucket');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { resourceTypes: ['CONVERSATION'], with: 'me' },
        }),
      );
    });

    it('returns user and public items when getSharedResources fails', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockImplementation(
        (bucket: string) => {
          if (bucket === 'test-bucket') {
            return Promise.resolve({
              data: {
                items: [
                  {
                    url: 'conversations/test-bucket/user-conv',
                    nodeType: 'FILE',
                  },
                ],
              },
            }) as never;
          }
          return Promise.resolve({
            data: {
              items: [
                { url: 'conversations/public/pub-conv', nodeType: 'FILE' },
              ],
            },
          }) as never;
        },
      );
      vi.spyOn(service['client'], 'getSharedResources').mockRejectedValue(
        new Error('share service unreachable'),
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(2);
      expect(result.items.map((i) => i.id)).toContain(
        'conversations/test-bucket/user-conv',
      );
      expect(result.items.map((i) => i.id)).toContain(
        'conversations/public/pub-conv',
      );
    });

    it('sorts merged items by updatedAt descending', async () => {
      mockMetadata(
        [
          {
            url: 'conversations/test-bucket/older',
            nodeType: 'FILE',
            updatedAt: 1000,
          },
        ],
        [
          {
            url: 'conversations/public/newer',
            nodeType: 'FILE',
            updatedAt: 3000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].id).toBe('conversations/public/newer');
      expect(result.items[1].id).toBe('conversations/test-bucket/older');
    });

    it('returns only user items when public bucket request fails', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockImplementation(
        (bucket: string) => {
          if (bucket === 'test-bucket') {
            return Promise.resolve({
              data: {
                items: [
                  {
                    url: 'conversations/test-bucket/user-conv',
                    nodeType: 'FILE',
                  },
                ],
              },
            }) as never;
          }
          return Promise.reject(new Error('public bucket unreachable'));
        },
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('conversations/test-bucket/user-conv');
    });

    it('encodes a compound nextToken when both user and public buckets have more results', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockImplementation(
        (bucket: string) => {
          if (bucket === 'test-bucket') {
            return Promise.resolve({
              data: { items: [], nextToken: 'user-cursor' },
            }) as never;
          }
          return Promise.resolve({
            data: { items: [], nextToken: 'pub-cursor' },
          }) as never;
        },
      );
      vi.spyOn(service['client'], 'getSharedResources').mockResolvedValue({
        data: { resources: [] },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.nextToken).toBeDefined();
      const decoded = JSON.parse(
        Buffer.from(
          result.nextToken!.slice('ct1.'.length),
          'base64url',
        ).toString('utf-8'),
      ) as { u?: string; p?: string };
      expect(decoded.u).toBe('user-cursor');
      expect(decoded.p).toBe('pub-cursor');
    });

    it('passes decoded user and public cursors as separate token params', async () => {
      const spy = vi
        .spyOn(service['client'], 'getConversationMetadata')
        .mockImplementation(
          () => Promise.resolve({ data: { items: [] } }) as never,
        );
      vi.spyOn(service['client'], 'getSharedResources').mockResolvedValue({
        data: { resources: [] },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const compoundToken =
        'ct1.' +
        Buffer.from(
          JSON.stringify({ u: 'user-cursor', p: 'pub-cursor' }),
        ).toString('base64url');

      await service.listConversations(
        'test-token',
        'test-bucket',
        20,
        compoundToken,
      );

      const userCall = spy.mock.calls.find(
        ([bucket]) => bucket === 'test-bucket',
      );
      const publicCall = spy.mock.calls.find(([bucket]) => bucket === 'public');

      expect(
        (userCall?.[2] as { params?: { query?: { token?: string } } })?.params
          ?.query?.token,
      ).toBe('user-cursor');
      expect(
        (publicCall?.[2] as { params?: { query?: { token?: string } } })?.params
          ?.query?.token,
      ).toBe('pub-cursor');
    });

    it('treats a legacy (non-compound) nextToken as a user-bucket cursor', async () => {
      const spy = vi
        .spyOn(service['client'], 'getConversationMetadata')
        .mockImplementation(
          () => Promise.resolve({ data: { items: [] } }) as never,
        );
      vi.spyOn(service['client'], 'getSharedResources').mockResolvedValue({
        data: { resources: [] },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      await service.listConversations(
        'test-token',
        'test-bucket',
        20,
        'legacy-opaque-token',
      );

      const userCall = spy.mock.calls.find(
        ([bucket]) => bucket === 'test-bucket',
      );
      const publicCall = spy.mock.calls.find(([bucket]) => bucket === 'public');

      expect(
        (userCall?.[2] as { params?: { query?: { token?: string } } })?.params
          ?.query?.token,
      ).toBe('legacy-opaque-token');
      expect(
        (publicCall?.[2] as { params?: { query?: { token?: string } } })?.params
          ?.query?.token,
      ).toBeUndefined();
    });

    it('returns undefined nextToken when neither bucket has a cursor', async () => {
      mockMetadata([]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.nextToken).toBeUndefined();
    });

    it('encodes a compound nextToken with only u when only user bucket has a cursor', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockImplementation(
        (bucket: string) => {
          if (bucket === 'test-bucket') {
            return Promise.resolve({
              data: { items: [], nextToken: 'user-cursor' },
            }) as never;
          }
          return Promise.resolve({ data: { items: [] } }) as never;
        },
      );
      vi.spyOn(service['client'], 'getSharedResources').mockResolvedValue({
        data: { resources: [] },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.nextToken).toBeDefined();
      const decoded = JSON.parse(
        Buffer.from(
          result.nextToken!.slice('ct1.'.length),
          'base64url',
        ).toString('utf-8'),
      ) as { u?: string; p?: string };
      expect(decoded.u).toBe('user-cursor');
      expect(decoded.p).toBeUndefined();
    });

    it('forwards the path to user and public bucket calls', async () => {
      const spy = vi
        .spyOn(service['client'], 'getConversationMetadata')
        .mockImplementation(
          () => Promise.resolve({ data: { items: [] } }) as never,
        );
      vi.spyOn(service['client'], 'getSharedResources').mockResolvedValue({
        data: { resources: [] },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      await service.listConversations(
        'test-token',
        'test-bucket',
        20,
        undefined,
        'work/project-x',
      );

      const userCall = spy.mock.calls.find(
        ([bucket]) => bucket === 'test-bucket',
      );
      const publicCall = spy.mock.calls.find(([bucket]) => bucket === 'public');

      expect(userCall?.[1]).toBe('work/project-x');
      expect(publicCall?.[1]).toBe('work/project-x');
    });

    it('filters out FOLDER node types from both buckets', async () => {
      mockMetadata(
        [
          { url: 'conversations/test-bucket/folder', nodeType: 'FOLDER' },
          { url: 'conversations/test-bucket/file', nodeType: 'FILE' },
        ],
        [
          { url: 'conversations/public/pub-folder', nodeType: 'FOLDER' },
          { url: 'conversations/public/pub-file', nodeType: 'FILE' },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items.map((i) => i.id)).toEqual(
        expect.not.arrayContaining([
          'conversations/test-bucket/folder',
          'conversations/public/pub-folder',
        ]),
      );
      expect(result.items.map((i) => i.id)).toEqual(
        expect.arrayContaining([
          'conversations/test-bucket/file',
          'conversations/public/pub-file',
        ]),
      );
    });

    it('preserves sharedWithMe from user bucket items', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockImplementation(
        (bucket: string) => {
          if (bucket === 'test-bucket') {
            return Promise.resolve({
              data: {
                items: [
                  {
                    url: 'conversations/test-bucket/shared',
                    nodeType: 'FILE',
                    sharedWithMe: true,
                  },
                ],
              },
            }) as never;
          }
          return Promise.resolve({ data: { items: [] } }) as never;
        },
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].sharedWithMe).toBe(true);
    });

    it('calls handleDialError when the user bucket returns a response-level error', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockImplementation(
        (bucket: string) => {
          if (bucket === 'test-bucket') {
            return Promise.resolve({ error: { status: 502 } }) as never;
          }
          return Promise.resolve({ data: { items: [] } }) as never;
        },
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);
      vi.mocked(handleDialError).mockImplementation(() => {
        throw new Error('mapped DIAL error');
      });

      await expect(
        service.listConversations('test-token', 'test-bucket'),
      ).rejects.toThrow('mapped DIAL error');

      expect(handleDialError).toHaveBeenCalledWith({ status: 502 });
    });

    it('returns only user items when public bucket returns a response-level error', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockImplementation(
        (bucket: string) => {
          if (bucket === 'test-bucket') {
            return Promise.resolve({
              data: {
                items: [
                  {
                    url: 'conversations/test-bucket/user-conv',
                    nodeType: 'FILE',
                  },
                ],
              },
            }) as never;
          }
          return Promise.resolve({ error: { status: 403 } }) as never;
        },
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('conversations/test-bucket/user-conv');
    });
  });
});
