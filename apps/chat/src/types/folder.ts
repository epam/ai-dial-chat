import { PromptInfo } from './prompt';
import { EntityFilters } from './search';

import { ConversationInfo, FolderInterface } from '@epam/ai-dial-shared';

export type { FolderInterface } from '@epam/ai-dial-shared';

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

export interface DraggedInterface {
  entity: FolderInterface | ConversationInfo | PromptInfo;
  isFolder: boolean;
}
