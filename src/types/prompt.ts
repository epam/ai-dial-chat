import { Entity, ShareEntity } from './common';

export interface Prompt extends ShareEntity, PromptInfo {
  description?: string;
  content?: string;
}

export type PromptInfo = Entity;
