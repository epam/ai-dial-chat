import { DialAIEntityModel } from '@/src/types/models';

import { ConversationInfo, Message, ShareEntity } from '@epam/ai-dial-shared';

export enum CopyTableType {
  MD = 'md',
  CSV = 'csv',
  TXT = 'txt',
}

export interface ChatBody {
  messages: Message[];
  id: string;
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
}

export interface Conversation extends ShareEntity, ConversationInfo {
  messages: Message[];
  prompt: string;
  temperature: number;
  replay?: Replay;
  playback?: Playback;

  // Addons selected by user clicks
  selectedAddons: string[];
  assistantModelId?: string;

  isMessageStreaming?: boolean;
  isNameChanged?: boolean;
}

export interface Replay {
  replayAsIs?: boolean;
  isReplay: boolean;
  replayUserMessagesStack?: Message[];
  activeReplayIndex?: number;
  isError?: boolean;
}

export interface Playback {
  isPlayback?: boolean;
  messagesStack: Message[];
  activePlaybackIndex: number;
}

export type MergedMessages = [Conversation, Message, number][];

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
}

export enum SidebarSide {
  Left = 'left',
  Right = 'right',
}

export enum FormButtonType {
  Populate = 'populate',
  Submit = 'submit',
}
