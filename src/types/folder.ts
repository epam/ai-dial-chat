export interface FolderInterface {
  id: string;
  name: string;
  type: FolderType;
  folderId?: string;
  isShared?: boolean;

  serverSynced?: boolean;
}

export enum FolderType {
  Chat = 'chat',
  Prompt = 'prompt',
  File = 'file',
}

export interface FolderItemFilters<T> {
  filterFolder: (folder: FolderInterface) => boolean;
  filterItem: (item: T) => boolean;
}
