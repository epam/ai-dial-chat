import { TemporaryFolderInterface } from '@epam/ai-dial-shared';

export interface FoldersState {
  temporaryFolders: TemporaryFolderInterface[];
  newAddedTemporaryFolderId: string;
}
