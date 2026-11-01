import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ExternalServicesModule } from '../external-services/external-services.module';
import { ScheduledTaskCompletionService } from './scheduled-task-completion.service';
import { ScheduledTaskPreconditionsService } from './scheduled-task-preconditions.service';
import { ScheduledTaskRunsService } from './scheduled-task-runs.service';
import { ScheduledTasksListCacheService } from './scheduled-tasks-list-cache.service';
import { ScheduledTasksController } from './scheduled-tasks.controller';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { SchedulerUpstreamClient } from './scheduler-upstream.client';

@Module({
  imports: [AppConfigModule, DeploymentsModule, ExternalServicesModule],
  controllers: [ScheduledTasksController],
  providers: [
    ScheduledTasksService,
    SchedulerUpstreamClient,
    ScheduledTasksListCacheService,
    ScheduledTaskCompletionService,
    ScheduledTaskRunsService,
    ScheduledTaskPreconditionsService,
  ],
  exports: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
