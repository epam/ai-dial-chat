import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { ExternalServicesController } from './external-services.controller';
import { ExternalServicesService } from './external-services.service';

@Module({
  imports: [AppConfigModule],
  controllers: [ExternalServicesController],
  providers: [ExternalServicesService],
})
export class ExternalServicesModule {}
