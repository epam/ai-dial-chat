import { ShareInterface } from './share';

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
}

export enum BackendDataNodeType {
  ITEM = 'ITEM',
  FOLDER = 'FOLDER',
}

export enum BackendResourceType {
  FILE = 'FILE',
  PROMPT = 'PROMPT',
  CONVERSATION = 'CONVERSATION',
}

export interface Entity {
  id: string;
  name: string;
  folderId?: string;
  status?: UploadStatus;
}

export interface ShareEntity extends Entity, ShareInterface {}

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
  folderId?: string;
  serverSynced?: boolean;
  status?: UploadStatus.LOADING | UploadStatus.FAILED;
}

export type DialChatEntity = Omit<
  BackendChatEntity,
  'path' | 'nodeType' | 'resourceType' | 'bucket' | 'parentPath' | 'url'
> &
  BaseDialEntity;

export enum UploadStatus {
  UNINITIALIZED = 'UNINITIALIZED',
  LOADING = 'UPLOADING',
  LOADED = 'LOADED',
  FAILED = 'FAILED',
}

export const isNotLoaded = (status?: UploadStatus) => {
  return !status || status === UploadStatus.UNINITIALIZED;
};
