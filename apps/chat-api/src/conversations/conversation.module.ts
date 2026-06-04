import { Module } from '@nestjs/common';
import { UserConfigModule } from '../user-config/user-config.module';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [UserConfigModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
