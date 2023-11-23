export interface FolderInterface {
  id: string;
  name: string;
  type: FolderType;
  folderId?: string;

  serverSynced?: boolean;
}

export type FolderType = 'chat' | 'prompt' | 'file';
