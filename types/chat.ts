import { OpenAIEntityModel } from './openai';

export interface Attachment {
  data: string;
}

export interface Message {
  role: Role;
  content: string;
  custom_content?: {
    attachments?: Attachment[];
  };
  like?: number;
  isError?: boolean;
  state?: object;
}

export type Role = 'assistant' | 'user';

export interface ChatBody {
  modelId: string;
  messages: Message[];
  key: string;
  prompt: string;
  temperature: number;
  id: string;
  selectedAddons: string[];
}

export interface RateBody {
  model: OpenAIEntityModel;
  message: Message;
  key: string;
  id: string;
  value: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  model: OpenAIEntityModel;
  prompt: string;
  temperature: number;
  folderId: string | null;
  replay: Replay;
  selectedAddons: string[];
}
export interface Replay {
  isReplay: boolean;
  replayUserMessagesStack?: Message[];
  activeReplayIndex: number;
}
