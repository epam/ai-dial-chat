import { FeatureType } from '@/src/types/common';
import {
  PublicVersionGroups,
  Publication,
  PublicationInfo,
  PublicationModel,
  PublicationRule,
  ResourceToReview,
} from '@/src/types/publication';

// key/editedName is a special key for the folder node, because it handles collisions with children node keys, since folder name can't contain '/'
export const EDITED_FOLDER_NAME_KEY = 'key/editedName';

export interface FolderNode {
  [EDITED_FOLDER_NAME_KEY]: string;
  [folderName: string]: FolderNode | string;
}

export type FolderEditTree = Record<string, FolderNode>;

export enum PublicationPanel {
  Chat = 'chat',
  Prompt = 'prompt',
}

export interface FocusedPublication {
  url: string;
  panel: PublicationPanel;
}

export interface PublicationState {
  initialized: boolean;
  publications: (PublicationInfo & Partial<Publication>)[];
  selectedPublicationUrl: string | null;
  selectedPublicationPanel: PublicationPanel | null;
  resourcesToReview: ResourceToReview[];
  rules: Record<string, PublicationRule[]>;
  isRulesLoading: boolean;
  allPublishedWithMeItemsUploaded: Record<FeatureType, boolean>;
  isApplicationReview: boolean;
  isToolsetReview: boolean;
  publicVersionGroups: PublicVersionGroups;
  publishModel: PublicationModel | undefined;
  selectedPublicationItems: Record<string, string[]>;
  selectedCredentialsItems: Record<string, string[]>;

  // Edit or publish mode
  isEditMode: boolean;
  entitiesEditState: Record<string, { name: string; version: string }>;
  foldersEditState: FolderEditTree;
  isPublicationUpdating: boolean;
  currentPublicationInvalidEntities: string[];
}
