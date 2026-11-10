import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { FilesListingModule } from '../files/listing/files-listing.module';
import { ScheduledTaskUnreadModule } from '../scheduled-task-unread/scheduled-task-unread.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ConversationGenerationController } from './conversation-generation.controller';
import { CONVERSATION_PERSISTENCE } from './conversation-persistence.port';
import { ConversationPublishAttachmentsService } from './conversation-publish-attachments.service';
import { ConversationPublishDependenciesController } from './conversation-publish-dependencies.controller';
import { ConversationPublishDependenciesService } from './conversation-publish-dependencies.service';
import { ConversationPublishController } from './conversation-publish.controller';
import { ConversationPublishService } from './conversation-publish.service';
import { ConversationTitlesController } from './conversation-titles.controller';
import { ConversationWatchController } from './conversation-watch.controller';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { BackgroundGenerationService } from './generation/background-generation.service';
import { ChatCompletionsAdapter } from './generation/chat-completions.adapter';
import { ConversationGenerationService } from './generation/conversation-generation.service';
import { CoreResponsesClient } from './generation/core-responses.client';
import { GenerationApiSelector } from './generation/generation-api-selector.service';
import { ResponsesAdapter } from './generation/responses.adapter';
import { ConversationLifecycleService } from './lifecycle/conversation-lifecycle.service';
import { ConversationListingService } from './listing/conversation-listing.service';
import { ConversationTitleCacheService } from './listing/conversation-title-cache.service';
import { ConversationTitleStreamService } from './listing/conversation-title-stream.service';
import { ConversationTitlesService } from './listing/conversation-titles.service';
import { ConversationNamingService } from './naming/conversation-naming.service';
import { ConversationPersistenceService } from './persistence/conversation-persistence.service';
import { ProjectConversationStore } from './persistence/project-conversation.store';
import { PublishedFolderAttachmentsService } from './published-folder-attachments.service';
import { ConversationCompletionsResponder } from './streaming/conversation-completions.responder';
import { ConversationStreamingService } from './streaming/conversation-streaming.service';

@Module({
  imports: [
    UserConfigModule,
    ScheduledTaskUnreadModule,
    AppConfigModule,
    DeploymentsModule,
    FilesListingModule,
  ],
  controllers: [
    ConversationController,
    ConversationGenerationController,
    ConversationTitlesController,
    ConversationWatchController,
    ConversationPublishController,
    ConversationPublishDependenciesController,
  ],
  providers: [
    ConversationService,
    ConversationPersistenceService,
    ProjectConversationStore,
    ConversationListingService,
    ConversationTitleCacheService,
    ConversationTitlesService,
    ConversationTitleStreamService,
    ConversationLifecycleService,
    ConversationStreamingService,
    ConversationCompletionsResponder,
    ConversationNamingService,
    {
      provide: CONVERSATION_PERSISTENCE,
      useExisting: ConversationPersistenceService,
    },
    ConversationGenerationService,
    ConversationPublishService,
    ConversationPublishAttachmentsService,
    ConversationPublishDependenciesService,
    PublishedFolderAttachmentsService,
    ChatCompletionsAdapter,
    GenerationApiSelector,
    ResponsesAdapter,
    CoreResponsesClient,
    BackgroundGenerationService,
  ],
  /* For the project conversation endpoints; `ConversationModule` never imports `ProjectsModule`. */
  exports: [
    ConversationService,
    ProjectConversationStore,
    ConversationCompletionsResponder,
  ],
})
export class ConversationModule {}
