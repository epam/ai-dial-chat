import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { ProjectsCreateService } from './create/projects-create.service';
import { ProjectContextUploadInterceptor } from './project-context-upload.interceptor';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AppConfigModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsCreateService,
    ProjectContextUploadInterceptor,
  ],
})
export class ProjectsModule {}
