import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { KeysService } from './keys.service';
import { ProviderRegistryService } from './provider-registry.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [
    KeysService,
    SessionService,
    SessionGuard,
    ProviderRegistryService,
  ],
  exports: [SessionService, SessionGuard, KeysService],
})
export class AuthModule {}
