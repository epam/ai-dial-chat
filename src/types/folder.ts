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

export interface FolderSectionProps<T> {
  name: string;
  dataQa: string;
  hideIfEmpty?: boolean;
  displayRootFiles?: boolean;
  itemFilter: EntityFilter<T>;
  showEmptyFolders?: boolean;
  openByDefault?: boolean;
}
