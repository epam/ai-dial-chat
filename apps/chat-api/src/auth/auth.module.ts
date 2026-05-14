import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { CsrfGuard } from './csrf.guard';
import { KeysService } from './keys.service';
import { ProviderRegistryService } from './provider-registry.service';
import { RefreshService } from './refresh.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [
    KeysService,
    SessionService,
    RefreshService,
    ProviderRegistryService,
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
  exports: [SessionService, KeysService],
})
export class AuthModule {}
