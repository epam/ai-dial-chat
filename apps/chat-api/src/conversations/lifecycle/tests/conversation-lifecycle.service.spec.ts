import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleDialSdkError } from '../../../common/dial/dial-error.mapper';
import type { DialClientService } from '../../../dial/dial-client.service';
import { ConversationPersistenceService } from '../../persistence/conversation-persistence.service';
import { ConversationLifecycleService } from '../conversation-lifecycle.service';

vi.mock('../../../common/dial/dial-error.mapper', () => ({
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

describe('ConversationLifecycleService', () => {
  let service: ConversationLifecycleService;
  let mockDialClient: DialClientService;
  let mockUserConfigService: {
    getPinnedIds: ReturnType<typeof vi.fn>;
    updatePin: ReturnType<typeof vi.fn>;
    migratePin: ReturnType<typeof vi.fn>;
  };
  let mockConversationNamingService: {
    maybeRenameAfterFirstReply: ReturnType<typeof vi.fn>;
  };
  let persistenceService: ConversationPersistenceService;

  beforeEach(() => {
    mockDialClient = {
      client: {
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
    persistenceService = new ConversationPersistenceService(
      mockDialClient,
      mockConversationNamingService as never,
    );
    service = new ConversationLifecycleService(
      mockDialClient,
      mockUserConfigService as never,
      persistenceService,
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

  describe('encoded conversation resource paths — mutations', () => {
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
  });

  describe('DIAL SDK error status propagation', () => {
    beforeEach(async () => {
      const actual = await vi.importActual<
        typeof import('../../../common/dial/dial-error.mapper')
      >('../../../common/dial/dial-error.mapper');
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
