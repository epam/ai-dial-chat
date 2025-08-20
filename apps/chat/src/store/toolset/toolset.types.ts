import { ToolsetModel } from '@/src/types/toolsets';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface ToolsetState {
  initialized: boolean;
  toolsetsMap: Record<string, ToolsetModel>;
  toolsetsStatus: UploadStatus;

  toolsetDetails?: ToolsetModel;
  toolsetDetailsStatus: UploadStatus;

  bookmarkedToolsets: string[];
  isBookmarkedToolsetInitialized: boolean;
}
