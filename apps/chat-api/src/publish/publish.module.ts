import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { ApplicationSchemasModule } from '../application-schemas/application-schemas.module';
import { ApplicationsModule } from '../applications/applications.module';
import { AuthModule } from '../auth/auth.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ToolsetsListingModule } from '../toolsets/listing/toolsets-listing.module';
import { ApplicationPublishCopyService } from './application-publish-copy.service';
import { ApplicationPublishPreparationService } from './application-publish-preparation.service';
import { ApplicationDependencyResolver } from './dependencies/application-dependency.resolver';
import { PublishDependenciesService } from './dependencies/publish-dependencies.service';
import { OrgUnitCopyService } from './org-unit-copy.service';
import { PublishDependenciesController } from './publish-dependencies.controller';
import { PublishRulesController } from './publish-rules.controller';
import { PublishRulesService } from './publish-rules.service';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { VersionStatusesService } from './version-statuses.service';

@Module({
  imports: [
    AppConfigModule,
    ApplicationsModule,
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
    ApplicationPublishCopyService,
    ApplicationPublishPreparationService,
    OrgUnitCopyService,
    VersionStatusesService,
    PublishRulesService,
    PublishDependenciesService,
    ApplicationDependencyResolver,
  ],
})
export class PublishModule {}
