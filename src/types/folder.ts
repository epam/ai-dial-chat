import { EntityFilter } from './common';

export interface FolderInterface {
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

export interface FolderSectionProps<T> {
  hide?: boolean;
  name: string;
  dataQa: string;
  hideIfEmpty?: boolean;
  displayRootFiles?: boolean;
  itemFilter: EntityFilter<T>;
  showEmptyFolders?: boolean;
  openByDefault?: boolean;
}
