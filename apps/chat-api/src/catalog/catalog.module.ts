import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { ModelsModule } from '../models/models.module';
import { CatalogFilterService } from './catalog-filter.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [ModelsModule, ApplicationsModule],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogFilterService],
})
export class CatalogModule {}
