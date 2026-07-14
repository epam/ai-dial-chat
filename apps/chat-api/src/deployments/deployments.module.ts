import { Module } from '@nestjs/common';
import { UserConfigModule } from '../user-config/user-config.module';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';

@Module({
  imports: [UserConfigModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
