import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ExplicitEnvironment } from '../config/explicit-environment';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { CompositeConfigProvider } from './config-registry/composite-config.provider';
import { EnvConfigProvider } from './config-registry/env-config.provider';
import { StaticDefaultsProvider } from './config-registry/static-defaults.provider';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';
import { FeatureGuard } from './feature-flags/feature.guard';
import { ManagedConfigProvider } from './managed-runtime/managed-config.provider';
import { ManagedRuntimeService } from './managed-runtime/managed-runtime.service';
import {
  MANAGED_RUNTIME_CLOCK,
  systemManagedRuntimeClock,
} from './managed-runtime/refresh-scheduler';
import { ManagedShadowComparator } from './managed-runtime/shadow-comparison';
import { ManagedSnapshotReader } from './managed-runtime/snapshot-reader';

@Module({
  imports: [AuthModule],
  controllers: [AppConfigController],
  providers: [
    /* Which variables the operator set, captured by validate() before class
     * defaults applied; EnvConfigProvider ignores the rest. */
    {
      provide: ExplicitEnvironment,
      inject: [ConfigService],
      useFactory: ExplicitEnvironment.fromConfigService,
    },
    EnvConfigProvider,
    StaticDefaultsProvider,
    { provide: MANAGED_RUNTIME_CLOCK, useValue: systemManagedRuntimeClock },
    ManagedSnapshotReader,
    ManagedRuntimeService,
    ManagedConfigProvider,
    ManagedShadowComparator,
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
