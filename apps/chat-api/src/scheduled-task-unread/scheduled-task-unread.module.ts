import { Module } from '@nestjs/common';
import { ConversationReadStateService } from './conversation-read-state.service';
import { ScheduledTaskUnreadService } from './scheduled-task-unread.service';

@Module({
  providers: [ScheduledTaskUnreadService, ConversationReadStateService],
  exports: [ScheduledTaskUnreadService, ConversationReadStateService],
})
export class ScheduledTaskUnreadModule {}
