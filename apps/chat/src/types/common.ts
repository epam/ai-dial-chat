import { MappedReplaceActions } from './import-export';

import { UploadStatus } from '@epam/ai-dial-shared';

export enum EntityType {
  Model = 'model',
  Application = 'application',
  Assistant = 'assistant',
  Addon = 'addon',
}

export enum FeatureType {
  Chat = 'chat',
  Prompt = 'prompt',
  File = 'file',
  Application = 'application',
}

export enum BackendDataNodeType {
  ITEM = 'ITEM',
  FOLDER = 'FOLDER',
}

export enum BackendResourceType {
  FILE = 'FILE',
  PROMPT = 'PROMPT',
  CONVERSATION = 'CONVERSATION',
  APPLICATION = 'APPLICATION',
}

export interface BackendDataEntity {
  nodeType: BackendDataNodeType;
  name: string;
  resourceType: BackendResourceType;
  bucket: string;
  parentPath?: string | null;
  url: string;
}

export interface BackendEntity extends BackendDataEntity {
  nodeType: BackendDataNodeType.ITEM;
}

export interface BackendChatEntity extends BackendEntity {
  updatedAt: number;
}

export interface BackendFolder<ItemType> extends BackendDataEntity {
  nodeType: BackendDataNodeType.FOLDER;
  items: ItemType[];
}

export type BackendChatFolder = BackendFolder<
  BackendChatEntity | BackendChatFolder
>;

export interface BaseDialEntity {
  // Combination of relative path and name
  id: string;
  // Only for files fetched uploaded to backend
  // Same as relative path but has some absolute prefix like <HASH>
  absolutePath?: string;
  relativePath?: string;
  // Same as relative path, but needed for simplicity and backward compatibility
  folderId: string;
  serverSynced?: boolean;
  status?: UploadStatus.LOADING | UploadStatus.FAILED;
}

export type DialChatEntity = Omit<
  BackendChatEntity,
  'path' | 'nodeType' | 'resourceType' | 'bucket' | 'parentPath' | 'url'
> &
  BaseDialEntity;

export const isNotLoaded = (status?: UploadStatus) => {
  return !status || status === UploadStatus.UNINITIALIZED;
};

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export enum ApiKeys {
  Files = 'files',
  Conversations = 'conversations',
  Prompts = 'prompts',
  Applications = 'applications',
}

export interface AdditionalItemData {
  publicationUrl?: string;
  canAttachFiles?: boolean;
  isChangePathFolder?: boolean;
  selectedFilesIds?: string[];
  selectedFolderIds?: string[];
  partialSelectedFolderIds?: string[];
  isSidePanelItem?: boolean;
  mappedActions?: MappedReplaceActions;
}

export interface MoveModel {
  sourceUrl: string;
  destinationUrl: string;
  overwrite: boolean;
}

export interface DropdownSelectorOption {
  readonly value: string;
  readonly label: string;
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly isFixed?: boolean;
  readonly isDisabled?: boolean;
}

export interface SelectOption<L, V> {
  label: L;
  value: V;
  defaultValue?: string;
}

export enum PageType {
  Chat = 'chat',
  Marketplace = 'marketplace',
}

export enum ScreenState {
  MOBILE,
  TABLET,
  DESKTOP,
}
