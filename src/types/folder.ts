import { EntityFilter } from './common';
import { ShareInterface } from './share';

export interface FolderInterface extends ShareInterface {
  id: string;
  name: string;
  type: FolderType;
  folderId?: string;
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
  filters: FolderItemFilters<T>;
}
