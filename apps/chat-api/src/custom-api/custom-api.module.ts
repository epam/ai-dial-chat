import { Module } from '@nestjs/common';
import { CustomApiAdmissionService } from './custom-api-admission.service';
import { CustomApiRegistryService } from './custom-api-registry.service';
import { CustomApiController } from './custom-api.controller';
import { CustomApiService } from './custom-api.service';

@Module({
  controllers: [CustomApiController],
  providers: [
    CustomApiRegistryService,
    CustomApiService,
    CustomApiAdmissionService,
  ],
  exports: [CustomApiRegistryService],
})
export class CustomApiModule {}
