import { ShareEntity } from './common';
import { MIMEType } from './files';

export enum CopyTableType {
  MD = 'md',
  CSV = 'csv',
  TXT = 'txt',
}

export enum LikeState {
  Disliked = -1,
  Liked = 1,
  NoState = 0,
}

export interface Attachment {
  index?: number;
  type: MIMEType;
  title: string;
  data?: string;
  url?: string;
  reference_type?: MIMEType;
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

export interface MessageSettings {
  prompt: string;
  temperature: number;

  // Addons selected by user clicks
  selectedAddons: string[];
  assistantModelId?: string;
}

export interface Message {
  role: Role;
  content: string;
  custom_content?: {
    attachments?: Attachment[];
    stages?: Stage[];
    state?: object;
  };
  like?: LikeState;
  errorMessage?: string;
  model?: ConversationEntityModel;
  settings?: MessageSettings;
  responseId?: string;
}

export enum Role {
  Assistant = 'assistant',
  User = 'user',
  System = 'system',
}

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
  modelId: string | undefined;
  prompt: string;
  temperature: number;
  currentAssistentModelId: string | undefined;
  addonsIds: string[];
  isShared: boolean;
}

export interface ConversationEntityModel {
  id: string;
}

export interface ConversationInfo extends ShareEntity {
  model: ConversationEntityModel;
  lastActivityDate?: number;
  isPlayback?: boolean;
  isReplay?: boolean;
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
