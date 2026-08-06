import { Module } from '@nestjs/common';
import { ScheduledTaskUnreadService } from './scheduled-task-unread.service';

@Module({
  providers: [ScheduledTaskUnreadService],
  exports: [ScheduledTaskUnreadService],
})
export class ScheduledTaskUnreadModule {}
