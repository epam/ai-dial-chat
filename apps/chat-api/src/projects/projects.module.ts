import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { ConversationModule } from '../conversations/conversation.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ProjectConversationsListService } from './conversations/project-conversations-list.service';
import { ProjectConversationsController } from './conversations/project-conversations.controller';
import { ProjectConversationsService } from './conversations/project-conversations.service';
import { ProjectsCreateService } from './create/projects-create.service';
import { ProjectsDownloadService } from './download/projects-download.service';
import { ProjectContextUploadInterceptor } from './project-context-upload.interceptor';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsSnapshotService } from './snapshot/projects-snapshot.service';
import { ProjectsUpdateService } from './update/projects-update.service';
import { ProjectsWatchService } from './watch/projects-watch.service';

@Module({
  imports: [AppConfigModule, UserConfigModule, ConversationModule],
  controllers: [ProjectsController, ProjectConversationsController],
  providers: [
    ProjectsService,
    ProjectsCreateService,
    ProjectsDownloadService,
    ProjectsSnapshotService,
    ProjectsUpdateService,
    ProjectsWatchService,
    ProjectContextUploadInterceptor,
    ProjectConversationsService,
    ProjectConversationsListService,
  ],
})
export class ProjectsModule {}
