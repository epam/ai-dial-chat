import { ConfigService } from '@nestjs/config';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleDialError } from '../../common/utils/dial-error';
import type { EnvironmentVariables } from '../../config/environment.config';
import { ConversationGenerationService } from '../conversation-generation.service';
import { ConversationService } from '../conversation.service';
import {
  ConversationMessageRole,
  StatusEvent,
} from '../dto/conversation-message.dto';
import { CompletionMode } from '../dto/send-completion.dto';

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

const defaultStreamArgs = (
  overrides?: Partial<{
    generationId: string;
    mode: CompletionMode;
    messageIndex: number | undefined;
    sessionId: string;
  }>,
) => ({
  generationId: overrides?.generationId ?? 'test-gen-id',
  mode: overrides?.mode ?? CompletionMode.Append,
  messageIndex: overrides?.messageIndex,
  sessionId: overrides?.sessionId ?? 'test-session-id',
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
    migratePin: ReturnType<typeof vi.fn>;
  };
  let mockGenerationService: ConversationGenerationService;

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
      migratePin: vi.fn().mockResolvedValue(undefined),
    };
    mockGenerationService = {
      register: vi.fn().mockReturnValue(new AbortController()),
      abort: vi.fn().mockReturnValue(true),
      complete: vi.fn(),
      error: vi.fn(),
      getStatus: vi.fn().mockReturnValue('active'),
    } as unknown as ConversationGenerationService;
    service = new ConversationService(
      mockConfigService as unknown as ConfigService<EnvironmentVariables>,
      mockUserConfigService as never,
      mockGenerationService,
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

    it('does not double-encode percent-encoded deployment ID segments', async () => {
      const saveConversationSpy = vi.spyOn(
        service['client'],
        'saveConversation',
      );
      const deploymentId = 'applications/catalog/Team%2FApp%20One__0.0.1';

      const result = await service.createConversation(
        'Hello',
        'test-token',
        'test-bucket',
        deploymentId,
      );

      expect(saveConversationSpy).toHaveBeenCalledWith(
        'test-bucket',
        'applications/catalog/Team%2FApp%20One__0.0.1__Hello',
        expect.any(Object),
      );
      expect(result.model.id).toBe(deploymentId);
      expect(result.assistantModelId).toBe(deploymentId);
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

    it('keeps nested application deployment segments in the conversation path', async () => {
      const spy = vi
        .spyOn(service['client'], 'getConversation')
        .mockResolvedValue({ data: TEST_CONVERSATION } as never);

      await service.getConversation(
        'test-bucket/applications/catalog/Untitled app 1__0.0.1__hello',
        'test-token',
        'test-bucket',
      );

      expect(spy).toHaveBeenCalledWith(
        'test-bucket',
        'applications/catalog/Untitled%20app%201__0.0.1__hello',
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

    it('keeps encoded separators inside a resource path segment', async () => {
      const spy = vi
        .spyOn(service['client'], 'getConversation')
        .mockResolvedValue({ data: TEST_CONVERSATION } as never);

      await service.getConversation(
        'test-bucket/applications/catalog/Team%2FApp%20One__0.0.1__hello',
        'test-token',
        'test-bucket',
      );

      expect(spy).toHaveBeenCalledWith(
        'test-bucket',
        'applications/catalog/Team%2FApp%20One__0.0.1__hello',
        expect.any(Object),
      );
    });
  });

  describe('encoded conversation resource paths', () => {
    const conversationPath =
      'applications/catalog/Team%2FApp%20One__0.0.1__hello';

    it('does not double-encode delete paths', async () => {
      const deleteSpy = vi
        .spyOn(service['client'], 'deleteConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.deleteConversation(
        conversationPath,
        'test-token',
        'test-bucket',
      );

      expect(deleteSpy).toHaveBeenCalledWith(
        'test-bucket',
        conversationPath,
        expect.any(Object),
      );
    });

    it('preserves nested deployment paths when renaming', async () => {
      const moveSpy = vi
        .spyOn(service['client'], 'moveResource')
        .mockResolvedValue({ data: {} } as never);

      const result = await service.renameConversation(
        conversationPath,
        'renamed',
        'test-token',
        'test-bucket',
      );

      expect(moveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            sourceUrl: `conversations/test-bucket/${conversationPath}`,
            destinationUrl:
              'conversations/test-bucket/applications/catalog/Team%2FApp%20One__0.0.1__renamed',
            overwrite: false,
          },
        }),
      );
      expect(result.newPath).toBe(
        'conversations/test-bucket/applications/catalog/Team%2FApp%20One__0.0.1__renamed',
      );
    });

    it('preserves nested deployment paths when duplicating', async () => {
      const copySpy = vi
        .spyOn(service['client'], 'copyResource')
        .mockResolvedValue({ data: {} } as never);
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: { ...TEST_CONVERSATION },
      } as never);
      vi.spyOn(service['client'], 'saveConversation').mockResolvedValue({
        data: {},
      } as never);

      const result = await service.duplicateConversation(
        `source-bucket/${conversationPath}`,
        'test-token',
        'test-bucket',
      );

      expect(copySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            sourceUrl: `conversations/source-bucket/${conversationPath}`,
            destinationUrl:
              'conversations/test-bucket/applications/catalog/Team%2FApp%20One__0.0.1__hello%201',
            overwrite: false,
          },
        }),
      );
      expect(result.newPath).toBe(
        'conversations/test-bucket/applications/catalog/Team%2FApp%20One__0.0.1__hello%201',
      );
    });

    it('does not double-encode metadata paths', async () => {
      const metadataSpy = vi
        .spyOn(service['client'], 'getConversationMetadata')
        .mockResolvedValue({ data: {} } as never);

      await service.getConversationMetadata(
        conversationPath,
        'test-token',
        'test-bucket',
      );

      expect(metadataSpy).toHaveBeenCalledWith(
        'test-bucket',
        conversationPath,
        expect.any(Object),
      );
    });

    it('does not double-encode save paths', async () => {
      const saveSpy = vi.spyOn(service['client'], 'saveConversation');

      await service.saveConversation(
        conversationPath,
        'test-token',
        'test-bucket',
        TEST_CONVERSATION,
      );

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        conversationPath,
        expect.any(Object),
      );
    });
  });

  describe('duplicateConversation', () => {
    const SHARED_CONVERSATION = {
      ...TEST_CONVERSATION,
      id: 'shared-bucket/gpt-4o__New chat',
      folderId: 'shared-bucket',
      name: 'New chat',
    };

    // The copy is performed by copyResource; the metadata fix then reads the
    // copy back (getConversation) and re-saves it (saveConversation).
    const mockGetConversation = (
      conversation: typeof TEST_CONVERSATION = SHARED_CONVERSATION,
    ) => {
      vi.spyOn(service['client'], 'copyResource').mockResolvedValue({
        data: {},
      } as never);
      return vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: { ...conversation },
      } as never);
    };

    it('decodes the encoded filename so the title is not mangled (no "New20 chat")', async () => {
      mockGetConversation();
      const saveSpy = vi
        .spyOn(service['client'], 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      // The space stays a real space (encoded %20), never collapsed to "New20".
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__New%20chat%201',
        expect.objectContaining({
          body: expect.objectContaining({ name: 'New chat 1' }),
        }),
      );
    });

    it('gives the copy a distinct name so it does not collide with the source path', async () => {
      // Source is in another (shared/org) bucket and has no namesake in the user
      // bucket, yet the copy must still be renamed so its relative path differs.
      mockGetConversation();
      const saveSpy = vi
        .spyOn(service['client'], 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        expect.not.stringMatching(/__New%20chat$/),
        expect.objectContaining({
          body: expect.objectContaining({ name: 'New chat 1' }),
        }),
      );
    });

    it('rewrites the duplicate id/folderId to the session bucket', async () => {
      mockGetConversation();
      const saveSpy = vi
        .spyOn(service['client'], 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__New%20chat%201',
        expect.objectContaining({
          body: expect.objectContaining({
            id: 'test-bucket/gpt-4o__New chat 1',
            folderId: 'test-bucket',
          }),
        }),
      );
    });

    it('increments the suffix past existing copies in the bucket', async () => {
      vi.spyOn(service['client'], 'getConversationMetadata').mockResolvedValue({
        data: {
          items: [
            { name: 'gpt-4o__New chat', nodeType: 'CONVERSATION' },
            { name: 'gpt-4o__New chat 1', nodeType: 'CONVERSATION' },
          ],
        },
      } as never);
      mockGetConversation();
      const saveSpy = vi
        .spyOn(service['client'], 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__New%20chat%202',
        expect.objectContaining({
          body: expect.objectContaining({
            name: 'New chat 2',
            id: 'test-bucket/gpt-4o__New chat 2',
          }),
        }),
      );
    });

    it('returns the encoded path of the new conversation', async () => {
      mockGetConversation();
      vi.spyOn(service['client'], 'saveConversation').mockResolvedValue({
        data: {},
      } as never);

      const result = await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      expect(result.newPath).toBe(
        'conversations/test-bucket/gpt-4o__New%20chat%201',
      );
    });

    it('preserves temperature and responseFormat from the source conversation', async () => {
      vi.spyOn(service['client'], 'copyResource').mockResolvedValue({
        data: {},
      } as never);
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: {
          ...SHARED_CONVERSATION,
          temperature: 0.7,
          responseFormat: 'plain_text',
        },
      } as never);
      const saveSpy = vi
        .spyOn(service['client'], 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      const savedBody = saveSpy.mock.calls[0][2].body as Record<
        string,
        unknown
      >;
      expect(savedBody.temperature).toBe(0.7);
      expect(savedBody.responseFormat).toBe('plain_text');
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

    const callStream = async (
      conversationData: object,
      message: string,
      model: string,
      customContent?: Record<string, unknown>,
      mode = CompletionMode.Append,
      streamChunks = [': keepalive\n\n'],
    ) => {
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
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
        .spyOn(service['client'], 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: new Response(mockStream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        } as never);
      await service.streamCompletion(
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
      );
      return { sendSpy, res };
    };

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

    it('sends current starter configuration only as top-level custom_fields', async () => {
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
        messages: [{ role: ConversationMessageRole.User, content: '' }],
        stream: true,
        custom_fields: { configuration: { button: 1 } },
      });
      expect(
        (sendSpy.mock.calls[0][1].body.messages[0] as Record<string, unknown>)
          .custom_content,
      ).toBeUndefined();
    });

    it('moves persisted form configuration to custom_fields and submits form_value messages', async () => {
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
        { role: ConversationMessageRole.User, content: '' },
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

    it('saves partial message with hasStreamError when DIAL Core returns non-ok response', async () => {
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(service['client'], 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      vi.spyOn(
        service['client'],
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(null, {
          status: 400,
          statusText: 'Bad Request',
        }),
      } as never);

      const res = makeMockRes();
      await service.streamCompletion(
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

      // Should have saved at start (placeholder) + at error (partial with hasStreamError)
      expect(saveConversationSpy).toHaveBeenCalledTimes(2);
      const errorSave = saveConversationSpy.mock.calls[1][2].body as {
        messages: { hasStreamError?: boolean }[];
      };
      const assistantMsg = errorSave.messages.at(-1);
      expect((assistantMsg as Record<string, unknown>).hasStreamError).toBe(
        true,
      );
    });

    it('writes SSE chunks to res and saves conversation on completion', async () => {
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const saveConversationSpy = vi
        .spyOn(service['client'], 'saveConversation')
        .mockResolvedValue({ data: {} } as never);
      const firstChunk =
        'data: {"id":"resp-1","choices":[{"delta":{"content":"Hello"}}]}\n\n';
      const doneChunk = 'data: [DONE]\n\n';
      vi.spyOn(
        service['client'],
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(textToStream([firstChunk, doneChunk]), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      } as never);

      const res = makeMockRes();
      await service.streamCompletion(
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
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      vi.spyOn(service['client'], 'saveConversation').mockResolvedValue({
        data: {},
      } as never);

      const encoder = new TextEncoder();
      // Stream that emits content + [DONE] but is intentionally never closed,
      // mimicking a provider that holds the SSE socket open after [DONE].
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
        service['client'],
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(neverClosingStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      } as never);

      const res = makeMockRes();
      await service.streamCompletion(
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

      // The generation is released (complete), not left active — so a
      // subsequent request (e.g. regenerate) would not get a 409.
      expect(mockGenerationService.complete).toHaveBeenCalledWith(
        'test-session-id',
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-gen-id',
      );
      expect(mockGenerationService.error).not.toHaveBeenCalled();
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

      expect(getMetadataSpy).toHaveBeenNthCalledWith(
        1,
        'test-bucket',
        '',
        expect.objectContaining({
          params: {
            query: {
              recursive: true,
              limit: 50,
              token: 'user-cursor',
              permissions: true,
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
          (result.nextToken ?? '').slice('ct1.'.length),
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
          (result.nextToken ?? '').slice('ct1.'.length),
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

  describe('deleteConversations', () => {
    let deleteConversationSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      deleteConversationSpy = vi
        .spyOn(service['client'], 'deleteConversation')
        .mockResolvedValue({ data: {}, error: null } as never);
    });

    it('deduplicates ids — 2 identical IDs count as requested: 1', async () => {
      const id = 'conversations/test-bucket/gpt-4o__Chat__uuid';
      const result = await service.deleteConversations(
        [id, id],
        'token',
        'test-bucket',
      );
      expect(result.requested).toBe(1);
      expect(deleteConversationSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects ID from a different bucket with FORBIDDEN without calling DIAL Core', async () => {
      const result = await service.deleteConversations(
        ['conversations/other-bucket/chat'],
        'token',
        'test-bucket',
      );
      expect(result.failed).toEqual([
        { id: 'conversations/other-bucket/chat', code: 'FORBIDDEN' },
      ]);
      expect(deleteConversationSpy).not.toHaveBeenCalled();
    });

    it('counts DIAL Core 200 (error: null) as deleted: 1', async () => {
      const id = 'conversations/test-bucket/chat';
      const result = await service.deleteConversations(
        [id],
        'token',
        'test-bucket',
      );
      expect(result.deleted).toBe(1);
      expect(result.alreadyAbsent).toBe(0);
      expect(result.failed).toHaveLength(0);
    });

    it('counts DIAL Core 404 as alreadyAbsent: 1', async () => {
      deleteConversationSpy.mockResolvedValueOnce({
        error: { status: 404 },
      } as never);
      const id = 'conversations/test-bucket/chat';
      const result = await service.deleteConversations(
        [id],
        'token',
        'test-bucket',
      );
      expect(result.alreadyAbsent).toBe(1);
      expect(result.deleted).toBe(0);
      expect(result.failed).toHaveLength(0);
    });

    it('counts DIAL Core 500 as UPSTREAM_ERROR in failed', async () => {
      deleteConversationSpy.mockResolvedValueOnce({
        error: { status: 500 },
      } as never);
      const id = 'conversations/test-bucket/chat';
      const result = await service.deleteConversations(
        [id],
        'token',
        'test-bucket',
      );
      expect(result.failed).toEqual([{ id, code: 'UPSTREAM_ERROR' }]);
    });

    it('handles mixed results correctly', async () => {
      const ids = [
        'conversations/test-bucket/a',
        'conversations/test-bucket/b',
        'conversations/test-bucket/c',
        'conversations/other-bucket/d',
      ];
      deleteConversationSpy
        .mockResolvedValueOnce({ data: {}, error: null } as never)
        .mockResolvedValueOnce({ error: { status: 404 } } as never)
        .mockResolvedValueOnce({ error: { status: 500 } } as never);

      const result = await service.deleteConversations(
        ids,
        'token',
        'test-bucket',
      );

      expect(result.requested).toBe(4);
      expect(result.deleted).toBe(1);
      expect(result.alreadyAbsent).toBe(1);
      expect(result.failed).toHaveLength(2);
      expect(result.failed).toContainEqual({
        id: 'conversations/test-bucket/c',
        code: 'UPSTREAM_ERROR',
      });
      expect(result.failed).toContainEqual({
        id: 'conversations/other-bucket/d',
        code: 'FORBIDDEN',
      });
    });

    it('calls pinConversation only for deleted IDs', async () => {
      const deleted = 'conversations/test-bucket/deleted';
      const absent = 'conversations/test-bucket/absent';
      deleteConversationSpy
        .mockResolvedValueOnce({ data: {}, error: null } as never)
        .mockResolvedValueOnce({ error: { status: 404 } } as never);

      await service.deleteConversations(
        [deleted, absent],
        'token',
        'test-bucket',
      );

      await new Promise((r) => setTimeout(r, 0));
      expect(mockUserConfigService.updatePin).toHaveBeenCalledTimes(1);
      expect(mockUserConfigService.updatePin).toHaveBeenCalledWith(
        deleted,
        false,
        'token',
        'test-bucket',
      );
    });
  });

  describe('deleteAllConversations', () => {
    let deleteConversationSpy: ReturnType<typeof vi.spyOn>;
    let getMetadataSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      deleteConversationSpy = vi
        .spyOn(service['client'], 'deleteConversation')
        .mockResolvedValue({ data: {}, error: null } as never);
      getMetadataSpy = vi.spyOn(service['client'], 'getConversationMetadata');
    });

    it('returns zero counts immediately when bucket is empty', async () => {
      getMetadataSpy.mockResolvedValueOnce({
        data: { items: [] },
      } as never);

      const result = await service.deleteAllConversations(
        'token',
        'test-bucket',
      );

      expect(result).toEqual({
        requested: 0,
        deleted: 0,
        alreadyAbsent: 0,
        failed: [],
      });
      expect(deleteConversationSpy).not.toHaveBeenCalled();
    });

    it('delegates to deleteConversations when metadata returns items', async () => {
      getMetadataSpy.mockResolvedValueOnce({
        data: {
          items: [
            {
              url: 'conversations/test-bucket/a',
              nodeType: 'ITEM',
              name: 'a',
            },
            {
              url: 'conversations/test-bucket/b',
              nodeType: 'ITEM',
              name: 'b',
            },
          ],
        },
      } as never);

      const result = await service.deleteAllConversations(
        'token',
        'test-bucket',
      );

      expect(result.requested).toBe(2);
      expect(result.deleted).toBe(2);
      expect(deleteConversationSpy).toHaveBeenCalledTimes(2);
    });

    it('throws BadGatewayException when getConversationMetadata returns error', async () => {
      getMetadataSpy.mockResolvedValueOnce({
        data: undefined,
        error: { status: 500 },
      } as never);

      await expect(
        service.deleteAllConversations('token', 'test-bucket'),
      ).rejects.toThrow('DIAL Core metadata listing failed');
    });

    it('throws BadGatewayException when getConversationMetadata throws', async () => {
      getMetadataSpy.mockRejectedValueOnce(new Error('network error'));

      await expect(
        service.deleteAllConversations('token', 'test-bucket'),
      ).rejects.toThrow();
    });

    it('excludes FOLDER items from deletion', async () => {
      getMetadataSpy.mockResolvedValueOnce({
        data: {
          items: [
            {
              url: 'conversations/test-bucket/folder',
              nodeType: 'FOLDER',
              name: 'folder',
            },
            {
              url: 'conversations/test-bucket/chat',
              nodeType: 'ITEM',
              name: 'chat',
            },
          ],
        },
      } as never);

      const result = await service.deleteAllConversations(
        'token',
        'test-bucket',
      );

      expect(result.requested).toBe(1);
      expect(deleteConversationSpy).toHaveBeenCalledTimes(1);
    });
  });
});
