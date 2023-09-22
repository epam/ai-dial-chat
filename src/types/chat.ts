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
  errorMessage?: string;
  model?: Partial<OpenAIEntityModel>;
  responseId?: string;
}

export type Role = 'assistant' | 'user';

export interface ChatBody {
  modelId: string;
  messages: Message[];
  id: string;
  prompt?: string;
  temperature?: number;
  selectedAddons?: string[];
  assistantModelId?: string;
}

export interface RateBody {
  modelId: string;
  responseId: string;
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

  // Addons selected by user clicks
  selectedAddons: string[];
  assistantModelId?: string;
  lastActivityDate?: number;

  isMessageStreaming: boolean;
}
export interface Replay {
  isReplay: boolean;
  replayUserMessagesStack?: Message[];
  activeReplayIndex: number;
}
