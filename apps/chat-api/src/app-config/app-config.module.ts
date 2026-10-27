import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { CompositeConfigProvider } from './config-registry/composite-config.provider';
import { EnvConfigProvider } from './config-registry/env-config.provider';
import { StaticDefaultsProvider } from './config-registry/static-defaults.provider';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';
import { FeatureGuard } from './feature-flags/feature.guard';

@Module({
  imports: [AuthModule],
  controllers: [AppConfigController],
  providers: [
    EnvConfigProvider,
    StaticDefaultsProvider,
    CompositeConfigProvider,
    AppConfigService,
    FeatureFlagsService,
    FeatureGuard,
  ],
  /* Nest instantiates `@UseGuards(FeatureGuard)` in each consumer module's
   * injector, so the guard's own dependencies — including AuthModule's
   * `UserRolesService` — must be visible there too. */
  exports: [AppConfigService, FeatureFlagsService, FeatureGuard, AuthModule],
})
export class AppConfigModule {}
