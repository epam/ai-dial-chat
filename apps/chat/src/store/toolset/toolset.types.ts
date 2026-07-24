import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import {
  ToolsetEditorSteps,
  ToolsetModel,
  ToolsetTool,
  ToolsetsMap,
} from '@/src/types/toolsets';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface ToolsetState {
  initialized: boolean;
  toolsetsMap: ToolsetsMap;
  toolsetsStatus: UploadStatus;

  toolsetDetails?: ToolsetModel;
  toolsetDetailsStatus: UploadStatus;

  installedToolsets: string[];
  isInstalledToolsetsInitialized: boolean;

  editorStep: ToolsetEditorSteps;

  publishRequestToolsets: PublishRequestDialAIEntityModel[];

  allowedTools?: {
    endpoint: string;
    tools: ToolsetTool[];
  };
  allowedToolsStatus: UploadStatus;
}
