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
}

export interface ShareEntity extends Entity, ShareInterface {}

export interface BackendDataEntity {
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
