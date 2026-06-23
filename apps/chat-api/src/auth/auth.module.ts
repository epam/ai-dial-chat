import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { BucketService } from './bucket/bucket.service';
import { CsrfGuard } from './csrf/csrf.guard';
import { KeysService } from './keys/keys.service';
import { ProviderRegistryService } from './providers/provider-registry.service';
import { RefreshService } from './refresh/refresh.service';
import { OptionalSessionGuard } from './session/optional-session.guard';
import { SessionGuard } from './session/session.guard';
import { SessionService } from './session/session.service';

@Module({
  controllers: [AuthController],
  providers: [
    KeysService,
    OptionalSessionGuard,
    SessionService,
    RefreshService,
    ProviderRegistryService,
    BucketService,
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
  exports: [OptionalSessionGuard, SessionService, KeysService],
})
export class AuthModule {}
