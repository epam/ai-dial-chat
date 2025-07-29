import { MessageFormSchema, MessageFormValue } from './message-form-schema';

export enum Role {
  Assistant = 'assistant',
  User = 'user',
  System = 'system',
}

export type ImageMIMEType = 'image/jpeg' | 'image/png' | string;

export type MIMEType =
  | 'text/markdown'
  | 'text/plain'
  | 'text/html'
  | ImageMIMEType
  | string;

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

export enum LikeState {
  Disliked = -1,
  Liked = 1,
  NoState = 0,
}

export interface MessageSettings {
  prompt: string;
  temperature: number;

  // Addons selected by user clicks
  selectedAddons: string[];
  assistantModelId?: string;
}

export interface ConversationEntityModel {
  id: string;
}

export interface Message {
  role: Role;
  content: string;
  custom_content?: {
    attachments?: Attachment[];
    stages?: Stage[];
    state?: object;
    // schema support properties
    form_schema?: MessageFormSchema;
    form_value?: MessageFormValue;
    configuration_schema?: MessageFormSchema;
    configuration_value?: MessageFormValue;
  };
  like?: LikeState;
  errorMessage?: string;
  model?: ConversationEntityModel;
  settings?: MessageSettings;
  responseId?: string;
  templateMapping?: TemplateMapping[] | Record<string, string>;
}

export enum UploadStatus {
  UNINITIALIZED = 'UNINITIALIZED',
  LOADING = 'UPLOADING',
  LOADED = 'LOADED',
  FAILED = 'FAILED',
  ALL_LOADED = 'ALL_LOADED',
}

export interface EntityDates {
  createdAt?: number;
  updatedAt?: number;
}

export enum SharePermission {
  READ = 'READ',
  WRITE = 'WRITE',
}

export interface Entity extends EntityDates {
  id: string;
  name: string;
  folderId: string;
  status?: UploadStatus;
  author?: string;
  permissions?: SharePermission[];
}

export enum PublishActions {
  ADD = 'ADD',
  DELETE = 'DELETE',
  ADD_IF_ABSENT = 'ADD_IF_ABSENT',
}

export interface EntityPublicationInfo {
  version?: string;
  publicationUrl?: string;
  action?: PublishActions;
  isNotExist?: boolean;
  versionGroup?: string;
}

export enum FeatureType {
  Chat = 'chat',
  Prompt = 'prompt',
  File = 'file',
  Application = 'application',
}

export interface ShareInterface {
  isShared?: boolean;
  sharedWithMe?: boolean;

  isPublished?: boolean;
  publishedWithMe?: boolean;
  publicationInfo?: EntityPublicationInfo;
}

export interface ShareEntity extends Entity, ShareInterface {}

export interface FolderInterface extends ShareEntity {
  type: FeatureType;
  temporary?: boolean;
  serverSynced?: boolean;
  isPublicationFolder?: boolean;
}

export interface TemporaryFolderInterface
  extends Omit<FolderInterface, 'type'> {
  temporary: true;
  type?: FeatureType;
}

export interface ConversationInfo extends ShareEntity {
  model: ConversationEntityModel;
  isPlayback?: boolean;
  isReplay?: boolean;
}

export type TemplateMapping = [string, string];

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

export interface Conversation extends ShareEntity, ConversationInfo {
  messages: Message[];
  prompt: string;
  temperature: number;
  reference?: string;
  replay?: Replay;
  playback?: Playback;

  // Addons selected by user clicks
  selectedAddons: string[];
  assistantModelId?: string;

  isMessageStreaming?: boolean;
}
