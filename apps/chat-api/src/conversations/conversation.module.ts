import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ConversationGenerationService } from './conversation-generation.service';
import { ConversationNamingService } from './conversation-naming.service';
import { CONVERSATION_PERSISTENCE } from './conversation-persistence.port';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [UserConfigModule, AppConfigModule],
  controllers: [ConversationController],
  providers: [
    ConversationService,
    ConversationNamingService,
    {
      provide: CONVERSATION_PERSISTENCE,
      useExisting: ConversationService,
    },
    ConversationGenerationService,
  ],
})
export class ConversationModule {}
