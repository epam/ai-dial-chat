import { EntityFilter } from './common';

export interface FolderInterface {
  id: string;
  name: string;
  type: FolderType;
  folderId?: string;
  isShared?: boolean;
  sharedWithMe?: boolean;
  serverSynced?: boolean;
}

export enum FolderType {
  Chat = 'chat',
  Prompt = 'prompt',
  File = 'file',
}

export interface FolderItemFilters<T> {
  filterFolder: EntityFilter<FolderInterface>;
  filterItem: EntityFilter<T>;
}

export interface ChatFoldersProps<T> {
  name: string;
  hideIfEmpty?: boolean;
  displayRootFiles?: boolean;
  readonly?: boolean;
  filters: FolderItemFilters<T>;
}
