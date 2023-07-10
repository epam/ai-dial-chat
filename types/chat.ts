import { OpenAIEntityModel } from './openai';

export type AttachmentMIMEType = 'text/markdown' | 'image/jpeg';

export interface Attachment {
  index: number;
  type: AttachmentMIMEType;
  title: string;
  data?: string;
  url?: string;
  reference_type?: AttachmentMIMEType;
  reference_url?: string;
}

export type StageStatus = 'completed' | 'failed' | null;

export interface Stage {
  index: number;
  name: string;
  content: string;
  attachments?: Attachment[];
  status: StageStatus;
}

export interface Message {
  role: Role;
  content: string;
  custom_content?: {
    attachments?: Attachment[];
    stages?: Stage[];
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
