import { Module } from '@nestjs/common';
import { CelebrationCatalogService } from './celebration-catalog.service';
import { CelebrationsUpstreamReader } from './celebrations-upstream.reader';
import { CelebrationsController } from './celebrations.controller';
import { ImmutableResourceStore } from './immutable-resource.store';

@Module({
  controllers: [CelebrationsController],
  providers: [
    CelebrationCatalogService,
    CelebrationsUpstreamReader,
    {
      provide: ImmutableResourceStore,
      useFactory: () => new ImmutableResourceStore(),
    },
  ],
})
export class CelebrationsModule {}
