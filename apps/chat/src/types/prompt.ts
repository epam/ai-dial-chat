import { Entity, ShareEntity } from './common';

export type PromptInfo = Entity;

export interface Prompt extends ShareEntity, PromptInfo {
  description?: string;
  content?: string;
}
