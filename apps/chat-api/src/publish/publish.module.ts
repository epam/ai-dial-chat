import { Module } from '@nestjs/common';
import { ApplicationSchemasModule } from '../application-schemas/application-schemas.module';
import { AuthModule } from '../auth/auth.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ToolsetsListingModule } from '../toolsets/listing/toolsets-listing.module';
import { ApplicationDependencyResolver } from './dependencies/application-dependency.resolver';
import { PublishDependenciesService } from './dependencies/publish-dependencies.service';
import { PublishDependenciesController } from './publish-dependencies.controller';
import { PublishRulesController } from './publish-rules.controller';
import { PublishRulesService } from './publish-rules.service';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { VersionStatusesService } from './version-statuses.service';

@Module({
  imports: [
    AuthModule,
    ApplicationSchemasModule,
    DeploymentsModule,
    ToolsetsListingModule,
  ],
  controllers: [
    PublishController,
    PublishDependenciesController,
    PublishRulesController,
  ],
  providers: [
    PublishService,
    VersionStatusesService,
    PublishRulesService,
    PublishDependenciesService,
    ApplicationDependencyResolver,
  ],
})
export class PublishModule {}
