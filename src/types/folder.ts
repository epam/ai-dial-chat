import { EntityFilter } from './common';

export interface FolderInterface {
  id: string;
  name: string;
  type: FolderType;
  folderId?: string;
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
