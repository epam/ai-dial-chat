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
import { AUTH_STRATEGIES } from './strategies/auth-strategies.token';
import { CookieSessionStrategy } from './strategies/cookie-session.strategy';
import { HeaderTokenStrategy } from './strategies/header-token.strategy';

@Module({
  controllers: [AuthController],
  providers: [
    KeysService,
    OptionalSessionGuard,
    SessionService,
    RefreshService,
    ProviderRegistryService,
    BucketService,
    HeaderTokenStrategy,
    CookieSessionStrategy,
    {
      provide: AUTH_STRATEGIES,
      useFactory: (
        headerStrategy: HeaderTokenStrategy,
        cookieStrategy: CookieSessionStrategy,
      ) => [headerStrategy, cookieStrategy],
      inject: [HeaderTokenStrategy, CookieSessionStrategy],
    },
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
  exports: [OptionalSessionGuard, SessionService, KeysService, AUTH_STRATEGIES],
})
export class AuthModule {}
