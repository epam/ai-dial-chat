import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { CompositeConfigProvider } from './config-registry/composite-config.provider';
import { EnvConfigProvider } from './config-registry/env-config.provider';
import { StaticDefaultsProvider } from './config-registry/static-defaults.provider';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';

@Module({
  imports: [AuthModule],
  controllers: [AppConfigController],
  providers: [
    EnvConfigProvider,
    StaticDefaultsProvider,
    CompositeConfigProvider,
    AppConfigService,
    FeatureFlagsService,
  ],
  exports: [AppConfigService, FeatureFlagsService],
})
export class AppConfigModule {}
