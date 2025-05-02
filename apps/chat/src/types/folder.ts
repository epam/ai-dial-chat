import { FeatureType } from './common';
import { PromptInfo } from './prompt';
import { EntityFilters } from './search';

import { ConversationInfo, ShareEntity } from '@epam/ai-dial-shared';

export interface FolderInterface extends ShareEntity {
  type: FeatureType;
  temporary?: boolean;
  serverSynced?: boolean;
  isPublicationFolder?: boolean;
}

export interface FoldersAndEntities<T> {
  folders: FolderInterface[];
  entities: T[];
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
