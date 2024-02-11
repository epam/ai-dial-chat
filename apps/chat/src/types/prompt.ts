import { Entity, ShareEntity } from './common';

export type PromptInfo = Entity & {
  isShared?: boolean;
};

export interface Prompt extends ShareEntity, PromptInfo {
  description?: string;
  content?: string;
}
