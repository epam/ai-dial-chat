import { AttachmentErrorReason, AttachmentType } from '../types/attachment';
import { MIMEType } from '../types/mime-type';
import type { Annotation } from './annotation';
import type { DeploymentConfigurationSchema } from './deployment-configuration';
import type { ResponseFormat } from './deployment-features';

/** Metadata returned by the DIAL file/conversation listing API for a single resource node. */
export interface ConversationMetadata {
  /** Display name of the resource. */
  name: string;
  /** Optional author identifier. */
  author?: string;
  /** Path of the parent folder in the resource tree. */
  parentPath: string;
  /** Storage bucket the resource belongs to. */
  bucket: string;
  /** Full resource URL used to fetch or reference the item. */
  url: string;
  /** Node type as returned by the backend (e.g. `'ITEM'`, `'FOLDER'`). */
  nodeType: string;
  /** Resource type discriminator (e.g. `'Conversation'`). */
  resourceType: string;
  /** ETag for optimistic concurrency / cache validation. */
  etag?: string;
  /** Unix timestamp (ms) when the resource was created. */
  createdAt?: number;
  /** Unix timestamp (ms) of the last modification. */
  updatedAt?: number;
  /** Permission strings granted to the current user for this resource. */
  permissions?: string[];
}

/** Identifies the author of a chat message. */
export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  /** In-conversation system event; never sent to DIAL Core. */
  Status = 'status',
}

/** A user-submitted thumbs-up or thumbs-down rating for an assistant message.
 * Stored as a signed integer that DIAL Core adds to the message's running like count:
 * `Like = 1` increments the count, `Dislike = -1` decrements it. */
export enum MessageRating {
  Like = 1,
  Dislike = -1,
}

/** Status of a single agent stage. */
export enum StageStatus {
  /** The stage completed successfully. */
  Completed = 'completed',
  /** The stage encountered an error. */
  Failed = 'failed',
}

/** Permitted scalar/array types for a single form field value. */
export type MessageFormValueType = number | string | boolean | string[];

/**
 * A key-value map submitted from a form widget embedded in a message.
 * Keys are field identifiers; values are typed form field values (or `undefined` for unset fields).
 */
export type MessageFormValue = Record<string, MessageFormValueType | undefined>;

/** Discriminator values for `StatusMessageCustomContent.event_type`. */
export enum StatusEvent {
  ModelChanged = 'model_changed',
}

/**
 * Extra payload attached to a `MessageRole.Status` message.
 * Discriminated by `event_type`; forward-compatible with future event types.
 */
export interface StatusMessageCustomContent {
  /** Machine-readable event discriminator. */
  event_type: StatusEvent;
  /** ID of the deployment that was active before the change, or `null` for the first selection. */
  previous_deployment_id: string | null;
  /** ID of the deployment selected after the change. */
  new_deployment_id: string;
}

/** Extra DIAL API payload attached to a message. */
export interface MessageCustomContent {
  /** Files or media items associated with this message. */
  attachments?: MessageAttachment[];
  /** Annotations produced by the model, each optionally citing a source document. */
  annotations?: Annotation[];
  /** Form field values submitted via an embedded form widget. */
  form_value?: MessageFormValue;
  /**
   * JSON Schema for a button/form widget embedded in an assistant response.
   * Populated from the streaming delta's `custom_content.form_schema`.
   */
  form_schema?: DeploymentConfigurationSchema;
  /**
   * Configuration value submitted with the next user turn when a button is selected.
   * Keys match the `propertyKey` from the `form_schema` (e.g. `{ button: 3 }`).
   */
  configuration_value?: Record<string, unknown>;
  /** Accumulated agent execution stages streamed via `custom_content.stages`. */
  stages?: Stage[];
}

/** A single message in a conversation. */
export interface Message {
  /** Who authored the message. */
  role: MessageRole;
  /** Plain-text (or Markdown) message body. */
  content: string;
  /** ISO-8601 timestamp of when the message was created. */
  timestamp: string;

  responseId?: string;
  /**
   * Extra DIAL API payload attached to the message.
   * Present on both user requests (uploaded files) and assistant responses
   * (generated/referenced files).
   */
  custom_content?: MessageCustomContent;
  /** User-submitted rating for this message. Only meaningful for assistant messages. Stored in-memory only; not persisted. */
  rating?: MessageRating;
  /**
   * ID of the deployment that generated this message.
   * Set on `MessageRole.Assistant` and `MessageRole.Status` messages.
   * Used to render the deployment icon next to assistant responses.
   */
  deploymentId?: string;
  /** Allows extra SDK-level properties to pass through when serializing to DIAL Core. */
  [key: string]: unknown;
}

/**
 * An in-conversation system event message produced by the client (never forwarded to DIAL Core).
 * Discriminated from `Message` by `role: MessageRole.Status`.
 * Defined as a standalone interface rather than extending `Message` because
 * `custom_content` has an incompatible type (`StatusMessageCustomContent` vs
 * `MessageCustomContent`), which prevents structural subtyping.
 */
export interface StatusMessage extends Omit<
  Message,
  'role' | 'custom_content'
> {
  /** Always `MessageRole.Status` for status messages. */
  role: MessageRole.Status;
  /** Status event payload. */
  custom_content?: StatusMessageCustomContent;
}

/**
 * A single stage entry produced by an agent during a streaming response.
 * Stages are delivered incrementally via `StreamChunkDelta.custom_content.stages`.
 */
