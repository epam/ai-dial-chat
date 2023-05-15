import { OpenAIModel } from './openai';

export interface Message {
  role: Role;
  content: string;
  like?: number;
}

export type Role = 'assistant' | 'user';

export interface ChatBody {
  model: OpenAIModel;
  messages: Message[];
  key: string;
  prompt: string;
  temperature: number;
  id: string;
}

export interface RateBody {
  model: OpenAIModel;
  message: Message;
  key: string;
  id: string;
  value: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  model: OpenAIModel;
  prompt: string;
  temperature: number;
  folderId: string | null;
}
