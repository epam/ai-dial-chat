import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ConversationNamingService } from './conversation-naming.service';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [UserConfigModule, AppConfigModule],
  controllers: [ConversationController],
  providers: [ConversationService, ConversationNamingService],
})
export class ConversationModule {}
