import { Entity, ShareEntity } from './common';

export interface Prompt extends ShareEntity {
  description?: string;
  content?: string;
}

export type PromptInfo = Entity;
