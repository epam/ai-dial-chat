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

export interface Entity {
  id: string;
  name: string;
  folderId?: string;
}

export interface ShareEntity extends Entity, ShareInterface {}

export interface BackendDataEntity {
  name: string;
  nodeType: BackendDataNodeType;
  resourceType: 'FILE' | 'PROMPTS' | 'CONVERSATIONS';
  bucket: string;
  parentPath: string | null | undefined;
}

export interface BackendEntity extends BackendDataEntity {
  updatedAt: number;
  nodeType: BackendDataNodeType.ITEM;
  url: string;
}

export interface BackendFolder<ItemType> extends BackendDataEntity {
  nodeType: BackendDataNodeType.FOLDER;
  items: ItemType[];
}

export type BackendEntityFolder = BackendFolder<
  BackendEntity | BackendEntityFolder
>;
