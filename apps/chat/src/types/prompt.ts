import { ShareEntity } from './common';

export type PromptInfo = ShareEntity;

export interface Prompt extends ShareEntity, PromptInfo {
  description?: string;
  content?: string;
}
