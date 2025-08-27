import { DialFile, FileFolderInterface } from '@/src/types/files';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface FilesState {
  initialized: boolean;
  files: DialFile[];
  selectedFilesIds: string[];
  filesStatus: UploadStatus;

  chosenFileIds: string[];
  chosenEmptyFoldersIds: string[];

  folders: FileFolderInterface[];
  foldersStatus: UploadStatus;
  loadingFolderId?: string;
  newAddedFolderId?: string;
  lastRenamedParentFolder?: { oldId: string; newId: string };
  sharedFileIds: string[];
}
