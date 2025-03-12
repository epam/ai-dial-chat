import { ApplicationInfo } from '@/src/types/applications';
import { ErrorMessage } from '@/src/types/error';
import {
  DialAIEntityModel,
  InstalledModel,
  ModelsMap,
  PublishRequestDialAIEntityModel,
} from '@/src/types/models';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface ModelsState {
  initialized: boolean;
  status: UploadStatus;
  error: ErrorMessage | undefined;
  models: DialAIEntityModel[];
  modelsMap: ModelsMap;
  recentModelsIds: string[];
  recentModelsStatus: UploadStatus;
  isInstalledModelsInitialized: boolean;
  installedModels: InstalledModel[];
  publishRequestModels: PublishRequestDialAIEntityModel[];
  publishedApplicationIds: string[];
}

export interface ModelUpdatedValues {
  reference: string;
  updatedValues: Partial<ApplicationInfo>;
}
