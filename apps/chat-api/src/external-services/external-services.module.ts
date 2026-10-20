import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { ExternalServicesController } from './external-services.controller';
import { ExternalServicesService } from './external-services.service';
import { SchedulerConsentService } from './scheduler-consent.service';

@Module({
  imports: [AppConfigModule],
  controllers: [ExternalServicesController],
  providers: [ExternalServicesService, SchedulerConsentService],
  exports: [ExternalServicesService, SchedulerConsentService],
})
export class ExternalServicesModule {}
