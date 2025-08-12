import { ToolsetModel } from '@/src/types/toolsets';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface ToolsetState {
  initialized: boolean;
  toolsetsMap: Record<string, Omit<ToolsetModel, 'endpoint'>>;
  toolsetsStatus: UploadStatus;

  toolsetDetails?: ToolsetModel;
  toolsetDetailsStatus: UploadStatus;
}
