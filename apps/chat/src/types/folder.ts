import { ShareEntity } from './common';
import { EntityFilters } from './search';

export interface FolderInterface extends ShareEntity {
  type: FolderType;
  temporary?: boolean;
  serverSynced?: boolean;
  isPublicationFolder?: boolean;
}

export interface FoldersAndEntities<T> {
  folders: FolderInterface[];
  entities: T[];
}

export enum FolderType {
  Chat = 'chat',
  Prompt = 'prompt',
  File = 'file',
}

export interface FolderSectionProps {
  hidden?: boolean;
  name: string;
  dataQa: string;
  hideIfEmpty?: boolean;
  displayRootFiles?: boolean;
  filters: EntityFilters;
  showEmptyFolders?: boolean;
  openByDefault?: boolean;
}

export interface MoveToFolderProps {
  folderId?: string;
  isNewFolder?: boolean;
}

export interface IFolderChangе {
  (e: React.MouseEvent<HTMLElement>, handlerType: string): void;
}
