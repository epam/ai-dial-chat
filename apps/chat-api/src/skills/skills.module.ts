import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { EnvironmentVariables } from '../config/environment.config';
import { SkillsDownloadService } from './download/skills-download.service';
import { SkillsListingService } from './listing/skills-listing.service';
import { SkillsLookupService } from './lookup/skills-lookup.service';
import { SkillsMutationService } from './mutation/skills-mutation.service';
import { SkillsPackageService } from './package/skills-package.service';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { SkillsUploadService } from './upload/skills-upload.service';

/*
 * MulterModule's ingress limits now bound discrete multipart parts (no ZIP
 * is ever uploaded on the create/update path — see design.md): `fileSize`
 * caps each individual `files` part at the per-file limit, `fieldSize`
 * covers the `skillManifest` text field at the same limit (SKILL.md is
 * subject to the same per-file cap), and `files` bounds the number of
 * repeated file parts at the file-count limit. SkillsPackageService
 * re-enforces all of these against the actually-received bytes/count, since
 * Multer's own limits reject mid-stream with a generic error rather than the
 * BFF's typed exceptions.
 */
@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables>) => {
        const maxFileBytes =
          config.get<number>('SKILL_FILE_UPLOAD_MAX_BYTES') ?? 1_048_576;
        return {
          storage: memoryStorage(),
          limits: {
            fileSize: maxFileBytes,
            fieldSize: maxFileBytes,
            files: config.get<number>('SKILL_UPLOAD_MAX_FILES') ?? 100,
          },
        };
      },
    }),
  ],
  controllers: [SkillsController],
  providers: [
    SkillsService,
    SkillsListingService,
    SkillsLookupService,
    SkillsPackageService,
    SkillsDownloadService,
    SkillsUploadService,
    SkillsMutationService,
  ],
  exports: [SkillsService, SkillsLookupService],
})
export class SkillsModule {}
