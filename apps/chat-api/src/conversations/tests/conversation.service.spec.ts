import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  ConversationGenerationService,
  GenerationStatus,
} from '../conversation-generation.service';
import { ConversationService } from '../conversation.service';
import {
  ConversationMessageRole,
  StatusEvent,
} from '../dto/conversation-message.dto';
import { CompletionMode } from '../dto/send-completion.dto';
import { ChatCompletionsAdapter } from '../generation/chat-completions.adapter';
import { ResponsesAdapter } from '../generation/responses.adapter';

vi.mock('../../common/dial/dial-error.mapper', () => ({
  handleDialSdkError: vi.fn(),
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

describe('ConversationService', () => {
  let service: ConversationService;
  let mockDialClient: DialClientService;
  let mockUserConfigService: {
    getPinnedIds: ReturnType<typeof vi.fn>;
    updatePin: ReturnType<typeof vi.fn>;
    migratePin: ReturnType<typeof vi.fn>;
  };
  let mockGenerationService: ConversationGenerationService;
  let mockConversationNamingService: {
    maybeRenameAfterFirstReply: ReturnType<typeof vi.fn>;
  };
  let mockDeploymentsService: {
    getDeploymentDetails: ReturnType<typeof vi.fn>;
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
    mockUserConfigService = {
      getPinnedIds: vi.fn().mockResolvedValue([]),
      updatePin: vi.fn().mockResolvedValue(undefined),
      migratePin: vi.fn().mockResolvedValue(undefined),
    };
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
        modelDetails: { features: {} },
      }),
    };
    service = new ConversationService(
      mockDialClient,
      mockUserConfigService as never,
      mockGenerationService,
      mockConversationNamingService as never,
      mockDeploymentsService as never,
      new ChatCompletionsAdapter(mockDialClient),
      new ResponsesAdapter(mockDialClient),
    );
    vi.mocked(handleDialSdkError).mockReset();
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
    /*
     * Default: no path collision on duplicate (metadata lookup returns 404).
     * Individual duplicateConversation tests override this when needed.
     */
    vi.spyOn(
      service['dialClient'].client,
      'getConversationMetadata',
    ).mockResolvedValue({
      data: null,
      error: { status: 404 },
      response: new Response(null, { status: 404 }),
    } as never);
  });

  describe('createConversation', () => {
    it('saves the conversation using the expected Core resource name', async () => {
      const saveConversationSpy = vi.spyOn(
        service['dialClient'].client,
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
        expect.stringMatching(
          /^form-example__What%20do%20you%20want%20to%20do%3F__[\w-]+$/,
        ),
        expect.any(Object),
      );
    });

    it('does not double-encode percent-encoded deployment ID segments', async () => {
      const saveConversationSpy = vi.spyOn(
        service['dialClient'].client,
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
        expect.stringMatching(
          /^applications\/catalog\/Team%2FApp%20One__0\.0\.1__Hello__[\w-]+$/,
        ),
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
      expect(result.id).toMatch(
        /^test-bucket\/form-example__New chat__[0-9a-f-]{36}$/,
      );
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

    it('uses the base name for the conversation title', async () => {
      const result = await service.createConversation(
        'What is AI?',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );

      expect(result.name).toBe('What is AI?');
    });

    it('always appends a UUID suffix to the conversation path', async () => {
      const getMetadataSpy = vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      );
      const saveSpy = vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      );

      const result = await service.createConversation(
        'What is AI?',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );

      expect(getMetadataSpy).not.toHaveBeenCalled();
      expect(result.id).toMatch(
        /^test-bucket\/gpt-4o__What is AI\?__[0-9a-f-]{36}$/,
      );
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        expect.stringMatching(/^gpt-4o__What%20is%20AI%3F__[\w-]+$/),
        expect.any(Object),
      );
    });
  });

  describe('getConversation', () => {
    it('uses session bucket and encodes reserved URL characters for a flat path', async () => {
      const spy = vi
        .spyOn(service['dialClient'].client, 'getConversation')
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
        .spyOn(service['dialClient'].client, 'getConversation')
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
        .spyOn(service['dialClient'].client, 'getConversation')
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

    it('fetches shared conversation from the originating bucket, not the session bucket', async () => {
      const spy = vi
        .spyOn(service['dialClient'].client, 'getConversation')
        .mockResolvedValue({ data: TEST_CONVERSATION } as never);

      await service.getConversation(
        'other-user-bucket/gpt-4o__shared-chat__uuid',
        'test-token',
        'test-bucket',
      );

      expect(spy).toHaveBeenCalledWith(
        'other-user-bucket',
        'gpt-4o__shared-chat__uuid',
        expect.any(Object),
      );
    });

    it('uses session bucket for a path with no slash', async () => {
      const spy = vi
        .spyOn(service['dialClient'].client, 'getConversation')
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
        .spyOn(service['dialClient'].client, 'getConversation')
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

    it('returns the stored LLM title when the path still uses the message-derived name', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: {
          ...TEST_CONVERSATION,
          name: 'Docker networking basics',
          llmNamingDone: true,
          messages: [
            {
              role: ConversationMessageRole.User,
              content: 'How does Docker networking work?',
            },
          ],
        },
      } as never);

      const result = await service.getConversation(
        'test-bucket/gpt-4o__How does Docker networking work?',
        'test-token',
        'test-bucket',
      );

      expect(result.name).toBe('Docker networking basics');
    });

    it('returns the manually-renamed stored name even when the filename still encodes the old title', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: {
          ...TEST_CONVERSATION,
          name: 'New Title',
          llmNamingDone: true,
        },
      } as never);

      const result = await service.getConversation(
        'test-bucket/gpt-4o__Old Title__uuid',
        'test-token',
        'test-bucket',
      );

      expect(result.name).toBe('New Title');
    });

    it('falls back to the filename-derived title when naming is not yet final', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: {
          ...TEST_CONVERSATION,
          name: 'How does Docker networking work?',
          llmNamingDone: false,
        },
      } as never);

      const result = await service.getConversation(
        'test-bucket/gpt-4o__How does Docker networking work?',
        'test-token',
        'test-bucket',
      );

      expect(result.name).toBe('How does Docker networking work?');
    });
  });

  describe('encoded conversation resource paths', () => {
    const conversationPath =
      'applications/catalog/Team%2FApp%20One__0.0.1__hello';

    it('does not double-encode delete paths', async () => {
      const deleteSpy = vi
        .spyOn(service['dialClient'].client, 'deleteConversation')
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

    it('renames at the same path without moving the resource', async () => {
      const moveSpy = vi.spyOn(service['dialClient'].client, 'moveResource');
      const getSpy = vi
        .spyOn(service['dialClient'].client, 'getConversation')
        .mockResolvedValue({
          data: {
            ...TEST_CONVERSATION,
            name: 'Old Title',
            llmNamingDone: true,
          },
        } as never);
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      const result = await service.renameConversation(
        conversationPath,
        'renamed',
        'test-token',
        'test-bucket',
      );

      expect(moveSpy).not.toHaveBeenCalled();
      expect(getSpy).toHaveBeenCalledWith(
        'test-bucket',
        conversationPath,
        expect.any(Object),
      );
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        conversationPath,
        expect.objectContaining({
          body: expect.objectContaining({
            name: 'renamed',
            llmNamingDone: true,
          }),
        }),
      );
      expect(result).toEqual({ name: 'renamed' });
    });

    it('throws NotFoundException when the conversation to rename does not exist', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: null,
        error: { status: 404 },
      } as never);
      vi.mocked(handleDialSdkError).mockImplementationOnce(() => {
        throw new Error('not found');
      });

      await expect(
        service.renameConversation(
          conversationPath,
          'renamed',
          'test-token',
          'test-bucket',
        ),
      ).rejects.toThrow('Conversation not found');
    });

    it('preserves nested deployment paths when duplicating', async () => {
      const getSpy = vi
        .spyOn(service['dialClient'].client, 'getConversation')
        .mockResolvedValue({
          data: { ...TEST_CONVERSATION, name: 'hello' },
        } as never);
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      const result = await service.duplicateConversation(
        `source-bucket/${conversationPath}`,
        'test-token',
        'test-bucket',
      );

      expect(getSpy).toHaveBeenCalledWith(
        'source-bucket',
        conversationPath,
        expect.any(Object),
      );
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'applications/catalog/Team%2FApp%20One__0.0.1__hello',
        expect.objectContaining({
          body: expect.objectContaining({
            id: 'test-bucket/applications/catalog/Team/App One__0.0.1__hello',
            folderId: 'test-bucket/applications/catalog',
            name: 'hello',
          }),
        }),
      );
      expect(result.newPath).toBe(
        'conversations/test-bucket/applications/catalog/Team%2FApp%20One__0.0.1__hello',
      );
    });

    it('does not double-encode metadata paths', async () => {
      const metadataSpy = vi
        .spyOn(service['dialClient'].client, 'getConversationMetadata')
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
      const saveSpy = vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      );

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

    it('preserves an LLM display name when the client saves a stale title', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: {
          ...TEST_CONVERSATION,
          name: 'Greeting',
          llmNamingDone: true,
        },
      } as never);
      const saveSpy = vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      );

      await service.saveConversation(
        conversationPath,
        'test-token',
        'test-bucket',
        { ...TEST_CONVERSATION, name: 'helllo' },
      );

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        conversationPath,
        expect.objectContaining({
          body: expect.objectContaining({
            name: 'Greeting',
            llmNamingDone: true,
          }),
        }),
      );
    });

    it('invokes LLM naming hook after a successful save without awaiting it', async () => {
      const conversation = {
        ...TEST_CONVERSATION,
        messages: [
          {
            id: 'user-1',
            role: ConversationMessageRole.User,
            content: 'Hello',
            timestamp: new Date().toISOString(),
          },
          {
            id: 'assistant-1',
            role: ConversationMessageRole.Assistant,
            content: 'Hi there',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await service.saveConversation(
        conversationPath,
        'test-token',
        'test-bucket',
        conversation,
      );

      expect(
        mockConversationNamingService.maybeRenameAfterFirstReply,
      ).toHaveBeenCalledWith(
        conversationPath,
        'test-token',
        'test-bucket',
        expect.objectContaining({ messages: conversation.messages }),
      );
    });

    it('does not invoke LLM naming hook when llmNamingDone is already true', async () => {
      await service.saveConversation(
        conversationPath,
        'test-token',
        'test-bucket',
        { ...TEST_CONVERSATION, llmNamingDone: true },
      );

      expect(
        mockConversationNamingService.maybeRenameAfterFirstReply,
      ).not.toHaveBeenCalled();
    });

    it('does not invoke LLM naming hook when save fails', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      ).mockResolvedValue({
        data: null,
        error: { status: 500 },
      } as never);
      vi.mocked(handleDialSdkError).mockImplementation(() => {
        throw new Error('save failed');
      });

      await expect(
        service.saveConversation(
          conversationPath,
          'test-token',
          'test-bucket',
          TEST_CONVERSATION,
        ),
      ).rejects.toThrow('save failed');

      expect(
        mockConversationNamingService.maybeRenameAfterFirstReply,
      ).not.toHaveBeenCalled();
    });
  });

  describe('duplicateConversation', () => {
    const SHARED_CONVERSATION = {
      ...TEST_CONVERSATION,
      id: 'shared-bucket/gpt-4o__New chat',
      folderId: 'shared-bucket',
      name: 'New chat',
    };

    const mockGetConversation = (
      conversation: typeof TEST_CONVERSATION = SHARED_CONVERSATION,
    ) =>
      vi
        .spyOn(service['dialClient'].client, 'getConversation')
        .mockResolvedValue({
          data: { ...conversation },
        } as never);

    it('decodes the encoded filename so the title is not mangled (no "New20 chat")', async () => {
      mockGetConversation();
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      // The space stays a real space (encoded %20), never collapsed to "New20".
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__New%20chat',
        expect.objectContaining({
          body: expect.objectContaining({ name: 'New chat' }),
        }),
      );
    });

    it('preserves the source display name without adding a numeric suffix', async () => {
      mockGetConversation();
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__New%20chat',
        expect.objectContaining({
          body: expect.objectContaining({ name: 'New chat' }),
        }),
      );
    });

    it('regression: does not produce a double suffix when source title ends with a number', async () => {
      mockGetConversation({
        ...SHARED_CONVERSATION,
        id: 'shared-bucket/gpt-4o__New chat 1',
        name: 'New chat 1',
      });
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat%201',
        'test-token',
        'test-bucket',
      );

      const savedBody = saveSpy.mock.calls[0][2].body as Record<
        string,
        unknown
      >;
      expect(savedBody.name).toBe('New chat 1');
      expect(savedBody.name).not.toBe('New chat 1 1');
    });

    it('uses the stored name field when the conversation was LLM-renamed', async () => {
      /*
       * Storage path still uses the original first-message name, but JSON name
       * was updated by the LLM to a meaningful title.
       */
      mockGetConversation({
        ...SHARED_CONVERSATION,
        id: 'shared-bucket/gpt-4o__Hello there',
        name: 'AI Discussion',
        llmNamingDone: true,
      });
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__Hello%20there',
        'test-token',
        'test-bucket',
      );

      const savedBody = saveSpy.mock.calls[0][2].body as Record<
        string,
        unknown
      >;
      expect(savedBody.name).toBe('AI Discussion');
      expect(savedBody.name).not.toBe('Hello there');
      // Path built from the LLM-assigned name
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__AI%20Discussion',
        expect.anything(),
      );
    });

    it('rewrites the duplicate id/folderId to the session bucket', async () => {
      mockGetConversation();
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__New%20chat',
        expect.objectContaining({
          body: expect.objectContaining({
            id: 'test-bucket/gpt-4o__New chat',
            folderId: 'test-bucket',
          }),
        }),
      );
    });

    it('appends a UUID segment when the destination path already exists', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockResolvedValue({
        data: { name: 'gpt-4o__New chat' },
      } as never);
      mockGetConversation();
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        expect.stringMatching(/^gpt-4o__New%20chat__[\w-]{36}$/),
        expect.objectContaining({
          body: expect.objectContaining({ name: 'New chat' }),
        }),
      );
    });

    it('builds a clean 2-part path when source already has a UUID suffix', async () => {
      mockGetConversation({
        ...SHARED_CONVERSATION,
        id: 'shared-bucket/gpt-4o__hello__a557f695-6bf5-4796-b609-2532881ae91a',
        name: 'hello',
      });
      const metadataSpy = vi
        .spyOn(service['dialClient'].client, 'getConversationMetadata')
        .mockResolvedValue({
          error: { status: 404 },
          response: new Response(null, { status: 404 }),
        } as never);
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
        .mockResolvedValue({ data: {} } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__hello__a557f695-6bf5-4796-b609-2532881ae91a',
        'test-token',
        'test-bucket',
      );

      // Collision check must be for the clean 2-part path, not a 3-part path
      expect(metadataSpy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__hello',
        expect.anything(),
      );
      // Saved path must be clean (no old UUID carried over)
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'gpt-4o__hello',
        expect.objectContaining({
          body: expect.objectContaining({ name: 'hello' }),
        }),
      );
    });

    it('does not call fetchAllUserTitles during duplicate', async () => {
      mockGetConversation();
      vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      ).mockResolvedValue({
        data: {},
      } as never);
      const metadataSpy = vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      );

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      /*
       * getConversationMetadata is called once for the path collision check,
       * never for a full bucket title scan (which would pass an empty path '').
       */
      expect(metadataSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        '',
        expect.anything(),
      );
    });

    it('does not invoke ConversationNamingService during duplicate', async () => {
      mockGetConversation();
      vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      ).mockResolvedValue({
        data: {},
      } as never);

      await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      expect(
        mockConversationNamingService.maybeRenameAfterFirstReply,
      ).not.toHaveBeenCalled();
    });

    it('returns the encoded path of the new conversation', async () => {
      mockGetConversation();
      vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      ).mockResolvedValue({
        data: {},
      } as never);

      const result = await service.duplicateConversation(
        'shared-bucket/gpt-4o__New%20chat',
        'test-token',
        'test-bucket',
      );

      expect(result.newPath).toBe(
        'conversations/test-bucket/gpt-4o__New%20chat',
      );
    });

    it('preserves temperature and responseFormat from the source conversation', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        data: {
          ...SHARED_CONVERSATION,
          temperature: 0.7,
          responseFormat: 'plain_text',
        },
      } as never);
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveConversation')
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
        'test-sub',
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
        'test-sub',
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
        'test-sub',
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
        'test-sub',
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
        'test-sub',
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

  describe('streamCompletion — generation API dispatch', () => {
    const conversation = {
      id: 'test-bucket/gpt-4o__Test__11111111-1111-1111-1111-111111111111',
      folderId: 'test-bucket',
      name: 'Test',
      model: { id: 'gpt-4o' },
      prompt: '',
      temperature: 1,
      selectedAddons: [],
      lastActivityDate: 0,
      updatedAt: 0,
      messages: [
        {
          id: 'u1',
          role: ConversationMessageRole.User,
          content: 'Hello',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    const emptyStream = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

    beforeEach(() => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({ data: conversation } as never);
      vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      ).mockResolvedValue({ data: {} } as never);
    });

    it('dispatches a Responses-capable model to createResponse only', async () => {
      mockDeploymentsService.getDeploymentDetails.mockResolvedValue({
        id: 'gpt-4o',
        type: 'model',
        modelDetails: { features: { responsesApi: true } },
      });
      const createResponseSpy = vi
        .spyOn(service['dialClient'].client, 'createResponse')
        .mockResolvedValue({
          response: new Response(emptyStream(), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        } as never);
      const sendChatSpy = vi.spyOn(
        service['dialClient'].client,
        'sendChatCompletionRequest',
      );

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello again',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        makeMockRes() as never,
        'test-sub',
      );

      expect(createResponseSpy).toHaveBeenCalledOnce();
      expect(sendChatSpy).not.toHaveBeenCalled();
    });

    it('dispatches a Responses-capable application to createResponse only', async () => {
      mockDeploymentsService.getDeploymentDetails.mockResolvedValue({
        id: 'applications/catalog/my-app',
        type: 'application',
        applicationDetails: { features: { responsesApi: true } },
      });
      const createResponseSpy = vi
        .spyOn(service['dialClient'].client, 'createResponse')
        .mockResolvedValue({
          response: new Response(emptyStream(), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        } as never);
      const sendChatSpy = vi.spyOn(
        service['dialClient'].client,
        'sendChatCompletionRequest',
      );

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello again',
        undefined,
        'applications/catalog/my-app',
        undefined,
        'test-session-id',
        makeMockRes() as never,
        'test-sub',
      );

      expect(createResponseSpy).toHaveBeenCalledOnce();
      expect(sendChatSpy).not.toHaveBeenCalled();
    });

    it('dispatches a deployment without the responsesApi flag to sendChatCompletionRequest only', async () => {
      mockDeploymentsService.getDeploymentDetails.mockResolvedValue({
        id: 'gpt-4o',
        type: 'model',
        modelDetails: { features: {} },
      });
      const createResponseSpy = vi.spyOn(
        service['dialClient'].client,
        'createResponse',
      );
      const sendChatSpy = vi
        .spyOn(service['dialClient'].client, 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: new Response(emptyStream(), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        } as never);

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello again',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        makeMockRes() as never,
        'test-sub',
      );

      expect(sendChatSpy).toHaveBeenCalledOnce();
      expect(createResponseSpy).not.toHaveBeenCalled();
    });

    it('dispatches to Chat Completions when both responsesApi and chatCompletion are false', async () => {
      mockDeploymentsService.getDeploymentDetails.mockResolvedValue({
        id: 'gpt-4o',
        type: 'model',
        modelDetails: {
          features: { responsesApi: false, chatCompletion: false },
        },
      });
      const createResponseSpy = vi.spyOn(
        service['dialClient'].client,
        'createResponse',
      );
      const sendChatSpy = vi
        .spyOn(service['dialClient'].client, 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: new Response(emptyStream(), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        } as never);

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello again',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        makeMockRes() as never,
        'test-sub',
      );

      expect(sendChatSpy).toHaveBeenCalledOnce();
      expect(createResponseSpy).not.toHaveBeenCalled();
    });

    it('dispatches to Chat Completions when a legacy Core payload declares neither flag', async () => {
      mockDeploymentsService.getDeploymentDetails.mockResolvedValue({
        id: 'gpt-4o',
        type: 'model',
        modelDetails: {},
      });
      const sendChatSpy = vi
        .spyOn(service['dialClient'].client, 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: new Response(emptyStream(), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        } as never);

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello again',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        makeMockRes() as never,
        'test-sub',
      );

      expect(sendChatSpy).toHaveBeenCalledOnce();
    });

    it('rejects with 400 and makes no generation call when the target resolves to a toolset', async () => {
      mockDeploymentsService.getDeploymentDetails.mockResolvedValue({
        id: 'toolsets/search',
        type: 'toolset',
        toolsetDetails: { features: {} },
      });
      const createResponseSpy = vi.spyOn(
        service['dialClient'].client,
        'createResponse',
      );
      const sendChatSpy = vi.spyOn(
        service['dialClient'].client,
        'sendChatCompletionRequest',
      );

      await expect(
        service.streamCompletion(
          'test-path',
          'test-token',
          'test-bucket',
          'test-gen-id',
          CompletionMode.Append,
          'Hello again',
          undefined,
          'toolsets/search',
          undefined,
          'test-session-id',
          makeMockRes() as never,
          'test-sub',
        ),
      ).rejects.toThrow(/toolset/);

      expect(createResponseSpy).not.toHaveBeenCalled();
      expect(sendChatSpy).not.toHaveBeenCalled();
      expect(mockGenerationService.error).toHaveBeenCalledWith(
        'test-session-id',
        'test-path',
        'test-gen-id',
      );
    });

    it('surfaces the BFF error and makes no generation call when capability lookup fails', async () => {
      mockDeploymentsService.getDeploymentDetails.mockRejectedValue(
        new BadGatewayException('DIAL Core is unreachable'),
      );
      const createResponseSpy = vi.spyOn(
        service['dialClient'].client,
        'createResponse',
      );
      const sendChatSpy = vi.spyOn(
        service['dialClient'].client,
        'sendChatCompletionRequest',
      );

      await expect(
        service.streamCompletion(
          'test-path',
          'test-token',
          'test-bucket',
          'test-gen-id',
          CompletionMode.Append,
          'Hello again',
          undefined,
          'gpt-4o',
          undefined,
          'test-session-id',
          makeMockRes() as never,
          'test-sub',
        ),
      ).rejects.toThrow('DIAL Core is unreachable');

      expect(createResponseSpy).not.toHaveBeenCalled();
      expect(sendChatSpy).not.toHaveBeenCalled();
    });

    it('aborts the upstream Responses call and saves the partial message as stopped on user stop', async () => {
      mockDeploymentsService.getDeploymentDetails.mockResolvedValue({
        id: 'gpt-4o',
        type: 'model',
        modelDetails: { features: { responsesApi: true } },
      });
      mockGenerationService.getStatus = vi
        .fn()
        .mockReturnValue(GenerationStatus.Stopped);
      vi.spyOn(
        service['dialClient'].client,
        'createResponse',
      ).mockImplementation(() => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      });
      const saveConversationSpy = vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      );

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'test-gen-id',
        CompletionMode.Append,
        'Hello again',
        undefined,
        'gpt-4o',
        undefined,
        'test-session-id',
        makeMockRes() as never,
        'test-sub',
      );

      expect(mockGenerationService.complete).not.toHaveBeenCalled();
      const finalSave = saveConversationSpy.mock.calls.at(-1)?.[2] as {
        body: { messages: { wasStoppedByUser?: boolean }[] };
      };
      expect(finalSave.body.messages.at(-1)?.wasStoppedByUser).toBe(true);
    });
  });

  describe('listConversations', () => {
    type MetadataItem = { url: string; nodeType: string; updatedAt?: number };

    const mockMetadata = (
      userItems: MetadataItem[],
      publicItems: MetadataItem[] = [],
    ) => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({ data: { items: userItems } }) as never;
        }
        return Promise.resolve({ data: { items: publicItems } }) as never;
      });
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: { resources: [] },
      } as never);
    };

    it('passes pagination through SDK params.query', async () => {
      const getMetadataSpy = vi
        .spyOn(service['dialClient'].client, 'getConversationMetadata')
        .mockResolvedValue({ data: { items: [] } } as never);
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
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

    it('enriches display names for at most the most recently updated owned items', async () => {
      const items = Array.from({ length: 25 }, (_, index) => ({
        url: `conversations/bucket/conv-${index}`,
        nodeType: 'FILE' as const,
        updatedAt: index,
        permissions: ['READ', 'WRITE'],
      }));
      mockMetadata(items);
      const getConversationSpy = vi
        .spyOn(service['dialClient'].client, 'getConversation')
        .mockResolvedValue({
          data: { name: 'Stored display title' },
        } as never);

      await service.listConversations('test-token', 'test-bucket');

      expect(getConversationSpy).toHaveBeenCalledTimes(20);
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

    it('returns the personal and public copies as two independent items when relative paths match', async () => {
      const personalItem = {
        url: 'conversations/test-bucket/gpt-4o__shared-title',
        nodeType: 'FILE',
        updatedAt: 2000,
        permissions: ['READ', 'WRITE'],
      };
      mockMetadata(
        [personalItem],
        [
          {
            url: 'conversations/public/gpt-4o__shared-title',
            nodeType: 'FILE',
            updatedAt: 2000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(2);
      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'conversations/test-bucket/gpt-4o__shared-title',
            publishedWithMe: false,
            isReadonly: false,
          }),
          expect.objectContaining({
            id: 'conversations/public/gpt-4o__shared-title',
            publishedWithMe: true,
            isReadonly: true,
          }),
        ]),
      );
    });

    it("preserves the personal copy's pin status after the conversation is published", async () => {
      const personalMetadataItem = {
        url: 'conversations/test-bucket/gpt-4o__shared-title',
        nodeType: 'FILE',
        updatedAt: 2000,
        permissions: ['READ', 'WRITE'],
      };
      mockMetadata(
        [personalMetadataItem],
        [
          {
            url: 'conversations/public/gpt-4o__shared-title',
            nodeType: 'FILE',
            updatedAt: 2000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([
        'conversations/test-bucket/gpt-4o__shared-title',
      ]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      const personalItem = result.items.find(
        (i) => i.id === 'conversations/test-bucket/gpt-4o__shared-title',
      );
      const publicItem = result.items.find(
        (i) => i.id === 'conversations/public/gpt-4o__shared-title',
      );
      expect(personalItem?.isPinned).toBe(true);
      expect(publicItem?.isPinned).toBe(false);
    });

    it('merges items from getSharedResources and sets sharedWithMe: true', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/user-conv',
          nodeType: 'FILE',
          updatedAt: 3000,
        },
      ]);
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
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

    it('tags a user-bucket item created by a scheduled task with isScheduledTask, scheduleId, and runId', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/.scheduler/sched_abc/gpt-4o__Morning briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
          nodeType: 'FILE',
          updatedAt: 1000,
        },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toEqual([
        expect.objectContaining({
          isScheduledTask: true,
          scheduleId: 'sched_abc',
          runId: 'c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
        }),
      ]);
    });

    it('tags a public-bucket item created by a scheduled task independently of its own path', async () => {
      mockMetadata(
        [],
        [
          {
            url: 'conversations/public/.scheduler/sched_pub/gpt-4o__title__d8bfff5d-d883-47e8-adc3-8a6afee46411',
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

      expect(result.items).toEqual([
        expect.objectContaining({
          isScheduledTask: true,
          scheduleId: 'sched_pub',
          runId: 'd8bfff5d-d883-47e8-adc3-8a6afee46411',
        }),
      ]);
    });

    it('tags a shared item created by a scheduled task using its own resource id', async () => {
      mockMetadata([]);
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: {
          resources: [
            {
              url: 'conversations/other-bucket/.scheduler/sched_shr/gpt-4o__title__a1b2c3d4-e5f6-4789-abcd-ef0123456789',
              nodeType: 'FILE',
            },
          ],
        },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toEqual([
        expect.objectContaining({
          isScheduledTask: true,
          scheduleId: 'sched_shr',
          runId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
          sharedWithMe: true,
        }),
      ]);
    });

    it('sets isScheduledTask: false with no scheduleId/runId for a normal conversation', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/gpt-4o__Morning briefing__uuid',
          nodeType: 'FILE',
          updatedAt: 1000,
        },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].isScheduledTask).toBe(false);
      expect(result.items[0].scheduleId).toBeUndefined();
      expect(result.items[0].runId).toBeUndefined();
    });

    it('calls getSharedResources with resourceTypes CONVERSATION and with me', async () => {
      mockMetadata([]);
      const spy = vi
        .spyOn(service['dialClient'].client, 'getSharedResources')
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
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
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
            items: [{ url: 'conversations/public/pub-conv', nodeType: 'FILE' }],
          },
        }) as never;
      });
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockRejectedValue(new Error('share service unreachable'));
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
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
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
      });
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('conversations/test-bucket/user-conv');
    });

    it('encodes a compound nextToken when both user and public buckets have more results', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            data: { items: [], nextToken: 'user-cursor' },
          }) as never;
        }
        return Promise.resolve({
          data: { items: [], nextToken: 'pub-cursor' },
        }) as never;
      });
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
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
        .spyOn(service['dialClient'].client, 'getConversationMetadata')
        .mockImplementation(
          () => Promise.resolve({ data: { items: [] } }) as never,
        );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
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
        .spyOn(service['dialClient'].client, 'getConversationMetadata')
        .mockImplementation(
          () => Promise.resolve({ data: { items: [] } }) as never,
        );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
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
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            data: { items: [], nextToken: 'user-cursor' },
          }) as never;
        }
        return Promise.resolve({ data: { items: [] } }) as never;
      });
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
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

    it('still throws NotFoundException for a 404 on the user bucket', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            error: { message: 'Not found' },
            response: new Response(null, { status: 404 }),
          }) as never;
        }
        return Promise.resolve({ data: { items: [] } }) as never;
      });
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);
      vi.mocked(handleDialSdkError).mockImplementation(() => {
        throw new Error('mapped DIAL error');
      });

      await expect(
        service.listConversations('test-token', 'test-bucket'),
      ).rejects.toThrow('mapped DIAL error');
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
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
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
      });
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].sharedWithMe).toBe(true);
    });

    it('calls handleDialSdkError when the user bucket returns a response-level error', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            error: { message: 'Bad Gateway' },
            response: new Response(null, { status: 502 }),
          }) as never;
        }
        return Promise.resolve({ data: { items: [] } }) as never;
      });
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);
      vi.mocked(handleDialSdkError).mockImplementation(() => {
        throw new Error('mapped DIAL error');
      });

      await expect(
        service.listConversations('test-token', 'test-bucket'),
      ).rejects.toThrow('mapped DIAL error');

      expect(handleDialSdkError).toHaveBeenCalledWith(
        { message: 'Bad Gateway' },
        'conversations.listConversations',
        expect.anything(),
        expect.objectContaining({ status: 502 }),
      );
    });

    it('returns only user items when public bucket returns a response-level error', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
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
      });
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
        .spyOn(service['dialClient'].client, 'deleteConversation')
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
        .spyOn(service['dialClient'].client, 'deleteConversation')
        .mockResolvedValue({ data: {}, error: null } as never);
      getMetadataSpy = vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      );
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

  describe('DIAL SDK error status propagation', () => {
    beforeEach(async () => {
      const actual = await vi.importActual<
        typeof import('../../common/dial/dial-error.mapper')
      >('../../common/dial/dial-error.mapper');
      vi.mocked(handleDialSdkError).mockImplementation(
        actual.handleDialSdkError,
      );
    });

    it('deleteConversation throws NotFoundException when DIAL Core reports 404 with no status on the error body', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'deleteConversation',
      ).mockResolvedValue({
        error: { message: 'Not found' },
        response: new Response(null, { status: 404 }),
      } as never);

      await expect(
        service.deleteConversation(
          'gpt-4o__Already deleted__uuid',
          'test-token',
          'test-bucket',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('getConversation (via getStoredConversation) throws NotFoundException for a 404 upstream response', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        error: { message: 'Not found' },
        response: new Response(null, { status: 404 }),
      } as never);

      await expect(
        service.getConversation(
          'gpt-4o__Chat__uuid',
          'test-token',
          'test-bucket',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('duplicateConversation throws ForbiddenException for a 403 upstream response on the source read', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversation',
      ).mockResolvedValue({
        error: { message: 'Forbidden' },
        response: new Response(null, { status: 403 }),
      } as never);

      await expect(
        service.duplicateConversation(
          'shared-bucket/gpt-4o__Chat',
          'test-token',
          'test-bucket',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('renameConversation throws ConflictException for a 409 upstream response on the save call', async () => {
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
        error: { message: 'Conflict' },
        response: new Response(null, { status: 409 }),
      } as never);

      await expect(
        service.renameConversation(
          'gpt-4o__Chat',
          'New title',
          'test-token',
          'test-bucket',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('getConversationMetadata throws NotFoundException for a 404 upstream response', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockResolvedValue({
        error: { message: 'Not found' },
        response: new Response(null, { status: 404 }),
      } as never);

      await expect(
        service.getConversationMetadata(
          'gpt-4o__Chat',
          'test-token',
          'test-bucket',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('saveConversation throws ConflictException for a 409 upstream response', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      ).mockResolvedValue({
        error: { message: 'Conflict' },
        response: new Response(null, { status: 409 }),
      } as never);

      await expect(
        service.saveConversation(
          'gpt-4o__Chat',
          'test-token',
          'test-bucket',
          TEST_CONVERSATION,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('createConversation throws NotFoundException for a 404 upstream response on the save call', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'saveConversation',
      ).mockResolvedValue({
        error: { message: 'Not found' },
        response: new Response(null, { status: 404 }),
      } as never);

      await expect(
        service.createConversation(
          'Hello',
          'test-token',
          'test-bucket',
          'gpt-4o',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
