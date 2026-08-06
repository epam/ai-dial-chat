import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { ScheduledTaskUnreadModule } from '../scheduled-task-unread/scheduled-task-unread.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ConversationGenerationService } from './conversation-generation.service';
import { ConversationNamingService } from './conversation-naming.service';
import { CONVERSATION_PERSISTENCE } from './conversation-persistence.port';
import { ConversationPublishController } from './conversation-publish.controller';
import { ConversationPublishService } from './conversation-publish.service';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [UserConfigModule, ScheduledTaskUnreadModule, AppConfigModule],
  controllers: [ConversationController, ConversationPublishController],
  providers: [
    ConversationService,
    ConversationNamingService,
    {
      provide: CONVERSATION_PERSISTENCE,
      useExisting: ConversationService,
    },
    ConversationGenerationService,
    ConversationPublishService,
  ],
})
export class ConversationModule {}
