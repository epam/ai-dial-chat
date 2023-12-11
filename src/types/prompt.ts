import { ShareEntity } from './common';

export interface Prompt extends ShareEntity {
  description?: string;
  content?: string;
  folderId?: string;
}
