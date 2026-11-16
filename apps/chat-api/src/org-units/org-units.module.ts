import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { OrgUnitsController } from './org-units.controller';
import { OrgUnitsService } from './org-units.service';

@Module({
  imports: [AppConfigModule],
  controllers: [OrgUnitsController],
  providers: [OrgUnitsService],
})
export class OrgUnitsModule {}