export interface Stage {
  /** Zero-based ordering key; used to merge/upsert incoming stage updates. */
  index: number;
  /** Human-readable label for this stage (e.g. `"Lookup available terms"`). */
  name: string;
  /** `null` while the stage is running; a `StageStatus` value when it has settled. */
  status: StageStatus | null;
  /** Additional text content for this stage, accumulated from streaming chunks. */
  content?: string;
  /** File or content attachments associated with this stage. */
  attachments?: MessageAttachment[];
}

/** Incremental content delta inside a streaming SSE chunk. */
export interface StreamChunkDelta {
  /** Partial text token appended to the assistant message. */
  content?: string;
  /** Role field — only present in the first chunk of a response. */
  role?: string;
  /** DIAL Core response identifier used for the rate API. Present on the final chunk. */
  responseId?: string;
  /**
   * Partial custom content carried in this chunk.
   * `form_schema`, `attachments`, and `stages` may arrive in separate chunks or together in the final chunk.
   */
  custom_content?: {
    /** Incremental stage updates; merge by `index` into the accumulating stage list. */
    stages?: Stage[];
    /** JSON Schema for a button/form widget; arrives once the model decides to embed a form. */
    form_schema?: DeploymentConfigurationSchema;
    /** AI-generated files produced by the model; typically present in the final chunk. */
    attachments?: MessageAttachment[];
    /** Partial annotation updates; merge by `index` into the accumulating annotation list. */
    annotations?: Annotation[];
  };
}

/** A single server-sent event chunk from the streaming completions endpoint. */
export interface StreamChunk {
  /** Unique identifier for the completion stream. */
  id: string;
  /** Discriminator — always `'chat.completion.chunk'` for streaming responses. */
  object: 'chat.completion.chunk';
  /** One choice per requested completion (usually one entry). */
  choices: Array<{
    /** Partial token delta for this chunk. */
    delta: StreamChunkDelta;
    /** Set to a non-null string (e.g. `'stop'`) when the stream ends. */
    finish_reason: string | null;
    /** Zero-based index of this choice. */
    index: number;
  }>;
  /**
   * Present when DIAL Core signals an error inside the SSE stream instead of
   * (or in addition to) a non-2xx HTTP status.
   */
  error?: {
    /** Human-readable error description. */
    message: string;
    /** Machine-readable error category (e.g. `'invalid_request_error'`). */
    type?: string;
  };
}

/** Generic async-operation status, reusable for any request lifecycle. */
export enum RequestStatus {
  /** No request has been made yet. */
  Idle = 'idle',
  /** A request is in-flight. */
  Loading = 'loading',
  /** The most recent request failed. */
  Error = 'error',
}

/** Represents a file or content item that can be displayed as an attachment. */
export interface DisplayAttachment {
  /** Unique client-side identifier. */
  id: string;
  /** Display name (usually the original filename). */
  name: string;
  /** MIME type of the attachment (e.g. `'image/png'`, `'application/pdf'`). */
  contentType: MIMEType | string;
  /** Content category used to select the correct icon and thumbnail. */
  type: AttachmentType;
  /** Upload / processing lifecycle state. */
  status: RequestStatus;
  /** Reason the upload failed; only set when `status === RequestStatus.Error`. */
  errorReason?: AttachmentErrorReason;
  /** Object URL for image preview; only set when `type === AttachmentType.Image`. */
  previewUrl?: string;
  /** Resolved playback URL for audio; only set when `type === AttachmentType.Audio`. */
  playUrl?: string;
  /** Remote URL for an attachment that has already been uploaded. */
  url?: string;
  /** Alternate reference URL (e.g. from the DIAL API `reference_url` field); used when `url` is absent. */
  referenceUrl?: string;
  /** Inline base-64 encoded content; present when the attachment carries data directly rather than via a URL. */
  data?: string;
}

/** Attachment selected locally by the user before it is sent to the backend. */
export interface Attachment extends DisplayAttachment {
  /** The underlying browser `File` object selected by the user. */
  file: File;
}

/**
 * Attachment payload stored in message custom content.
 * Used inside `Message.custom_content.attachments` for both user requests
 * and assistant responses.
 */
export interface MessageAttachment {
  /** Zero-based position in the attachment list. */
  index?: number;
  /** MIME type of the attachment content. May be absent in streamed runtime payloads. */
  type?: MIMEType | string;
  /** Display name shown in the UI. */
  title: string;
  /** Inline base-64 encoded content (mutually exclusive with `url`). */
  data?: string;
  /** Remote URL pointing to the attachment content. */
  url?: string;
  /** MIME type of the referenced resource (used with `reference_url`). */
  reference_type?: MIMEType | string;
  /** URL of an alternate reference resource (e.g. a download link). */
  reference_url?: string;
}

/** A full conversation including its messages and configuration. */
export interface Conversation {
  /** Unique conversation identifier. */
  id: string;
  /** Identifier of the folder this conversation lives in. */
  folderId: string;
  /** Human-readable conversation title. */
  name: string;
  /** The AI model used for this conversation. */
  model: { id: string }; // TODO: add more model info
  /** System prompt prepended to every request. */
  prompt: string;
  /** Sampling temperature passed to the model (0–1). */
  temperature: number;
  /** Ordered list of messages in the conversation. */
  messages: Message[];
  /** Unix timestamp (ms) of the most recent activity. */
  lastActivityDate: number;
  /** Unix timestamp (ms) of the last save. */
  updatedAt: number;
  /** Add-on IDs enabled for this conversation. */
  selectedAddons: string[];
  /** Override model ID used when an assistant model is selected. */
  assistantModelId: string;
  /** Response format used when rendering messages. */
  responseFormat?: ResponseFormat;
}
