import { Injectable } from '@nestjs/common';
import { ScheduledTaskUnreadService } from '../scheduled-task-unread/scheduled-task-unread.service';
import { ConversationNamingService } from './conversation-naming.service';
import { ConversationLifecycleService } from './lifecycle/conversation-lifecycle.service';
import { ConversationListingService } from './listing/conversation-listing.service';
import { ConversationPersistenceService } from './persistence/conversation-persistence.service';
import { ConversationStreamingService } from './streaming/conversation-streaming.service';
import {
  buildConversationUrl,
  qualifySessionConversationPath,
} from './utils/conversation.utils';

/*
 * Thin orchestrator for ConversationController. Every method here delegates
 * to exactly one of the four focused conversation services below — see
 * openspec/changes/split-conversation-service/design.md for the ownership
 * map and why the split follows this boundary. Pure 1:1 delegates are bound
 * property references; only `generateTitle`/`markConversationViewed` carry
 * a line of glue (path qualification / URL building) so they stay as methods.
 */
@Injectable()
export class ConversationService {
  constructor(
    private readonly persistenceService: ConversationPersistenceService,
    private readonly listingService: ConversationListingService,
    private readonly lifecycleService: ConversationLifecycleService,
    private readonly streamingService: ConversationStreamingService,
    private readonly conversationNamingService: ConversationNamingService,
    private readonly scheduledTaskUnreadService: ScheduledTaskUnreadService,
  ) {}

  // Persistence
  getConversation = this.persistenceService.getConversation.bind(
    this.persistenceService,
  );
  saveConversation = this.persistenceService.saveConversation.bind(
    this.persistenceService,
  );

  // Listing
  listConversations = this.listingService.listConversations.bind(
    this.listingService,
  );
  getConversationMetadata = this.listingService.getConversationMetadata.bind(
    this.listingService,
  );

  // Lifecycle
  createConversation = this.lifecycleService.createConversation.bind(
    this.lifecycleService,
  );
  deleteConversation = this.lifecycleService.deleteConversation.bind(
    this.lifecycleService,
  );
  renameConversation = this.lifecycleService.renameConversation.bind(
    this.lifecycleService,
  );
  duplicateConversation = this.lifecycleService.duplicateConversation.bind(
    this.lifecycleService,
  );
  pinConversation = this.lifecycleService.pinConversation.bind(
    this.lifecycleService,
  );
  deleteConversations = this.lifecycleService.deleteConversations.bind(
    this.lifecycleService,
  );
  deleteAllConversations = this.lifecycleService.deleteAllConversations.bind(
    this.lifecycleService,
  );

  // Streaming
  streamCompletion = this.streamingService.streamCompletion.bind(
    this.streamingService,
  );
  watchConversation = this.streamingService.watchConversation.bind(
    this.streamingService,
  );

  // Thin pass-throughs to already-independent services — each needs one
  // line of glue (path qualification / URL building), so it stays a method
  // rather than a bound property.

  generateTitle(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<string> {
    const qualifiedPath = qualifySessionConversationPath(
      conversationPath,
      bucket,
    );
    return this.conversationNamingService.generateTitle(
      qualifiedPath,
      token,
      bucket,
    );
  }

  markConversationViewed(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    return this.scheduledTaskUnreadService.markViewed(
      buildConversationUrl(bucket, conversationPath),
      token,
      bucket,
    );
  }
}
