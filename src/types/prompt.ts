import { Entity } from './common';
import { ShareInterface } from './share';

export interface Prompt extends ShareInterface, Entity {
  description?: string;
  content?: string;
  folderId?: string;
}
