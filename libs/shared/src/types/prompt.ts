import { ShareEntity } from './chat';

export type PromptInfo = ShareEntity;

export interface Prompt extends PromptInfo {
  description?: string;
  content?: string;
}
