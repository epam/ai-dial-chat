import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import type { EnvironmentVariables } from '../config/environment.config';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

const { memoryStorage } = require('multer') as { memoryStorage: () => unknown };

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables>) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: config.get<number>('FILE_UPLOAD_MAX_BYTES') ?? 536_870_912,
        },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
