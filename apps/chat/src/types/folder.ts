import { PromptInfo } from './prompt';
import { EntityFilters } from './search';

import { ConversationInfo, ShareEntity } from '@epam/ai-dial-shared';

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
  Application = 'application',
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

export interface DraggedInterface {
  entity: FolderInterface | ConversationInfo | PromptInfo;
  isFolder: boolean;
}
