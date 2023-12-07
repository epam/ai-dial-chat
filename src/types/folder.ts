import { Entity, EntityFilter } from './common';

export interface FolderInterface extends Entity {
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
  hidden?: boolean;
  name: string;
  dataQa: string;
  hideIfEmpty?: boolean;
  displayRootFiles?: boolean;
  itemFilter: EntityFilter<T>;
  showEmptyFolders?: boolean;
  openByDefault?: boolean;
}
