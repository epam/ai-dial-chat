import { DialAIEntityModel } from '@/src/types/models';

import { Conversation, Message } from '@epam/ai-dial-shared';

// Reexporting Conversation to not change entire codebase
export type { Conversation } from '@epam/ai-dial-shared';

export enum CopyTableType {
  MD = 'md',
  CSV = 'csv',
  TXT = 'txt',
}

export interface ChatBody {
  messages: Message[];
  id: string;
  reference?: string;
  prompt?: string;
  temperature?: number;
  selectedAddons?: string[];
  model?: DialAIEntityModel;
  assistantModel?: DialAIEntityModel;
}

export interface RateBody {
  modelId: string;
  responseId: string;
  id: string;
  value: boolean;
  reference?: string;
}

export type MergedMessages = [Conversation, Message, number, Message[]][];

export interface ConversationsTemporarySettings {
  modelId: string;
  prompt: string;
  temperature: number;
  currentAssistantModelId: string | undefined;
  addonsIds: string[];
  isShared: boolean;
}

export interface PrepareNameOptions {
  forRenaming: boolean;
  replaceWithSpacesForRenaming: boolean;
  trimEndDotsRequired: boolean;
  maxNameLength?: number;
}

export enum SidebarSide {
  Left = 'left',
  Right = 'right',
}

export enum FormButtonType {
  Populate = 'populate',
  Submit = 'submit',
}
