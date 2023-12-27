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

export interface Entity {
  id: string;
  name: string;
}

export interface ShareEntity extends Entity, ShareInterface {}
