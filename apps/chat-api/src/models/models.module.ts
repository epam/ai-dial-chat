import { Module } from '@nestjs/common';
import { ModelCatalogController } from './catalog/model-catalog.controller';
import { ModelCatalogService } from './catalog/model-catalog.service';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  controllers: [ModelsController, ModelCatalogController],
  providers: [ModelsService, ModelCatalogService],
  exports: [ModelsService],
})
export class ModelsModule {}
