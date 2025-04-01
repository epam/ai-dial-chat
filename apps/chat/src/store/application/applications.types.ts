import {
  ApplicationLogsType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { FolderInterface } from '@/src/types/folder';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface ApplicationState {
  appLoading: UploadStatus;
  logsLoadingStatus: UploadStatus;
  appDetails: CustomApplicationModel | undefined;
  appLogs: ApplicationLogsType | undefined;
  shouldSaveApplication?: boolean;
  exitAfterSave?: boolean;
  publicFolders: FolderInterface[];

  returnConversationIds?: string[];
}
