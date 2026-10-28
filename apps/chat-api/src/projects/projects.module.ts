import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AppConfigModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
