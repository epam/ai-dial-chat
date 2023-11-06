export interface FolderInterface {
  id: string;
  name: string;
  type: FolderType;
  folderId?: string;
}

export type FolderType = 'chat' | 'prompt';
