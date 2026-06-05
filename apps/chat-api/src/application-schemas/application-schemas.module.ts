import { Module } from '@nestjs/common';
import { ApplicationSchemasController } from './application-schemas.controller';
import { ApplicationSchemasService } from './application-schemas.service';

@Module({
  controllers: [ApplicationSchemasController],
  providers: [ApplicationSchemasService],
})
export class ApplicationSchemasModule {}
