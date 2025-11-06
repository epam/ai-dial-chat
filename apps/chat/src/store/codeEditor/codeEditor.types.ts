import { UploadStatus } from '@epam/ai-dial-shared';

export interface CodeEditorState {
  filesContent: {
    id: string;
    content: string;
    modifiedContent: string | undefined;
    modified: boolean;
  }[];
  fileContentLoadingStatus: UploadStatus;
  selectedFileId: string | undefined;
}
