import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { IsAllowedRedirectUriConstraint } from './dto/offline-credentials.dto';
import { OfflineCredentialsController } from './offline-credentials.controller';
import { OfflineCredentialsService } from './offline-credentials.service';

@Module({
  imports: [AppConfigModule],
  controllers: [OfflineCredentialsController],
  providers: [OfflineCredentialsService, IsAllowedRedirectUriConstraint],
})
export class OfflineCredentialsModule {}
