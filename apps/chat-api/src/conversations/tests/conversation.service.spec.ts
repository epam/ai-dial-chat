import { describe, expect, it, vi } from 'vitest';
import { ConversationService } from '../conversation.service';
import { CompletionMode } from '../dto/send-completion.dto';

/*
 * ConversationService is a pure delegation facade — its business logic now
 * lives in ConversationPersistenceService, ConversationListingService,
 * ConversationLifecycleService, and ConversationStreamingService (see
 * openspec/changes/split-conversation-service/design.md). These tests only
 * verify each facade method forwards to the right sub-service unchanged;
 * behavior is covered by that sub-service's own spec.
 */
describe('ConversationService facade', () => {
  const makeService = () => {
    const persistenceService = {
      getConversation: vi.fn().mockResolvedValue('persistence-get'),
      saveConversation: vi.fn().mockResolvedValue('persistence-save'),
    };
    const listingService = {
      listConversations: vi.fn().mockResolvedValue('listing-list'),
      getConversationMetadata: vi.fn().mockResolvedValue('listing-metadata'),
    };
    const lifecycleService = {
      createConversation: vi.fn().mockResolvedValue('lifecycle-create'),
      deleteConversation: vi.fn().mockResolvedValue(undefined),
      renameConversation: vi.fn().mockResolvedValue('lifecycle-rename'),
      duplicateConversation: vi.fn().mockResolvedValue('lifecycle-duplicate'),
      pinConversation: vi.fn().mockResolvedValue(undefined),
      deleteConversations: vi.fn().mockResolvedValue('lifecycle-delete-many'),
      deleteAllConversations: vi.fn().mockResolvedValue('lifecycle-delete-all'),
    };
    async function* fakeStream() {
      yield new Uint8Array();
    }
    const streamingService = {
      streamCompletion: vi.fn().mockReturnValue(fakeStream()),
      watchConversation: vi.fn().mockResolvedValue('streaming-watch'),
    };
    const conversationNamingService = {
      generateTitle: vi.fn().mockResolvedValue('naming-generate-title'),
    };
    const scheduledTaskUnreadService = {
      markViewed: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ConversationService(
      persistenceService as never,
      listingService as never,
      lifecycleService as never,
      streamingService as never,
      conversationNamingService as never,
      scheduledTaskUnreadService as never,
    );

    return {
      service,
      persistenceService,
      listingService,
      lifecycleService,
      streamingService,
      conversationNamingService,
      scheduledTaskUnreadService,
    };
  };

  it('delegates getConversation to ConversationPersistenceService', async () => {
    const { service, persistenceService } = makeService();

    const result = await service.getConversation('path', 'token', 'bucket');

    expect(persistenceService.getConversation).toHaveBeenCalledWith(
      'path',
      'token',
      'bucket',
    );
    expect(result).toBe('persistence-get');
  });

  it('delegates saveConversation to ConversationPersistenceService', async () => {
    const { service, persistenceService } = makeService();
    const conversation = { id: 'conv' } as never;

    const result = await service.saveConversation(
      'path',
      'token',
      'bucket',
      conversation,
    );

    expect(persistenceService.saveConversation).toHaveBeenCalledWith(
      'path',
      'token',
      'bucket',
      conversation,
    );
    expect(result).toBe('persistence-save');
  });

  it('delegates listConversations to ConversationListingService', async () => {
    const { service, listingService } = makeService();

    const result = await service.listConversations(
      'token',
      'bucket',
      50,
      'cursor',
    );

    expect(listingService.listConversations).toHaveBeenCalledWith(
      'token',
      'bucket',
      50,
      'cursor',
    );
    expect(result).toBe('listing-list');
  });

  it('delegates getConversationMetadata to ConversationListingService', async () => {
    const { service, listingService } = makeService();

    const result = await service.getConversationMetadata(
      'path',
      'token',
      'bucket',
      true,
    );

    expect(listingService.getConversationMetadata).toHaveBeenCalledWith(
      'path',
      'token',
      'bucket',
      true,
    );
    expect(result).toBe('listing-metadata');
  });

  it('delegates createConversation to ConversationLifecycleService', async () => {
    const { service, lifecycleService } = makeService();

    const result = await service.createConversation(
      'first message',
      'token',
      'bucket',
      'deployment-id',
      { form_value: {} } as never,
    );

    expect(lifecycleService.createConversation).toHaveBeenCalledWith(
      'first message',
      'token',
      'bucket',
      'deployment-id',
      { form_value: {} },
    );
    expect(result).toBe('lifecycle-create');
  });

  it('delegates deleteConversation to ConversationLifecycleService', async () => {
    const { service, lifecycleService } = makeService();

    await service.deleteConversation('path', 'token', 'bucket');

    expect(lifecycleService.deleteConversation).toHaveBeenCalledWith(
      'path',
      'token',
      'bucket',
    );
  });

  it('delegates renameConversation to ConversationLifecycleService', async () => {
    const { service, lifecycleService } = makeService();

    const result = await service.renameConversation(
      'path',
      'new title',
      'token',
      'bucket',
    );

    expect(lifecycleService.renameConversation).toHaveBeenCalledWith(
      'path',
      'new title',
      'token',
      'bucket',
    );
    expect(result).toBe('lifecycle-rename');
  });

  it('delegates duplicateConversation to ConversationLifecycleService', async () => {
    const { service, lifecycleService } = makeService();

    const result = await service.duplicateConversation(
      'source-path',
      'token',
      'bucket',
    );

    expect(lifecycleService.duplicateConversation).toHaveBeenCalledWith(
      'source-path',
      'token',
      'bucket',
    );
    expect(result).toBe('lifecycle-duplicate');
  });

  it('delegates pinConversation to ConversationLifecycleService', async () => {
    const { service, lifecycleService } = makeService();

    await service.pinConversation('conv-id', true, 'token', 'bucket');

    expect(lifecycleService.pinConversation).toHaveBeenCalledWith(
      'conv-id',
      true,
      'token',
      'bucket',
    );
  });

  it('delegates deleteConversations to ConversationLifecycleService', async () => {
    const { service, lifecycleService } = makeService();

    const result = await service.deleteConversations(
      ['a', 'b'],
      'token',
      'bucket',
    );

    expect(lifecycleService.deleteConversations).toHaveBeenCalledWith(
      ['a', 'b'],
      'token',
      'bucket',
    );
    expect(result).toBe('lifecycle-delete-many');
  });

  it('delegates deleteAllConversations to ConversationLifecycleService', async () => {
    const { service, lifecycleService } = makeService();

    const result = await service.deleteAllConversations('token', 'bucket');

    expect(lifecycleService.deleteAllConversations).toHaveBeenCalledWith(
      'token',
      'bucket',
    );
    expect(result).toBe('lifecycle-delete-all');
  });

  it('delegates streamCompletion to ConversationStreamingService', async () => {
    const { service, streamingService } = makeService();
    const onReadyToStream = vi.fn();

    const chunks: Uint8Array[] = [];
    for await (const chunk of service.streamCompletion(
      'path',
      'token',
      'bucket',
      'gen-id',
      CompletionMode.Append,
      'message',
      undefined,
      'model',
      undefined,
      'session-id',
      onReadyToStream,
      'user-id',
      'channel-id',
    )) {
      chunks.push(chunk);
    }

    expect(streamingService.streamCompletion).toHaveBeenCalledWith(
      'path',
      'token',
      'bucket',
      'gen-id',
      CompletionMode.Append,
      'message',
      undefined,
      'model',
      undefined,
      'session-id',
      onReadyToStream,
      'user-id',
      'channel-id',
    );
    expect(chunks).toHaveLength(1);
  });

  it('delegates watchConversation to ConversationStreamingService', async () => {
    const { service, streamingService } = makeService();

    const result = await service.watchConversation('path', 'token', 'bucket');

    expect(streamingService.watchConversation).toHaveBeenCalledWith(
      'path',
      'token',
      'bucket',
    );
    expect(result).toBe('streaming-watch');
  });

  it('delegates generateTitle to ConversationNamingService with a session-qualified path', async () => {
    const { service, conversationNamingService } = makeService();

    const result = await service.generateTitle(
      'gpt-4o__Chat',
      'token',
      'test-bucket',
    );

    expect(conversationNamingService.generateTitle).toHaveBeenCalledWith(
      'test-bucket/gpt-4o__Chat',
      'token',
      'test-bucket',
    );
    expect(result).toBe('naming-generate-title');
  });

  it('delegates markConversationViewed to ScheduledTaskUnreadService with the conversation resource URL', async () => {
    const { service, scheduledTaskUnreadService } = makeService();

    await service.markConversationViewed(
      'gpt-4o__Chat',
      'token',
      'test-bucket',
    );

    expect(scheduledTaskUnreadService.markViewed).toHaveBeenCalledWith(
      'conversations/test-bucket/gpt-4o__Chat',
      'token',
      'test-bucket',
    );
  });
});
