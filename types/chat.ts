import { OpenAIEntityModel } from './openai';

export type AttachmentImageMIMEType = 'image/jpeg' | 'image/png';

export type AttachmentMIMEType =
  | 'text/markdown'
  | 'text/plain'
  | 'text/html'
  | AttachmentImageMIMEType;

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
  content?: string;
  attachments?: Attachment[];
  status: StageStatus;
}

export interface Message {
  role: Role;
  content: string;
  custom_content?: {
    attachments?: Attachment[];
    stages?: Stage[];
    state?: object;
  };
  like?: number;
  isError?: boolean;
  state?: object;
  model?: Partial<OpenAIEntityModel>;
}

export type Role = 'assistant' | 'user';

export interface ChatBody {
  model: OpenAIEntityModel;
  messages: Message[];
  key: string;
  id: string;
  prompt?: string;
  temperature?: number;
  selectedAddons?: string[];
  assistantModelId?: string;
}

export interface RateBody {
  model: OpenAIEntityModel;
  message: Message;
  key: string;
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
  assistantModelId?: string;
}
export interface Replay {
  isReplay: boolean;
  replayUserMessagesStack?: Message[];
  activeReplayIndex: number;
}
