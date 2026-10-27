import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { UserRolesService } from '../../../auth/user-roles.service';
import { ClientChannelModule } from '../../../client-channel/client-channel.module';
import { DialClientService } from '../../../dial/dial-client.service';
import { ExternalServicesModule } from '../../../external-services/external-services.module';
import { OfflineCredentialsModule } from '../../../offline-credentials/offline-credentials.module';
import { ScheduledTasksModule } from '../../../scheduled-tasks/scheduled-tasks.module';
import { FeatureGuard } from '../../feature-flags/feature.guard';

/* Stands in for the global DialCoreModule; the guard graph never calls Core. */
@Global()
@Module({
  providers: [{ provide: DialClientService, useValue: {} }],
  exports: [DialClientService],
})
class FakeDialCoreModule {}

/*
 * Compiles the real modules whose controllers apply `@UseGuards(FeatureGuard)`,
 * so Nest instantiates the guard in each consumer's injector exactly as in
 * production. A provider missing from that graph (for example, the shared
 * `UserRolesService`) fails `compile()` here instead of at boot.
 */
describe('FeatureGuard module graph', () => {
  it('resolves FeatureGuard with the shared role reader for every consumer module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CacheModule.register({ isGlobal: true }),
        FakeDialCoreModule,
        ClientChannelModule,
        ExternalServicesModule,
        OfflineCredentialsModule,
        ScheduledTasksModule,
      ],
    }).compile();

    expect(moduleRef.get(FeatureGuard, { strict: false })).toBeInstanceOf(
      FeatureGuard,
    );
    expect(moduleRef.get(UserRolesService, { strict: false })).toBeInstanceOf(
      UserRolesService,
    );

    await moduleRef.close();
  });
});
