import { Module } from '@nestjs/common';
import { DeploymentRouteController } from './deployment-route.controller';

@Module({
  controllers: [DeploymentRouteController],
})
export class DeploymentRouteModule {}
