import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ExternalServicesModule } from '../external-services/external-services.module';
import { ScheduledTasksController } from './scheduled-tasks.controller';
import { ScheduledTasksService } from './scheduled-tasks.service';

@Module({
  imports: [AppConfigModule, DeploymentsModule, ExternalServicesModule],
  controllers: [ScheduledTasksController],
  providers: [ScheduledTasksService],
  exports: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
