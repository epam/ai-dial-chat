import { ShareInterface } from './share';

export interface Prompt extends ShareInterface {
  id: string;
  name: string;
  description?: string;
  content?: string;
  folderId?: string;
}
