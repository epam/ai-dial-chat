import {
  ApplicationLogsType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { FolderInterface } from '@/src/types/folder';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';

import { MarketplaceEntitiesTabs } from '@/src/constants/marketplace';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface ApplicationState {
  initialized: boolean;
  appLoading: UploadStatus;
  logsLoadingStatus: UploadStatus;
  appDetails: CustomApplicationModel | undefined;
  appLogs: ApplicationLogsType | undefined;
  publicFolders: FolderInterface[];

  returnConversationIds?: string[];
  selectedWidget?: string;

  logsEntityId: string | undefined;
  editorStep: MarketplaceEditorSteps;
  editorSelectedEntity?: { reference: string; type: MarketplaceEntitiesTabs };
  shouldTriggerEditorAutoUpdate: boolean;
  editorError?: string;
}
