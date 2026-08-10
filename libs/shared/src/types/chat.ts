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

export type onLikeMessageHandler = (
  likeStatus: LikeState,
  comment?: string,
) => void;

export interface MessageSettings {
  prompt: string;
  temperature: number;
  /**
   * @deprecated but required by core validation
   */
  selectedAddons?: string[];
}

export interface ConversationEntityModel {
  id: string;
}

export enum MessageAnnotationSelectorType {
  TextCharacterRange = 'text_character_range',
  TextLineRange = 'text_line_range',
  PdfPageRange = 'pdf_page_range',
  PdfRegion = 'pdf_region',
  ImageRegion = 'image_region',
  ImageMask = 'image_mask',
  ExcelRcRange = 'excel_rc_range',
  HTMLId = 'html_id',
  HTMLText = 'html_text',
}

export interface MessageAnnotationBBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type MessageAnnotationSelector =
  | {
      type:
        | MessageAnnotationSelectorType.TextCharacterRange
        | MessageAnnotationSelectorType.TextLineRange
        | MessageAnnotationSelectorType.PdfPageRange;
      start: number;
      end: number;
    }
  | {
      type: MessageAnnotationSelectorType.PdfRegion;
      page: number;
      bbox: MessageAnnotationBBox;
    }
  | {
      type: MessageAnnotationSelectorType.ImageRegion;
      bbox: MessageAnnotationBBox;
    }
  | {
      type: MessageAnnotationSelectorType.ImageMask;
      mask: string;
    }
  | {
      type: MessageAnnotationSelectorType.ExcelRcRange;
      start: { row: number; col: number };
      end: { row: number; col: number };
    }
  | {
      type: MessageAnnotationSelectorType.HTMLId;
      id: string;
    }
  | {
      type: MessageAnnotationSelectorType.HTMLText;
      text: string;
    };

export interface ChatCompletionSource {
  message_index: number | null;
  content_part_index: number | null;
  attachment_index: number | null;
}

export interface AttachmentSource {
  type: 'attachment';
  attachment: Attachment;
}

export interface MessageAnnotation {
  index: number;
  target: {
    source?: ChatCompletionSource;
    selector: MessageAnnotationSelector;
  };
  body: {
    title?: string;
    quote?: string;
    source?: ChatCompletionSource | AttachmentSource;
    selector?: MessageAnnotationSelector | MessageAnnotationSelector[];
    configuration?: Record<string, unknown>;
  };
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
  custom_fields?: {
    annotations?: MessageAnnotation[];
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
  publishCredentials?: boolean;
}

export enum FeatureType {
  Chat = 'chat',
  Prompt = 'prompt',
  File = 'file',
  Application = 'application',
  Toolset = 'toolset',
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
  isRootSharedItem?: boolean;
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
  uuid?: string;
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
  customViewState?: Record<string, unknown>;
}

export enum ConversationResponseFormat {
  PlainText = 'Plain text',
  Markdown = 'Markdown',
}

export interface Conversation extends ShareEntity, ConversationInfo {
  messages: Message[];
  prompt: string;
  temperature: number;
  responseFormat?: ConversationResponseFormat;
  compactMode?: boolean;
  /**
   * @deprecated but required by core validation
   */
  selectedAddons?: string[];
  reference?: string;
  replay?: Replay;
  playback?: Playback;

  isMessageStreaming?: boolean;
  customViewState?: Record<string, unknown>;
}
