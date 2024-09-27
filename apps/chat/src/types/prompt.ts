import { ShareEntity } from '@epam/ai-dial-shared';

export type PromptInfo = ShareEntity;

export interface Prompt extends PromptInfo {
  description?: string;
  content?: string;
}

export interface TemplateParameter {
  name: string;
  defaultValue: string;
}
