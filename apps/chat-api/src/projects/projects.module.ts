import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ProjectsCreateService } from './create/projects-create.service';
import { ProjectsDownloadService } from './download/projects-download.service';
import { ProjectContextUploadInterceptor } from './project-context-upload.interceptor';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsSnapshotService } from './snapshot/projects-snapshot.service';
import { ProjectsUpdateService } from './update/projects-update.service';

@Module({
  imports: [AppConfigModule, UserConfigModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsCreateService,
    ProjectsDownloadService,
    ProjectsSnapshotService,
    ProjectsUpdateService,
    ProjectContextUploadInterceptor,
  ],
})
export class ProjectsModule {}
