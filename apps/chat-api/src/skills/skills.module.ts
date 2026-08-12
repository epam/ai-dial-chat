import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { EnvironmentVariables } from '../config/environment.config';
import { SkillsDownloadService } from './download/skills-download.service';
import { SkillsListingService } from './listing/skills-listing.service';
import { SkillsLookupService } from './lookup/skills-lookup.service';
import { SkillsMutationService } from './mutation/skills-mutation.service';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { SkillsUploadService } from './upload/skills-upload.service';

/*
 * MulterModule is bound to SKILL_UPLOAD_MAX_BYTES (the larger of the two
 * upload limits, since it must cover the whole-skill ZIP upload route);
 * SkillsUploadService additionally enforces the smaller
 * SKILL_FILE_UPLOAD_MAX_BYTES cap for the single-file upload route at the
 * application level, mirroring how FilesModule's ArchiveUploadInterceptor
 * enforces a second, differently-sized limit alongside its module-level
 * MulterModule registration.
 */
@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables>) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: config.get<number>('SKILL_UPLOAD_MAX_BYTES') ?? 104_857_600,
        },
      }),
    }),
  ],
  controllers: [SkillsController],
  providers: [
    SkillsService,
    SkillsListingService,
    SkillsLookupService,
    SkillsDownloadService,
    SkillsUploadService,
    SkillsMutationService,
  ],
  exports: [SkillsService, SkillsLookupService],
})
export class SkillsModule {}
