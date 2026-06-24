import { MappedReplaceActions } from '@/src/types/common';
import { DialFile, FileFolderInterface } from '@/src/types/files';

import { UploadStatus } from '@epam/ai-dial-shared';
import { DialFile as UIKitDialFile } from '@epam/ai-dial-ui-kit';

export interface PendingUploadFile {
  fileContent: File;
  id: string;
  name: string;
}

export interface UploadReplaceDialogState {
  isOpen: boolean;
  duplicatedFiles: DialFile[];
  nonDuplicatedFiles: PendingUploadFile[];
  folderId: string;
  folderPath?: string;
  bucket?: string;
  showSuccessMessage: boolean;
  selectFileIds: boolean;
  isFromDeviceAttachment?: boolean;
  mappedActions?: MappedReplaceActions;
}

export interface SearchListingMetadata {
  loadedAt: number;
  isFullyLoaded: boolean;
  folderPath: string;
}

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
  sharedFolderIds: string[];

  loadingFileMetadata: boolean;
  fileMetadata: UIKitDialFile | null;

  isCopyingFiles: boolean;
  isMovingFiles: boolean;
  isDeletingFiles: boolean;
  isDownloadingArchive: boolean;
  isUploadingFiles: boolean;
  isUploadingArchive: boolean;

  copyingFilesSignal: AbortController | null;
  movingFilesSignal: AbortController | null;

  isLoadingSearchListing: boolean;
  searchListingMetadata: Record<string, SearchListingMetadata>;

  sharedWithMeFilesAndFoldersIds: string[];

  localFileSizeCache: Record<string, number>;

  uploadReplaceDialog: UploadReplaceDialogState | null;
  resolvedUploadIds: string[] | null;
}
