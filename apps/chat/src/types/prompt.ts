import { ShareEntity } from './common';

export type PromptInfo = ShareEntity;

export interface Prompt extends PromptInfo {
  description?: string;
  content?: string;
}

export interface TemplateParameter {
  name: string;
  defaultValue: string;
}
