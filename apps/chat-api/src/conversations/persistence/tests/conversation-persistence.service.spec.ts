import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleDialSdkError } from '../../../common/dial/dial-error.mapper';
import type { DialClientService } from '../../../dial/dial-client.service';
import { ConversationMessageRole } from '../../dto/conversation-message.dto';
import { ConversationPersistenceService } from '../conversation-persistence.service';

vi.mock('../../../common/dial/dial-error.mapper', () => ({
  handleDialSdkError: vi.fn(),
}));

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

describe('ConversationPersistenceService', () => {
  let service: ConversationPersistenceService;
  let mockDialClient: DialClientService;
  let mockConversationNamingService: {
    maybeRenameAfterFirstReply: ReturnType<typeof vi.fn>;
  };

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
    mockConversationNamingService = {
      maybeRenameAfterFirstReply: vi.fn(),
    };
    service = new ConversationPersistenceService(
      mockDialClient,
      mockConversationNamingService as never,
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

  describe('encoded conversation resource paths — saveConversation', () => {
    const conversationPath =
      'applications/catalog/Team%2FApp%20One__0.0.1__hello';

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

  describe('DIAL SDK error status propagation', () => {
    beforeEach(async () => {
      const actual = await vi.importActual<
        typeof import('../../../common/dial/dial-error.mapper')
      >('../../../common/dial/dial-error.mapper');
      vi.mocked(handleDialSdkError).mockImplementation(
        actual.handleDialSdkError,
      );
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
  });
});
