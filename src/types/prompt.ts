import { Share } from './chat';
import { OpenAIEntityModel } from './openai';

export interface Prompt {
  id: string;
  name: string;
  description?: string;
  content?: string;
  model: OpenAIEntityModel;
  folderId?: string;
  shares?: Share[];
}
