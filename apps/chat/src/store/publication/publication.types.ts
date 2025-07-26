import { FeatureType } from '@/src/types/common';
import {
  PublicVersionGroups,
  Publication,
  PublicationInfo,
  PublicationRule,
  ResourceToReview,
} from '@/src/types/publication';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';

// key/editedName is a special key for the folder node, because it handles collisions with children node keys, since folder name can't contain '/'
export const EDITED_FOLDER_NAME_KEY = 'key/editedName';

export interface FolderNode {
  [EDITED_FOLDER_NAME_KEY]: string;
  [folderName: string]: FolderNode | string;
}

export type FolderEditTree = Record<string, FolderNode>;

export interface PublicationState {
  initialized: boolean;
  publications: (PublicationInfo & Partial<Publication>)[];
  selectedPublicationUrl: string | null;
  resourcesToReview: ResourceToReview[];
  rules: Record<string, PublicationRule[]>;
  isRulesLoading: boolean;
  allPublishedWithMeItemsUploaded: Record<FeatureType, boolean>;
  selectedItemsToPublish: string[];
  isApplicationReview: boolean;
  publicVersionGroups: PublicVersionGroups;
  publishModel:
    | { entity: ShareEntity & { iconUrl?: string }; action: PublishActions }
    | undefined;

  // Review edit mode
  selectedItemsToApprove: Record<string, string[]>;
  isEditMode: boolean;
  entitiesEditState: Record<string, { name: string; version: string }>;
  foldersEditState: FolderEditTree;
  rulesOnEdit: PublicationRule[];
  isPublicationUpdating: boolean;
  displayAuthorEditState: string;
}
