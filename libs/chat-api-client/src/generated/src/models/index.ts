/* tslint:disable */
/* eslint-disable */
/**
 *
 * @export
 * @interface AcceptInvitationResponseDto
 */
export interface AcceptInvitationResponseDto {
  /**
   * Identifier (DIAL Core resource path) of the entity the invitation grants access to.
   * @type {string}
   * @memberof AcceptInvitationResponseDto
   */
  itemId: string;
  /**
   * List-item summary of the shared model/application, resolved by id at accept time so the frontend can show its details panel without waiting on a bulk deployments list refresh. Omitted when itemId is a toolset, or when resolution failed (a best-effort step that never fails the accept call itself).
   * @type {DeploymentItemDto}
   * @memberof AcceptInvitationResponseDto
   */
  sharedDeployment?: DeploymentItemDto;
  /**
   * List-item summary of the shared toolset, resolved by id at accept time so the frontend can show its details panel without waiting on a bulk toolsets list refresh. Omitted when itemId is not a toolset, or when resolution failed (a best-effort step that never fails the accept call itself).
   * @type {DialToolsetDto}
   * @memberof AcceptInvitationResponseDto
   */
  sharedToolset?: DialToolsetDto;
}
/**
 *
 * @export
 * @interface ApplicationDetailsDto
 */
export interface ApplicationDetailsDto {
  /**
   * Non-secret custom application properties reported by DIAL Core
   * @type {{ [key: string]: unknown }}
   * @memberof ApplicationDetailsDto
   */
  applicationProperties?: { [key: string]: unknown };
  /**
   * Runtime environment for the function
   * @type {string}
   * @memberof ApplicationDetailsDto
   */
  functionRuntime?: string;
  /**
   * Current deployment status of the function
   * @type {string}
   * @memberof ApplicationDetailsDto
   */
  functionStatus?: string;
  /**
   * Custom route names exposed by the application
   * @type {Array<string>}
   * @memberof ApplicationDetailsDto
   */
  routes?: Array<string>;
  /**
   * Owner of the deployment as reported by DIAL Core
   * @type {string}
   * @memberof ApplicationDetailsDto
   */
  owner?: string;
  /**
   *
   * @type {DeploymentFeaturesDetailsDto}
   * @memberof ApplicationDetailsDto
   */
  features?: DeploymentFeaturesDetailsDto;
  /**
   * Accepted MIME types for input attachments
   * @type {Array<string>}
   * @memberof ApplicationDetailsDto
   */
  inputAttachmentTypes?: Array<string>;
  /**
   * URI of the custom application type schema, when present
   * @type {string}
   * @memberof ApplicationDetailsDto
   */
  applicationTypeSchemaId?: string;
  /**
   * Timestamp of creation time from DIAL Core (e.g. 1714768496000)
   * @type {number}
   * @memberof ApplicationDetailsDto
   */
  createdAt?: number;
}
/**
 *
 * @export
 * @interface ApplicationDto
 */
export interface ApplicationDto {
  /**
   *
   * @type {string}
   * @memberof ApplicationDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationDto
   */
  object: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationDto
   */
  displayName?: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationDto
   */
  displayVersion?: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationDto
   */
  iconUrl?: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationDto
   */
  description?: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationDto
   */
  intro?: string;
  /**
   *
   * @type {Array<string>}
   * @memberof ApplicationDto
   */
  inputAttachmentTypes?: Array<string>;
  /**
   *
   * @type {number}
   * @memberof ApplicationDto
   */
  maxInputAttachments?: number;
}
/**
 *
 * @export
 * @interface ApplicationSchemaSummaryDto
 */
export interface ApplicationSchemaSummaryDto {
  /**
   *
   * @type {string}
   * @memberof ApplicationSchemaSummaryDto
   */
  id?: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationSchemaSummaryDto
   */
  displayName?: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationSchemaSummaryDto
   */
  viewerUrl?: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationSchemaSummaryDto
   */
  editorUrl?: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationSchemaSummaryDto
   */
  schemaEndpoint?: string;
  /**
   *
   * @type {string}
   * @memberof ApplicationSchemaSummaryDto
   */
  iconUrl?: string;
}
/**
 *
 * @export
 * @interface ApplicationSchemasResponseDto
 */
export interface ApplicationSchemasResponseDto {
  /**
   *
   * @type {Array<ApplicationSchemaSummaryDto>}
   * @memberof ApplicationSchemasResponseDto
   */
  schemas: Array<ApplicationSchemaSummaryDto>;
}
/**
 *
 * @export
 * @interface ApplicationsResponseDto
 */
export interface ApplicationsResponseDto {
  /**
   *
   * @type {Array<ApplicationDto>}
   * @memberof ApplicationsResponseDto
   */
  data: Array<ApplicationDto>;
}
/**
 *
 * @export
 * @interface ArchiveItemDto
 */
export interface ArchiveItemDto {
  /**
   * DIAL Core bucket name
   * @type {string}
   * @memberof ArchiveItemDto
   */
  bucket: string;
  /**
   * File or folder path within the bucket
   * @type {string}
   * @memberof ArchiveItemDto
   */
  path: string;
  /**
   * Display name for archive entry
   * @type {string}
   * @memberof ArchiveItemDto
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof ArchiveItemDto
   */
  nodeType: ArchiveItemDtoNodeTypeEnum;
}

/**
 * @export
 */
export const ArchiveItemDtoNodeTypeEnum = {
  Item: 'item',
  Folder: 'folder',
} as const;
export type ArchiveItemDtoNodeTypeEnum =
  (typeof ArchiveItemDtoNodeTypeEnum)[keyof typeof ArchiveItemDtoNodeTypeEnum];

/**
 *
 * @export
 * @interface AttachmentDto
 */
export interface AttachmentDto {
  /**
   * Zero-based position in the list
   * @type {number}
   * @memberof AttachmentDto
   */
  index?: number;
  /**
   * MIME type of the attachment
   * @type {string}
   * @memberof AttachmentDto
   */
  type: string;
  /**
   * Display name of the attachment
   * @type {string}
   * @memberof AttachmentDto
   */
  title: string;
  /**
   * Inline base-64 encoded content
   * @type {string}
   * @memberof AttachmentDto
   */
  data?: string;
  /**
   * Remote URL of the attachment content
   * @type {string}
   * @memberof AttachmentDto
   */
  url?: string;
  /**
   * MIME type of the reference resource
   * @type {string}
   * @memberof AttachmentDto
   */
  referenceType?: string;
  /**
   * URL of the reference resource
   * @type {string}
   * @memberof AttachmentDto
   */
  referenceUrl?: string;
}
/**
 *
 * @export
 * @interface ChatCompletionChoiceDto
 */
export interface ChatCompletionChoiceDto {
  /**
   *
   * @type {number}
   * @memberof ChatCompletionChoiceDto
   */
  index: number;
  /**
   *
   * @type {ChatCompletionChoiceDtoMessage}
   * @memberof ChatCompletionChoiceDto
   */
  message: ChatCompletionChoiceDtoMessage;
}
/**
 *
 * @export
 * @interface ChatCompletionChoiceDtoMessage
 */
export interface ChatCompletionChoiceDtoMessage {
  /**
   *
   * @type {string}
   * @memberof ChatCompletionChoiceDtoMessage
   */
  role?: string;
  /**
   *
   * @type {string}
   * @memberof ChatCompletionChoiceDtoMessage
   */
  content?: string;
}
/**
 *
 * @export
 * @interface ChatCompletionDto
 */
export interface ChatCompletionDto {
  /**
   * DIAL Core deployment name (may contain slashes and special characters)
   * @type {string}
   * @memberof ChatCompletionDto
   */
  deployment: string;
  /**
   * Ordered chat messages to send to DIAL Core
   * @type {Array<MessageDto>}
   * @memberof ChatCompletionDto
   */
  messages: Array<MessageDto>;
  /**
   * Sampling temperature
   * @type {number}
   * @memberof ChatCompletionDto
   */
  temperature?: number;
  /**
   * Maximum number of tokens to generate
   * @type {number}
   * @memberof ChatCompletionDto
   */
  maxTokens?: number;
}
/**
 *
 * @export
 * @interface ChatCompletionResponseDto
 */
export interface ChatCompletionResponseDto {
  /**
   *
   * @type {string}
   * @memberof ChatCompletionResponseDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof ChatCompletionResponseDto
   */
  object: string;
  /**
   *
   * @type {Array<ChatCompletionChoiceDto>}
   * @memberof ChatCompletionResponseDto
   */
  choices: Array<ChatCompletionChoiceDto>;
}
/**
 *
 * @export
 * @interface Check200Response
 */
export interface Check200Response {
  /**
   * Health status
   * @type {string}
   * @memberof Check200Response
   */
  status?: string;
  /**
   * Current server time in ISO format
   * @type {string}
   * @memberof Check200Response
   */
  timestamp?: string;
  /**
   * Application version
   * @type {string}
   * @memberof Check200Response
   */
  version?: string;
}
/**
 *
 * @export
 * @interface ClientConfigDto
 */
export interface ClientConfigDto {
  /**
   * Deployment ID of the ASR model. Null when ASR is not configured.
   * @type {string}
   * @memberof ClientConfigDto
   */
  asrModelId: string | null;
  /**
   * Maximum audio file size in bytes accepted by the transcription endpoint.
   * @type {number}
   * @memberof ClientConfigDto
   */
  transcribeSizeLimitBytes: number;
  /**
   * Operator-configured default deployment ID. Null when not configured.
   * @type {string}
   * @memberof ClientConfigDto
   */
  defaultDeploymentId?: string | null;
  /**
   * Public-facing DIAL Core base URL reachable from the browser. Null when DIAL_CORE_EXTERNAL_URL is not configured.
   * @type {string}
   * @memberof ClientConfigDto
   */
  dialCoreExternalUrl?: string | null;
  /**
   * Which File Manager tabs are shown to users. Defaults to all three currently-supported tabs.
   * @type {Array<string>}
   * @memberof ClientConfigDto
   */
  fileManagerTabs: Array<string>;
  /**
   * Whether the chat-overlay embedded runtime mode is enabled. Sourced from OVERLAY_ENABLED.
   * @type {boolean}
   * @memberof ClientConfigDto
   */
  overlayEnabled: boolean;
  /**
   * Host origins allowed to embed this app. Sourced from ALLOWED_IFRAME_ORIGINS, the same list used for CSP frame-ancestors/frame-src.
   * @type {Array<string>}
   * @memberof ClientConfigDto
   */
  overlayAllowedOrigins: Array<string>;
  /**
   * When set, the complete list of OverlayFeature values that are enabled (replace semantics). Sourced from ENABLED_UI_FEATURES, filtered to recognized values. When null, the compiled-in DEFAULT_ENABLED_UI_FEATURES baseline is used. Does not affect an overlay host that supplies its own enabledFeatures.
   * @type {Array<string>}
   * @memberof ClientConfigDto
   */
  enabledUiFeatures: Array<string> | null;
  /**
   * Operator-authored HTML announcement message shown in a dismissible top-of-app banner. Null when ANNOUNCEMENT_HTML_MESSAGE is not configured.
   * @type {string}
   * @memberof ClientConfigDto
   */
  announcementHtml?: string | null;
  /**
   * Tool ID for the Deep Research deployment-configuration property. Null when DEEP_RESEARCH_TOOL_ID is not set.
   * @type {string}
   * @memberof ClientConfigDto
   */
  deepResearchToolId?: string | null;
  /**
   * Operator-authored HTML footer message shown below the chat input (desktop) and in the mobile user panel. Empty string when FOOTER_HTML_MESSAGE is not configured. Sanitized server-side; supports %%VERSION%% token.
   * @type {string}
   * @memberof ClientConfigDto
   */
  footerHtmlMessage: string;
  /**
   * Registry of MIME → visualizer iframe mappings. Sourced from CUSTOM_VISUALIZERS. Empty when unset — the feature is dark by default.
   * @type {Array<CustomVisualizerDto>}
   * @memberof ClientConfigDto
   */
  customVisualizers: Array<CustomVisualizerDto>;
  /**
   * Allowed claim/category names selectable as a publication access rule's source. Sourced from PUBLICATION_FILTER_SOURCES; falls back to the legacy default when unset or empty.
   * @type {Array<string>}
   * @memberof ClientConfigDto
   */
  publicationFilterSources: Array<string>;
}
/**
 *
 * @export
 * @interface ClientConfigMetadataDto
 */
export interface ClientConfigMetadataDto {
  /**
   * ISO timestamp when the config was resolved.
   * @type {string}
   * @memberof ClientConfigMetadataDto
   */
  resolvedAt: string;
  /**
   * Cache TTL in seconds applied to this response.
   * @type {number}
   * @memberof ClientConfigMetadataDto
   */
  cacheTtlSeconds: number;
}
/**
 *
 * @export
 * @interface ClientConfigResponseDto
 */
export interface ClientConfigResponseDto {
  /**
   * Application identifier.
   * @type {string}
   * @memberof ClientConfigResponseDto
   */
  appId: string;
  /**
   * Feature flags — boolean per feature key.
   * @type {object}
   * @memberof ClientConfigResponseDto
   */
  features: object;
  /**
   * Non-boolean configuration values.
   * @type {ClientConfigDto}
   * @memberof ClientConfigResponseDto
   */
  config: ClientConfigDto;
  /**
   * Resolution metadata.
   * @type {ClientConfigMetadataDto}
   * @memberof ClientConfigResponseDto
   */
  metadata?: ClientConfigMetadataDto;
}
/**
 *
 * @export
 * @interface ConversationDeletionFailureDto
 */
export interface ConversationDeletionFailureDto {
  /**
   * Conversation ID that failed to delete
   * @type {string}
   * @memberof ConversationDeletionFailureDto
   */
  id: string;
  /**
   * Stable application error code
   * @type {string}
   * @memberof ConversationDeletionFailureDto
   */
  code: ConversationDeletionFailureDtoCodeEnum;
}

/**
 * @export
 */
export const ConversationDeletionFailureDtoCodeEnum = {
  NotFound: 'NOT_FOUND',
  Forbidden: 'FORBIDDEN',
  UpstreamError: 'UPSTREAM_ERROR',
  Unknown: 'UNKNOWN',
} as const;
export type ConversationDeletionFailureDtoCodeEnum =
  (typeof ConversationDeletionFailureDtoCodeEnum)[keyof typeof ConversationDeletionFailureDtoCodeEnum];

/**
 *
 * @export
 * @interface ConversationDeletionResultDto
 */
export interface ConversationDeletionResultDto {
  /**
   * Total number of IDs received in the request (after deduplication)
   * @type {number}
   * @memberof ConversationDeletionResultDto
   */
  requested: number;
  /**
   * Number of conversations successfully deleted from DIAL Core
   * @type {number}
   * @memberof ConversationDeletionResultDto
   */
  deleted: number;
  /**
   * Number of IDs that were already absent from DIAL Core (counted as success)
   * @type {number}
   * @memberof ConversationDeletionResultDto
   */
  alreadyAbsent: number;
  /**
   * Items that could not be deleted
   * @type {Array<ConversationDeletionFailureDto>}
   * @memberof ConversationDeletionResultDto
   */
  failed: Array<ConversationDeletionFailureDto>;
}
/**
 *
 * @export
 * @interface ConversationListItemDto
 */
export interface ConversationListItemDto {
  /**
   * Full DIAL Core resource URL used as the stable conversation identifier.
   * @type {string}
   * @memberof ConversationListItemDto
   */
  id: string;
  /**
   * Human-readable conversation title (the resource `name` from DIAL Core).
   * @type {string}
   * @memberof ConversationListItemDto
   */
  title: string;
  /**
   * Unix epoch milliseconds of the last update.
   * @type {number}
   * @memberof ConversationListItemDto
   */
  updatedAt: number;
  /**
   * True when this conversation was shared with the current user by another user.
   * @type {boolean}
   * @memberof ConversationListItemDto
   */
  sharedWithMe: boolean;
  /**
   * True when this conversation was published to the organisation and is visible to the current user.
   * @type {boolean}
   * @memberof ConversationListItemDto
   */
  publishedWithMe: boolean;
  /**
   * True when the user has pinned this conversation.
   * @type {boolean}
   * @memberof ConversationListItemDto
   */
  isPinned: boolean;
  /**
   * True when the current user does not have WRITE permission on this conversation.
   * @type {boolean}
   * @memberof ConversationListItemDto
   */
  isReadonly: boolean;
}
/**
 *
 * @export
 * @interface ConversationListResponseDto
 */
export interface ConversationListResponseDto {
  /**
   *
   * @type {Array<ConversationListItemDto>}
   * @memberof ConversationListResponseDto
   */
  items: Array<ConversationListItemDto>;
  /**
   * Cursor for the next page. Present only when more results exist. Pass as `nextToken` in the next request.
   * @type {string}
   * @memberof ConversationListResponseDto
   */
  nextToken?: string;
}
/**
 *
 * @export
 * @interface ConversationMessageCustomContentDto
 */
export interface ConversationMessageCustomContentDto {
  /**
   * DIAL API attachments to include with the message
   * @type {Array<AttachmentDto>}
   * @memberof ConversationMessageCustomContentDto
   */
  attachments?: Array<AttachmentDto>;
  /**
   * Form/button submission value (e.g. `{ button: 1 }`).
   * @type {object}
   * @memberof ConversationMessageCustomContentDto
   */
  configurationValue?: object;
  /**
   * Key-value map of form field values submitted via an embedded form widget.
   * @type {object}
   * @memberof ConversationMessageCustomContentDto
   */
  formValue?: object;
  /**
   * Status event discriminator when role is status
   * @type {string}
   * @memberof ConversationMessageCustomContentDto
   */
  eventType?: ConversationMessageCustomContentDtoEventTypeEnum;
  /**
   * Deployment active before a model_changed event
   * @type {object}
   * @memberof ConversationMessageCustomContentDto
   */
  previousDeploymentId?: object | null;
  /**
   * Deployment selected after a model_changed event
   * @type {string}
   * @memberof ConversationMessageCustomContentDto
   */
  newDeploymentId?: string;
}

/**
 * @export
 */
export const ConversationMessageCustomContentDtoEventTypeEnum = {
  ModelChanged: 'model_changed',
} as const;
export type ConversationMessageCustomContentDtoEventTypeEnum =
  (typeof ConversationMessageCustomContentDtoEventTypeEnum)[keyof typeof ConversationMessageCustomContentDtoEventTypeEnum];

/**
 *
 * @export
 * @interface ConversationMessageDto
 */
export interface ConversationMessageDto {
  /**
   * Unique message identifier
   * @type {string}
   * @memberof ConversationMessageDto
   */
  id?: string;
  /**
   *
   * @type {string}
   * @memberof ConversationMessageDto
   */
  role: ConversationMessageDtoRoleEnum;
  /**
   *
   * @type {string}
   * @memberof ConversationMessageDto
   */
  content: string;
  /**
   *
   * @type {string}
   * @memberof ConversationMessageDto
   */
  timestamp: string;
  /**
   *
   * @type {ConversationMessageCustomContentDto}
   * @memberof ConversationMessageDto
   */
  customContent?: ConversationMessageCustomContentDto;
  /**
   * Error message when the generation ended in error. Presence signals a terminal error state; absence means the generation succeeded or is still in progress.
   * @type {string}
   * @memberof ConversationMessageDto
   */
  streamErrorMessage?: string;
}

/**
 * @export
 */
export const ConversationMessageDtoRoleEnum = {
  User: 'user',
  Assistant: 'assistant',
  Status: 'status',
} as const;
export type ConversationMessageDtoRoleEnum =
  (typeof ConversationMessageDtoRoleEnum)[keyof typeof ConversationMessageDtoRoleEnum];

/**
 *
 * @export
 * @interface ConversationMetadataDto
 */
export interface ConversationMetadataDto {
  /**
   *
   * @type {string}
   * @memberof ConversationMetadataDto
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof ConversationMetadataDto
   */
  author?: string;
  /**
   *
   * @type {string}
   * @memberof ConversationMetadataDto
   */
  parentPath: string;
  /**
   *
   * @type {string}
   * @memberof ConversationMetadataDto
   */
  bucket: string;
  /**
   *
   * @type {string}
   * @memberof ConversationMetadataDto
   */
  url: string;
  /**
   *
   * @type {string}
   * @memberof ConversationMetadataDto
   */
  nodeType: string;
  /**
   *
   * @type {string}
   * @memberof ConversationMetadataDto
   */
  resourceType: string;
  /**
   *
   * @type {string}
   * @memberof ConversationMetadataDto
   */
  etag?: string;
  /**
   *
   * @type {number}
   * @memberof ConversationMetadataDto
   */
  createdAt?: number;
  /**
   *
   * @type {number}
   * @memberof ConversationMetadataDto
   */
  updatedAt?: number;
  /**
   *
   * @type {Array<string>}
   * @memberof ConversationMetadataDto
   */
  permissions?: Array<string>;
}
/**
 *
 * @export
 * @interface ConversationModelDto
 */
export interface ConversationModelDto {
  /**
   *
   * @type {string}
   * @memberof ConversationModelDto
   */
  id: string;
}
/**
 *
 * @export
 * @interface ConversationResponseDto
 */
export interface ConversationResponseDto {
  /**
   *
   * @type {string}
   * @memberof ConversationResponseDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof ConversationResponseDto
   */
  folderId: string;
  /**
   *
   * @type {string}
   * @memberof ConversationResponseDto
   */
  name: string;
  /**
   *
   * @type {ConversationModelDto}
   * @memberof ConversationResponseDto
   */
  model: ConversationModelDto;
  /**
   *
   * @type {string}
   * @memberof ConversationResponseDto
   */
  prompt: string;
  /**
   *
   * @type {number}
   * @memberof ConversationResponseDto
   */
  temperature: number;
  /**
   *
   * @type {Array<ConversationMessageDto>}
   * @memberof ConversationResponseDto
   */
  messages: Array<ConversationMessageDto>;
  /**
   *
   * @type {number}
   * @memberof ConversationResponseDto
   */
  lastActivityDate: number;
  /**
   *
   * @type {number}
   * @memberof ConversationResponseDto
   */
  updatedAt: number;
  /**
   *
   * @type {Array<string>}
   * @memberof ConversationResponseDto
   */
  selectedAddons: Array<string>;
  /**
   *
   * @type {string}
   * @memberof ConversationResponseDto
   */
  assistantModelId: string;
  /**
   *
   * @type {string}
   * @memberof ConversationResponseDto
   */
  responseFormat?: ConversationResponseDtoResponseFormatEnum;
  /**
   * When true, automatic LLM conversation naming has already run for this conversation.
   * @type {boolean}
   * @memberof ConversationResponseDto
   */
  llmNamingDone?: boolean;
}

/**
 * @export
 */
export const ConversationResponseDtoResponseFormatEnum = {
  Markdown: 'markdown',
  PlainText: 'plain_text',
} as const;
export type ConversationResponseDtoResponseFormatEnum =
  (typeof ConversationResponseDtoResponseFormatEnum)[keyof typeof ConversationResponseDtoResponseFormatEnum];

/**
 *
 * @export
 * @interface ConversationStarterDto
 */
export interface ConversationStarterDto {
  /**
   * Starter button label
   * @type {string}
   * @memberof ConversationStarterDto
   */
  title: string;
  /**
   * Text inserted into the chat input
   * @type {string}
   * @memberof ConversationStarterDto
   */
  text: string;
}
/**
 *
 * @export
 * @interface ConversationStartersDto
 */
export interface ConversationStartersDto {
  /**
   * Optional text shown above the conversation starter buttons
   * @type {string}
   * @memberof ConversationStartersDto
   */
  introText?: string;
  /**
   * When true, starter buttons submit immediately after selection
   * @type {boolean}
   * @memberof ConversationStartersDto
   */
  autoSubmit?: boolean;
  /**
   * When true, the chat input is disabled and users can only use starters
   * @type {boolean}
   * @memberof ConversationStartersDto
   */
  chatMessageInputDisabled?: boolean;
  /**
   * Conversation starter buttons configured by the application
   * @type {Array<ConversationStarterDto>}
   * @memberof ConversationStartersDto
   */
  starters: Array<ConversationStarterDto>;
}
/**
 *
 * @export
 * @interface ConversationsConfigDto
 */
export interface ConversationsConfigDto {
  /**
   * Pinned conversation identifiers.
   * @type {Array<string>}
   * @memberof ConversationsConfigDto
   */
  pinnedIds: Array<string>;
}
/**
 *
 * @export
 * @interface CopyFilesDto
 */
export interface CopyFilesDto {
  /**
   *
   * @type {Array<CopyItemDto>}
   * @memberof CopyFilesDto
   */
  items: Array<CopyItemDto>;
}
/**
 *
 * @export
 * @interface CopyFilesResponseDto
 */
export interface CopyFilesResponseDto {
  /**
   *
   * @type {Array<CopyItemResultDto>}
   * @memberof CopyFilesResponseDto
   */
  results: Array<CopyItemResultDto>;
}
/**
 *
 * @export
 * @interface CopyItemDto
 */
export interface CopyItemDto {
  /**
   * DIAL Core bucket name
   * @type {string}
   * @memberof CopyItemDto
   */
  bucket: string;
  /**
   * Relative source path within bucket
   * @type {string}
   * @memberof CopyItemDto
   */
  sourcePath: string;
  /**
   * Relative destination path within bucket
   * @type {string}
   * @memberof CopyItemDto
   */
  destinationPath: string;
  /**
   * Whether to overwrite an existing destination resource
   * @type {boolean}
   * @memberof CopyItemDto
   */
  overwrite?: boolean;
  /**
   *
   * @type {string}
   * @memberof CopyItemDto
   */
  nodeType: CopyItemDtoNodeTypeEnum;
  /**
   * Display name (last segment) for error messages
   * @type {string}
   * @memberof CopyItemDto
   */
  name: string;
}

/**
 * @export
 */
export const CopyItemDtoNodeTypeEnum = {
  Item: 'item',
  Folder: 'folder',
} as const;
export type CopyItemDtoNodeTypeEnum =
  (typeof CopyItemDtoNodeTypeEnum)[keyof typeof CopyItemDtoNodeTypeEnum];

/**
 *
 * @export
 * @interface CopyItemResultDto
 */
export interface CopyItemResultDto {
  /**
   * Source path from request
   * @type {string}
   * @memberof CopyItemResultDto
   */
  sourcePath: string;
  /**
   * Destination path from request
   * @type {string}
   * @memberof CopyItemResultDto
   */
  destinationPath: string;
  /**
   * true when all Core copyResource calls succeeded
   * @type {boolean}
   * @memberof CopyItemResultDto
   */
  success: boolean;
  /**
   * Human-readable error reason when success is false
   * @type {string}
   * @memberof CopyItemResultDto
   */
  error?: string;
}
/**
 *
 * @export
 * @interface CreateApplicationBodyDto
 */
export interface CreateApplicationBodyDto {
  /**
   *
   * @type {string}
   * @memberof CreateApplicationBodyDto
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof CreateApplicationBodyDto
   */
  type: string;
  /**
   *
   * @type {string}
   * @memberof CreateApplicationBodyDto
   */
  description?: string;
  /**
   *
   * @type {string}
   * @memberof CreateApplicationBodyDto
   */
  iconUrl?: string;
  /**
   *
   * @type {string}
   * @memberof CreateApplicationBodyDto
   */
  version?: string;
  /**
   *
   * @type {Array<string>}
   * @memberof CreateApplicationBodyDto
   */
  topics?: Array<string>;
  /**
   *
   * @type {string}
   * @memberof CreateApplicationBodyDto
   */
  intro?: string;
  /**
   *
   * @type {object}
   * @memberof CreateApplicationBodyDto
   */
  applicationProperties?: object;
}
/**
 *
 * @export
 * @interface CreateConversationDto
 */
export interface CreateConversationDto {
  /**
   * The first message to start the conversation. May be empty when custom_content carries attachments, form_value, or configuration_value.
   * @type {string}
   * @memberof CreateConversationDto
   */
  firstMessage: string;
  /**
   * ID of the catalog item (model or application) to use for this conversation. May contain percent-encoded bytes.
   * @type {string}
   * @memberof CreateConversationDto
   */
  deploymentId: string;
  /**
   * Extra DIAL payload attached to the first user message
   * @type {MessageCustomContentDto}
   * @memberof CreateConversationDto
   */
  customContent?: MessageCustomContentDto;
}
/**
 *
 * @export
 * @interface CreateFolderDto
 */
export interface CreateFolderDto {
  /**
   * DIAL Core bucket name
   * @type {string}
   * @memberof CreateFolderDto
   */
  bucket: string;
  /**
   * Parent folder path within bucket (no leading slash, no ..)
   * @type {string}
   * @memberof CreateFolderDto
   */
  parentPath?: string;
  /**
   * Folder name
   * @type {string}
   * @memberof CreateFolderDto
   */
  name: string;
}
/**
 *
 * @export
 * @interface CreateFolderResponseDto
 */
export interface CreateFolderResponseDto {
  /**
   *
   * @type {string}
   * @memberof CreateFolderResponseDto
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof CreateFolderResponseDto
   */
  path: string;
  /**
   *
   * @type {string}
   * @memberof CreateFolderResponseDto
   */
  parentPath: string;
  /**
   *
   * @type {string}
   * @memberof CreateFolderResponseDto
   */
  bucket: string;
  /**
   *
   * @type {string}
   * @memberof CreateFolderResponseDto
   */
  nodeType: string;
  /**
   *
   * @type {string}
   * @memberof CreateFolderResponseDto
   */
  folderId: string;
}
/**
 *
 * @export
 * @interface CreatePromptDto
 */
export interface CreatePromptDto {
  /**
   * Prompt name. Must not contain a forward slash.
   * @type {string}
   * @memberof CreatePromptDto
   */
  name: string;
  /**
   * Optional description
   * @type {string}
   * @memberof CreatePromptDto
   */
  description?: string;
  /**
   * Prompt text. May contain {{variableName}} placeholders.
   * @type {string}
   * @memberof CreatePromptDto
   */
  content: string;
  /**
   * Parent folder path. Empty string or omit for root.
   * @type {string}
   * @memberof CreatePromptDto
   */
  folderId?: string;
}
/**
 *
 * @export
 * @interface CreatePromptFolderDto
 */
export interface CreatePromptFolderDto {
  /**
   * Folder name. Must not contain a forward slash.
   * @type {string}
   * @memberof CreatePromptFolderDto
   */
  name: string;
  /**
   * Parent folder path. Omit or leave empty to create at root.
   * @type {string}
   * @memberof CreatePromptFolderDto
   */
  parentId?: string;
}
/**
 *
 * @export
 * @interface CreateScheduledTaskBodyDto
 */
export interface CreateScheduledTaskBodyDto {
  /**
   *
   * @type {string}
   * @memberof CreateScheduledTaskBodyDto
   */
  displayName: string;
  /**
   *
   * @type {ScheduleTriggerDto}
   * @memberof CreateScheduledTaskBodyDto
   */
  trigger: ScheduleTriggerDto;
  /**
   *
   * @type {string}
   * @memberof CreateScheduledTaskBodyDto
   */
  model: string;
  /**
   *
   * @type {string}
   * @memberof CreateScheduledTaskBodyDto
   */
  prompt: string;
  /**
   *
   * @type {string}
   * @memberof CreateScheduledTaskBodyDto
   */
  description?: string;
  /**
   *
   * @type {boolean}
   * @memberof CreateScheduledTaskBodyDto
   */
  stream?: boolean;
}
/**
 *
 * @export
 * @interface CreateShareLinkDto
 */
export interface CreateShareLinkDto {
  /**
   * Identifier (DIAL Core resource path) of the entity to share.
   * @type {string}
   * @memberof CreateShareLinkDto
   */
  itemId: string;
  /**
   * Access levels granted to holders of the share link. Edit access implies view access, so this is `[View, Edit]` rather than `[Edit]` alone.
   * @type {Array<string>}
   * @memberof CreateShareLinkDto
   */
  access: Array<CreateShareLinkDtoAccessEnum>;
}

/**
 * @export
 */
export const CreateShareLinkDtoAccessEnum = {
  View: 'view',
  Edit: 'edit',
} as const;
export type CreateShareLinkDtoAccessEnum =
  (typeof CreateShareLinkDtoAccessEnum)[keyof typeof CreateShareLinkDtoAccessEnum];

/**
 *
 * @export
 * @interface CreatedApplicationDto
 */
export interface CreatedApplicationDto {
  /**
   *
   * @type {string}
   * @memberof CreatedApplicationDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof CreatedApplicationDto
   */
  displayName?: string;
  /**
   *
   * @type {string}
   * @memberof CreatedApplicationDto
   */
  object?: string;
}
/**
 *
 * @export
 * @interface CreatedScheduledTaskDto
 */
export interface CreatedScheduledTaskDto {
  /**
   *
   * @type {string}
   * @memberof CreatedScheduledTaskDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof CreatedScheduledTaskDto
   */
  displayName: string;
  /**
   *
   * @type {ScheduleTriggerDto}
   * @memberof CreatedScheduledTaskDto
   */
  trigger: ScheduleTriggerDto;
  /**
   *
   * @type {string}
   * @memberof CreatedScheduledTaskDto
   */
  nextRunTime?: string;
  /**
   *
   * @type {string}
   * @memberof CreatedScheduledTaskDto
   */
  createdAt?: string;
  /**
   *
   * @type {string}
   * @memberof CreatedScheduledTaskDto
   */
  updatedAt?: string;
  /**
   *
   * @type {string}
   * @memberof CreatedScheduledTaskDto
   */
  triggerType?: CreatedScheduledTaskDtoTriggerTypeEnum;
  /**
   *
   * @type {string}
   * @memberof CreatedScheduledTaskDto
   */
  serviceId?: string;
  /**
   *
   * @type {string}
   * @memberof CreatedScheduledTaskDto
   */
  createdBy?: string;
  /**
   *
   * @type {string}
   * @memberof CreatedScheduledTaskDto
   */
  description?: string;
}

/**
 * @export
 */
export const CreatedScheduledTaskDtoTriggerTypeEnum = {
  Cron: 'cron',
  Date: 'date',
} as const;
export type CreatedScheduledTaskDtoTriggerTypeEnum =
  (typeof CreatedScheduledTaskDtoTriggerTypeEnum)[keyof typeof CreatedScheduledTaskDtoTriggerTypeEnum];

/**
 *
 * @export
 * @interface CustomVisualizerDto
 */
export interface CustomVisualizerDto {
  /**
   * The postMessage protocol namespace, NOT a display label. Every message exchanged with the iframe is prefixed "${title}/…", and the visualizer application must be constructed with this identical string as its appName. A mismatch is a silent failure — the iframe loads but never receives data.
   * @type {string}
   * @memberof CustomVisualizerDto
   */
  title: string;
  /**
   * Human-readable description of the visualizer. Accepted for schema parity; not consumed by the host UI.
   * @type {string}
   * @memberof CustomVisualizerDto
   */
  description?: string;
  /**
   * Icon URL or identifier for the visualizer. Accepted for schema parity; not consumed by the host UI.
   * @type {string}
   * @memberof CustomVisualizerDto
   */
  icon?: string;
  /**
   * MIME type(s) this entry matches. Accepts a comma-separated list of MIME types (e.g. "application/vnd.plotly.v1+json, application/vnd.vega.v5+json").
   * @type {string}
   * @memberof CustomVisualizerDto
   */
  contentType: string;
  /**
   * Absolute HTTP(S) URL of the visualizer iframe.
   * @type {string}
   * @memberof CustomVisualizerDto
   */
  url: string;
  /**
   * Milliseconds to wait for a send() request response before rejecting. Defaults to 10000 when unset. Does not bound the initial READY_TO_INTERACT handshake.
   * @type {number}
   * @memberof CustomVisualizerDto
   */
  requestTimeout?: number;
  /**
   * Suggested initial width of the canvas panel in pixels.
   * @type {number}
   * @memberof CustomVisualizerDto
   */
  width?: number;
  /**
   * Suggested initial height of the canvas panel in pixels.
   * @type {number}
   * @memberof CustomVisualizerDto
   */
  height?: number;
  /**
   * Suggested canvas panel height on mobile-sized screens in pixels.
   * @type {number}
   * @memberof CustomVisualizerDto
   */
  mobileHeight?: number;
  /**
   * Whether the host should pass auth info to the visualizer. Accepted for schema parity; auth forwarding is not yet wired.
   * @type {boolean}
   * @memberof CustomVisualizerDto
   */
  passAuthInfo?: boolean;
  /**
   * Whether the host should pass an explicit access token. Accepted for schema parity; auth forwarding is not yet wired.
   * @type {boolean}
   * @memberof CustomVisualizerDto
   */
  passExplicitToken?: boolean;
}
/**
 *
 * @export
 * @interface DeleteAllConversationsBodyDto
 */
export interface DeleteAllConversationsBodyDto {
  /**
   * Must be `true` to confirm intentional deletion of all conversations.
   * @type {boolean}
   * @memberof DeleteAllConversationsBodyDto
   */
  confirm: boolean;
}
/**
 *
 * @export
 * @interface DeleteConversationsBodyDto
 */
export interface DeleteConversationsBodyDto {
  /**
   * Stable DIAL Core conversation IDs to delete. 1–100 IDs. Duplicates are silently deduplicated.
   * @type {Array<string>}
   * @memberof DeleteConversationsBodyDto
   */
  ids: Array<string>;
}
/**
 *
 * @export
 * @interface DeleteFilesDto
 */
export interface DeleteFilesDto {
  /**
   *
   * @type {Array<DeleteItemDto>}
   * @memberof DeleteFilesDto
   */
  items: Array<DeleteItemDto>;
}
/**
 *
 * @export
 * @interface DeleteFilesResponseDto
 */
export interface DeleteFilesResponseDto {
  /**
   *
   * @type {Array<DeleteItemResultDto>}
   * @memberof DeleteFilesResponseDto
   */
  results: Array<DeleteItemResultDto>;
}
/**
 *
 * @export
 * @interface DeleteItemDto
 */
export interface DeleteItemDto {
  /**
   * DIAL Core bucket name
   * @type {string}
   * @memberof DeleteItemDto
   */
  bucket: string;
  /**
   * File or folder path within the bucket
   * @type {string}
   * @memberof DeleteItemDto
   */
  path: string;
  /**
   * Display name (used in error messages)
   * @type {string}
   * @memberof DeleteItemDto
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof DeleteItemDto
   */
  nodeType: DeleteItemDtoNodeTypeEnum;
}

/**
 * @export
 */
export const DeleteItemDtoNodeTypeEnum = {
  Item: 'item',
  Folder: 'folder',
} as const;
export type DeleteItemDtoNodeTypeEnum =
  (typeof DeleteItemDtoNodeTypeEnum)[keyof typeof DeleteItemDtoNodeTypeEnum];

/**
 *
 * @export
 * @interface DeleteItemResultDto
 */
export interface DeleteItemResultDto {
  /**
   * Same path from the request
   * @type {string}
   * @memberof DeleteItemResultDto
   */
  path: string;
  /**
   * true when DIAL Core returned 2xx or 404
   * @type {boolean}
   * @memberof DeleteItemResultDto
   */
  success: boolean;
  /**
   * Human-readable error reason when success is false
   * @type {string}
   * @memberof DeleteItemResultDto
   */
  error?: string;
}
/**
 *
 * @export
 * @interface DeploymentConfigurationDto
 */
export interface DeploymentConfigurationDto {
  /**
   * JSON Schema type (typically "object")
   * @type {string}
   * @memberof DeploymentConfigurationDto
   */
  type?: string;
  /**
   * Human-readable schema title
   * @type {string}
   * @memberof DeploymentConfigurationDto
   */
  title?: string;
  /**
   * Named configuration properties supported by this deployment
   * @type {{ [key: string]: unknown }}
   * @memberof DeploymentConfigurationDto
   */
  properties?: { [key: string]: unknown };
  /**
   * Whether additional properties are allowed
   * @type {object}
   * @memberof DeploymentConfigurationDto
   */
  additionalProperties?: object;
  /**
   * When true, the application does not accept free-form text input; users interact only via form/action buttons.
   * @type {boolean}
   * @memberof DeploymentConfigurationDto
   */
  isChatMessageInputDisabled?: boolean;
}
/**
 *
 * @export
 * @interface DeploymentDetailsDto
 */
export interface DeploymentDetailsDto {
  /**
   * The requested deployment id
   * @type {string}
   * @memberof DeploymentDetailsDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof DeploymentDetailsDto
   */
  type: DeploymentDetailsDtoTypeEnum;
  /**
   *
   * @type {ModelDetailsDto}
   * @memberof DeploymentDetailsDto
   */
  modelDetails?: ModelDetailsDto;
  /**
   *
   * @type {ApplicationDetailsDto}
   * @memberof DeploymentDetailsDto
   */
  applicationDetails?: ApplicationDetailsDto;
  /**
   *
   * @type {ToolsetDetailsDto}
   * @memberof DeploymentDetailsDto
   */
  toolsetDetails?: ToolsetDetailsDto;
}

/**
 * @export
 */
export const DeploymentDetailsDtoTypeEnum = {
  Model: 'model',
  Application: 'application',
  Toolset: 'toolset',
} as const;
export type DeploymentDetailsDtoTypeEnum =
  (typeof DeploymentDetailsDtoTypeEnum)[keyof typeof DeploymentDetailsDtoTypeEnum];

/**
 *
 * @export
 * @interface DeploymentFeaturesDetailsDto
 */
export interface DeploymentFeaturesDetailsDto {
  /**
   * Supports the /rate endpoint
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  rate?: boolean;
  /**
   * Supports MCP requests
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  mcp?: boolean;
  /**
   * Supports the /tokenize endpoint
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  tokenize?: boolean;
  /**
   * Supports the /truncate_prompt endpoint
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  truncatePrompt?: boolean;
  /**
   * Exposes a JSON Schema configuration endpoint
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  hasConfigurationSchema?: boolean;
  /**
   * Supports a custom system prompt
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  systemPrompt?: boolean;
  /**
   * Supports tools/functions in chat completion requests
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  tools?: boolean;
  /**
   * Supports the seed parameter
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  seed?: boolean;
  /**
   * Supports URL attachments
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  urlAttachments?: boolean;
  /**
   * Supports folder attachments
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  folderAttachments?: boolean;
  /**
   * Supports resuming conversations
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  allowResume?: boolean;
  /**
   * Accessible using a per-request API key
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  accessibleByPerRequestKey?: boolean;
  /**
   * Supports content parts in messages
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  contentParts?: boolean;
  /**
   * Supports the temperature parameter
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  temperature?: boolean;
  /**
   * Supports LLM prompt caching
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  cache?: boolean;
  /**
   * Supports automatic prompt caching
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  autoCaching?: boolean;
  /**
   * Supports parallel tool calls
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  parallelToolCalls?: boolean;
  /**
   * Supports assistant attachments in the request
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  assistantAttachmentsInRequest?: boolean;
  /**
   * Supports chat completion requests
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  chatCompletion?: boolean;
  /**
   * Supports the responses API
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  responsesApi?: boolean;
  /**
   * Supports the max_tokens parameter
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  maxTokensSupported?: boolean;
  /**
   * Supports the max_completion_tokens parameter
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  maxCompletionTokensSupported?: boolean;
  /**
   * Supports a custom temperature value
   * @type {boolean}
   * @memberof DeploymentFeaturesDetailsDto
   */
  customTemperatureSupported?: boolean;
  /**
   * Supported reasoning-effort levels, e.g. ["low","medium","high"]
   * @type {Array<string>}
   * @memberof DeploymentFeaturesDetailsDto
   */
  reasoningEfforts?: Array<string>;
}
/**
 *
 * @export
 * @interface DeploymentFeaturesDto
 */
export interface DeploymentFeaturesDto {
  /**
   * Whether the deployment supports a custom system prompt
   * @type {boolean}
   * @memberof DeploymentFeaturesDto
   */
  systemPrompt: boolean;
  /**
   * Whether the deployment supports temperature control
   * @type {boolean}
   * @memberof DeploymentFeaturesDto
   */
  temperature: boolean;
  /**
   * Whether the deployment supports attaching folders from the file manager
   * @type {boolean}
   * @memberof DeploymentFeaturesDto
   */
  folderAttachments?: boolean;
  /**
   * Whether the deployment supports the MCP protocol
   * @type {boolean}
   * @memberof DeploymentFeaturesDto
   */
  mcp?: boolean;
}
/**
 *
 * @export
 * @interface DeploymentItemDto
 */
export interface DeploymentItemDto {
  /**
   * Unique stable identifier from DIAL Core
   * @type {string}
   * @memberof DeploymentItemDto
   */
  id: string;
  /**
   * Display name, falls back to id when absent
   * @type {string}
   * @memberof DeploymentItemDto
   */
  displayName: string;
  /**
   *
   * @type {string}
   * @memberof DeploymentItemDto
   */
  type: DeploymentItemDtoTypeEnum;
  /**
   * Icon URL from DIAL Core
   * @type {string}
   * @memberof DeploymentItemDto
   */
  iconUrl?: string;
  /**
   * Description from DIAL Core
   * @type {string}
   * @memberof DeploymentItemDto
   */
  description?: string;
  /**
   * Short catalog-friendly intro from DIAL Core
   * @type {string}
   * @memberof DeploymentItemDto
   */
  intro?: string;
  /**
   * Interface types supported by this deployment
   * @type {Array<string>}
   * @memberof DeploymentItemDto
   */
  interfaces?: Array<string>;
  /**
   * Display version from DIAL Core
   * @type {string}
   * @memberof DeploymentItemDto
   */
  displayVersion?: string;
  /**
   * Whether this deployment is featured (configured via env)
   * @type {boolean}
   * @memberof DeploymentItemDto
   */
  isFeatured?: boolean;
  /**
   * Whether this deployment is hidden (configured via env)
   * @type {boolean}
   * @memberof DeploymentItemDto
   */
  isHidden?: boolean;
  /**
   * Timestamp of last update time from DIAL Core (e.g. 1714768496000)
   * @type {number}
   * @memberof DeploymentItemDto
   */
  updatedAt?: number;
  /**
   * Timestamp of creation time from DIAL Core (e.g. 1714768496000)
   * @type {number}
   * @memberof DeploymentItemDto
   */
  createdAt?: number;
  /**
   * Application type schema id from DIAL Core (present only for application deployments)
   * @type {string}
   * @memberof DeploymentItemDto
   */
  applicationTypeSchemaId?: string;
  /**
   * Accepted MIME types for input attachments from DIAL Core (e.g. ["audio/*", "image/*"])
   * @type {Array<string>}
   * @memberof DeploymentItemDto
   */
  inputAttachmentTypes?: Array<string>;
  /**
   * Feature flags from DIAL Core controlling which per-conversation settings are available
   * @type {DeploymentFeaturesDto}
   * @memberof DeploymentItemDto
   */
  features?: DeploymentFeaturesDto;
  /**
   * Topics associated with this deployment from DIAL Core (e.g. ["topic1", "topic2"])
   * @type {Array<string>}
   * @memberof DeploymentItemDto
   */
  topics?: Array<string>;
  /**
   * Maximum number of attachments allowed per message; undefined when not specified by DIAL Core
   * @type {number}
   * @memberof DeploymentItemDto
   */
  maxInputAttachments?: number;
  /**
   * Whether this deployment is installed by the current user (from user config)
   * @type {boolean}
   * @memberof DeploymentItemDto
   */
  isInstalled?: boolean;
  /**
   * Owner of the deployment as reported by DIAL Core
   * @type {string}
   * @memberof DeploymentItemDto
   */
  owner?: string;
  /**
   * True when the deployment owner matches the current session user (computed post-cache)
   * @type {boolean}
   * @memberof DeploymentItemDto
   */
  isMy?: boolean;
  /**
   * True when the current user may edit this deployment — owns it, or was granted WRITE access via a share invitation
   * @type {boolean}
   * @memberof DeploymentItemDto
   */
  canEdit?: boolean;
  /**
   * True when this deployment is shared with the current user (READ or WRITE) and not owned by them
   * @type {boolean}
   * @memberof DeploymentItemDto
   */
  sharedWithMe?: boolean;
  /**
   * Parent folder path for application-type deployments (absent for root-level or non-application items)
   * @type {string}
   * @memberof DeploymentItemDto
   */
  applicationFolder?: string;
  /**
   * Quick Apps conversation starter settings from application properties
   * @type {ConversationStartersDto}
   * @memberof DeploymentItemDto
   */
  conversationStarters?: ConversationStartersDto;
}

/**
 * @export
 */
export const DeploymentItemDtoTypeEnum = {
  Model: 'model',
  Application: 'application',
  Toolset: 'toolset',
} as const;
export type DeploymentItemDtoTypeEnum =
  (typeof DeploymentItemDtoTypeEnum)[keyof typeof DeploymentItemDtoTypeEnum];

/**
 *
 * @export
 * @interface DeploymentLimitsResponseDto
 */
export interface DeploymentLimitsResponseDto {
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  hourRequestStats?: LimitStatsDto;
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  dayRequestStats?: LimitStatsDto;
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  minuteTokenStats?: LimitStatsDto;
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  dayTokenStats?: LimitStatsDto;
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  weekTokenStats?: LimitStatsDto;
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  monthTokenStats?: LimitStatsDto;
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  minuteCostStats?: LimitStatsDto;
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  dayCostStats?: LimitStatsDto;
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  weekCostStats?: LimitStatsDto;
  /**
   *
   * @type {LimitStatsDto}
   * @memberof DeploymentLimitsResponseDto
   */
  monthCostStats?: LimitStatsDto;
}
/**
 *
 * @export
 * @interface DeploymentsConfigDto
 */
export interface DeploymentsConfigDto {
  /**
   * Installed deployment identifiers.
   * @type {Array<string>}
   * @memberof DeploymentsConfigDto
   */
  installed: Array<string>;
  /**
   *
   * @type {string}
   * @memberof DeploymentsConfigDto
   */
  selectedId?: string | null;
}
/**
 *
 * @export
 * @interface DeploymentsResponseDto
 */
export interface DeploymentsResponseDto {
  /**
   *
   * @type {Array<DeploymentItemDto>}
   * @memberof DeploymentsResponseDto
   */
  deployments: Array<DeploymentItemDto>;
}
/**
 *
 * @export
 * @interface DialModelCapabilitiesDto
 */
export interface DialModelCapabilitiesDto {
  /**
   *
   * @type {Array<string>}
   * @memberof DialModelCapabilitiesDto
   */
  scaleTypes?: Array<string>;
  /**
   *
   * @type {boolean}
   * @memberof DialModelCapabilitiesDto
   */
  completion?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelCapabilitiesDto
   */
  chatCompletion?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelCapabilitiesDto
   */
  embeddings?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelCapabilitiesDto
   */
  fineTune?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelCapabilitiesDto
   */
  inference?: boolean;
}
/**
 *
 * @export
 * @interface DialModelDto
 */
export interface DialModelDto {
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  object: string;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  model?: string;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  displayName?: string;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  displayVersion?: string;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  iconUrl?: string;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  description?: string;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  reference?: string;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  owner?: string;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  status?: string;
  /**
   *
   * @type {number}
   * @memberof DialModelDto
   */
  createdAt?: number;
  /**
   *
   * @type {number}
   * @memberof DialModelDto
   */
  updatedAt?: number;
  /**
   *
   * @type {DialModelFeaturesDto}
   * @memberof DialModelDto
   */
  features?: DialModelFeaturesDto;
  /**
   *
   * @type {Array<string>}
   * @memberof DialModelDto
   */
  inputAttachmentTypes?: Array<string>;
  /**
   *
   * @type {number}
   * @memberof DialModelDto
   */
  maxInputAttachments?: number;
  /**
   *
   * @type {{ [key: string]: unknown }}
   * @memberof DialModelDto
   */
  defaults?: { [key: string]: unknown };
  /**
   *
   * @type {{ [key: string]: unknown }}
   * @memberof DialModelDto
   */
  responsesDefaults?: { [key: string]: unknown };
  /**
   *
   * @type {Array<string>}
   * @memberof DialModelDto
   */
  descriptionKeywords?: Array<string>;
  /**
   *
   * @type {number}
   * @memberof DialModelDto
   */
  maxRetryAttempts?: number;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  lifecycleStatus?: string;
  /**
   *
   * @type {DialModelCapabilitiesDto}
   * @memberof DialModelDto
   */
  capabilities?: DialModelCapabilitiesDto;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  tokenizerModel?: string;
  /**
   *
   * @type {DialModelLimitsDto}
   * @memberof DialModelDto
   */
  limits?: DialModelLimitsDto;
  /**
   *
   * @type {DialModelPricingDto}
   * @memberof DialModelDto
   */
  pricing?: DialModelPricingDto;
  /**
   *
   * @type {Array<string>}
   * @memberof DialModelDto
   */
  interfaces?: Array<string>;
}
/**
 *
 * @export
 * @interface DialModelFeaturesDto
 */
export interface DialModelFeaturesDto {
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  rate?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  tokenize?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  truncatePrompt?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  _configuration?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  systemPrompt?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  tools?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  seed?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  urlAttachments?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  folderAttachments?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  allowResume?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  accessibleByPerRequestKey?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  contentParts?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  temperature?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  cache?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  autoCaching?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  parallelToolCalls?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  assistantAttachmentsInRequest?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  mcp?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  chatCompletion?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  responsesApi?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  maxTokensSupported?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  maxCompletionTokensSupported?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialModelFeaturesDto
   */
  customTemperatureSupported?: boolean;
  /**
   *
   * @type {Array<string>}
   * @memberof DialModelFeaturesDto
   */
  reasoningEfforts?: Array<string>;
}
/**
 *
 * @export
 * @interface DialModelLimitsDto
 */
export interface DialModelLimitsDto {
  /**
   *
   * @type {number}
   * @memberof DialModelLimitsDto
   */
  maxPromptTokens?: number;
  /**
   *
   * @type {number}
   * @memberof DialModelLimitsDto
   */
  maxCompletionTokens?: number;
}
/**
 *
 * @export
 * @interface DialModelListResponseDto
 */
export interface DialModelListResponseDto {
  /**
   *
   * @type {Array<DialModelDto>}
   * @memberof DialModelListResponseDto
   */
  data: Array<DialModelDto>;
}
/**
 *
 * @export
 * @interface DialModelPricingDto
 */
export interface DialModelPricingDto {
  /**
   *
   * @type {string}
   * @memberof DialModelPricingDto
   */
  unit?: string;
  /**
   *
   * @type {string}
   * @memberof DialModelPricingDto
   */
  prompt?: string;
  /**
   *
   * @type {string}
   * @memberof DialModelPricingDto
   */
  completion?: string;
}
/**
 *
 * @export
 * @interface DialToolsetAuthSettingsDto
 */
export interface DialToolsetAuthSettingsDto {
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  authenticationType: DialToolsetAuthSettingsDtoAuthenticationTypeEnum;
  /**
   * Whether DIAL Core dynamically registered the OAuth client instead of using user-provided client configuration
   * @type {boolean}
   * @memberof DialToolsetAuthSettingsDto
   */
  dynamicallyRegistered?: boolean;
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  apiKeyHeader?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  clientId?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  redirectUri?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  authorizationEndpoint?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  tokenEndpoint?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  codeChallenge?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  codeChallengeMethod?: string;
  /**
   *
   * @type {Array<string>}
   * @memberof DialToolsetAuthSettingsDto
   */
  scopesSupported?: Array<string>;
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  globalAuthStatus?: DialToolsetAuthSettingsDtoGlobalAuthStatusEnum;
  /**
   *
   * @type {string}
   * @memberof DialToolsetAuthSettingsDto
   */
  userLevelAuthStatus?: DialToolsetAuthSettingsDtoUserLevelAuthStatusEnum;
}

/**
 * @export
 */
export const DialToolsetAuthSettingsDtoAuthenticationTypeEnum = {
  Oauth: 'OAUTH',
  ApiKey: 'API_KEY',
  None: 'NONE',
} as const;
export type DialToolsetAuthSettingsDtoAuthenticationTypeEnum =
  (typeof DialToolsetAuthSettingsDtoAuthenticationTypeEnum)[keyof typeof DialToolsetAuthSettingsDtoAuthenticationTypeEnum];

/**
 * @export
 */
export const DialToolsetAuthSettingsDtoGlobalAuthStatusEnum = {
  SignedIn: 'SIGNED_IN',
  SignedOut: 'SIGNED_OUT',
} as const;
export type DialToolsetAuthSettingsDtoGlobalAuthStatusEnum =
  (typeof DialToolsetAuthSettingsDtoGlobalAuthStatusEnum)[keyof typeof DialToolsetAuthSettingsDtoGlobalAuthStatusEnum];

/**
 * @export
 */
export const DialToolsetAuthSettingsDtoUserLevelAuthStatusEnum = {
  SignedIn: 'SIGNED_IN',
  SignedOut: 'SIGNED_OUT',
} as const;
export type DialToolsetAuthSettingsDtoUserLevelAuthStatusEnum =
  (typeof DialToolsetAuthSettingsDtoUserLevelAuthStatusEnum)[keyof typeof DialToolsetAuthSettingsDtoUserLevelAuthStatusEnum];

/**
 *
 * @export
 * @interface DialToolsetDto
 */
export interface DialToolsetDto {
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  toolset: string;
  /**
   * Human-readable name. In `listToolsets` results this is always populated: `displayName` when set, otherwise the last path segment of `id`.
   * @type {string}
   * @memberof DialToolsetDto
   */
  displayName?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  displayVersion?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  description?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  intro?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  iconUrl?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  owner?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  object?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  status?: string;
  /**
   *
   * @type {Array<string>}
   * @memberof DialToolsetDto
   */
  descriptionKeywords?: Array<string>;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  reference?: string;
  /**
   *
   * @type {number}
   * @memberof DialToolsetDto
   */
  maxRetryAttempts?: number;
  /**
   *
   * @type {number}
   * @memberof DialToolsetDto
   */
  createdAt?: number;
  /**
   *
   * @type {number}
   * @memberof DialToolsetDto
   */
  updatedAt?: number;
  /**
   *
   * @type {DialToolsetFeaturesDto}
   * @memberof DialToolsetDto
   */
  features?: DialToolsetFeaturesDto;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  endpoint?: string;
  /**
   *
   * @type {string}
   * @memberof DialToolsetDto
   */
  transport?: string;
  /**
   *
   * @type {Array<string>}
   * @memberof DialToolsetDto
   */
  allowedTools?: Array<string>;
  /**
   *
   * @type {DialToolsetAuthSettingsDto}
   * @memberof DialToolsetDto
   */
  authSettings?: DialToolsetAuthSettingsDto;
  /**
   * Whether this toolset is installed by the current user
   * @type {boolean}
   * @memberof DialToolsetDto
   */
  isInstalled?: boolean;
  /**
   * True when the toolset id/path belongs to the current session user bucket
   * @type {boolean}
   * @memberof DialToolsetDto
   */
  isMy?: boolean;
  /**
   * True when the current user may edit this toolset — owns it, or was granted WRITE access via a share invitation
   * @type {boolean}
   * @memberof DialToolsetDto
   */
  canEdit?: boolean;
  /**
   * True when this toolset is shared with the current user (READ or WRITE) and not owned by them
   * @type {boolean}
   * @memberof DialToolsetDto
   */
  sharedWithMe?: boolean;
}
/**
 *
 * @export
 * @interface DialToolsetFeaturesDto
 */
export interface DialToolsetFeaturesDto {
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  rate?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  tokenize?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  truncatePrompt?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  _configuration?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  systemPrompt?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  tools?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  seed?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  urlAttachments?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  folderAttachments?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  allowResume?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  accessibleByPerRequestKey?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  contentParts?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  temperature?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  cache?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  autoCaching?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  parallelToolCalls?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  assistantAttachmentsInRequest?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  mcp?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  chatCompletion?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  responsesApi?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  maxTokensSupported?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  maxCompletionTokensSupported?: boolean;
  /**
   *
   * @type {boolean}
   * @memberof DialToolsetFeaturesDto
   */
  customTemperatureSupported?: boolean;
  /**
   *
   * @type {Array<string>}
   * @memberof DialToolsetFeaturesDto
   */
  reasoningEfforts?: Array<string>;
}
/**
 *
 * @export
 * @interface DialToolsetListResponseDto
 */
export interface DialToolsetListResponseDto {
  /**
   *
   * @type {Array<DialToolsetDto>}
   * @memberof DialToolsetListResponseDto
   */
  data: Array<DialToolsetDto>;
}
/**
 *
 * @export
 * @interface DiscardSharedCatalogItemDto
 */
export interface DiscardSharedCatalogItemDto {
  /**
   * Identifier (DIAL Core resource path) of the catalog item or conversation to discard access to.
   * @type {string}
   * @memberof DiscardSharedCatalogItemDto
   */
  itemId: string;
}
/**
 *
 * @export
 * @interface DiscardSharedCatalogItemResponseDto
 */
export interface DiscardSharedCatalogItemResponseDto {
  /**
   * true when the discard call succeeded
   * @type {boolean}
   * @memberof DiscardSharedCatalogItemResponseDto
   */
  success: boolean;
}
/**
 *
 * @export
 * @interface DiscardSharedDto
 */
export interface DiscardSharedDto {
  /**
   *
   * @type {Array<DiscardSharedItemDto>}
   * @memberof DiscardSharedDto
   */
  items: Array<DiscardSharedItemDto>;
}
/**
 *
 * @export
 * @interface DiscardSharedItemDto
 */
export interface DiscardSharedItemDto {
  /**
   * DIAL Core bucket name
   * @type {string}
   * @memberof DiscardSharedItemDto
   */
  bucket: string;
  /**
   * Relative path within bucket
   * @type {string}
   * @memberof DiscardSharedItemDto
   */
  path: string;
}
/**
 *
 * @export
 * @interface DiscardSharedResponseDto
 */
export interface DiscardSharedResponseDto {
  /**
   * true when the Core discard call succeeded
   * @type {boolean}
   * @memberof DiscardSharedResponseDto
   */
  success: boolean;
}
/**
 *
 * @export
 * @interface DownloadArchiveDto
 */
export interface DownloadArchiveDto {
  /**
   *
   * @type {Array<ArchiveItemDto>}
   * @memberof DownloadArchiveDto
   */
  items: Array<ArchiveItemDto>;
}
/**
 *
 * @export
 * @interface DuplicateConversationResponseDto
 */
export interface DuplicateConversationResponseDto {
  /**
   * Path of the newly created duplicate conversation
   * @type {string}
   * @memberof DuplicateConversationResponseDto
   */
  newPath: string;
}
/**
 *
 * @export
 * @interface FileMetadataResponseDto
 */
export interface FileMetadataResponseDto {
  /**
   * File name without path
   * @type {string}
   * @memberof FileMetadataResponseDto
   */
  name?: string;
  /**
   * Node type, expected "item" for files
   * @type {string}
   * @memberof FileMetadataResponseDto
   */
  nodeType?: string;
  /**
   *
   * @type {string}
   * @memberof FileMetadataResponseDto
   */
  bucket?: string;
  /**
   *
   * @type {string}
   * @memberof FileMetadataResponseDto
   */
  parentPath?: string;
  /**
   * DIAL Core resource URL
   * @type {string}
   * @memberof FileMetadataResponseDto
   */
  url?: string;
  /**
   *
   * @type {string}
   * @memberof FileMetadataResponseDto
   */
  resourceType?: string;
  /**
   * ETag; not available for folders
   * @type {string}
   * @memberof FileMetadataResponseDto
   */
  etag?: string;
  /**
   *
   * @type {number}
   * @memberof FileMetadataResponseDto
   */
  contentLength?: number;
  /**
   *
   * @type {string}
   * @memberof FileMetadataResponseDto
   */
  contentType?: string;
  /**
   * Creation time in Unix milliseconds; not supported by all storage providers
   * @type {number}
   * @memberof FileMetadataResponseDto
   */
  createdAt?: number;
  /**
   * Last-modified time in Unix milliseconds
   * @type {number}
   * @memberof FileMetadataResponseDto
   */
  updatedAt?: number;
  /**
   * READ | WRITE | SHARE
   * @type {Array<string>}
   * @memberof FileMetadataResponseDto
   */
  permissions?: Array<string>;
  /**
   * Author; not available for folders
   * @type {string}
   * @memberof FileMetadataResponseDto
   */
  author?: string;
}
/**
 *
 * @export
 * @interface FileUploadResponseDto
 */
export interface FileUploadResponseDto {
  /**
   * DIAL Core URL of the uploaded file
   * @type {string}
   * @memberof FileUploadResponseDto
   */
  url: string;
}
/**
 *
 * @export
 * @interface GenerateTitleResponseDto
 */
export interface GenerateTitleResponseDto {
  /**
   * Sanitised LLM-generated title suggestion for the conversation. Not persisted — the caller confirms the rename separately.
   * @type {string}
   * @memberof GenerateTitleResponseDto
   */
  name: string;
}
/**
 *
 * @export
 * @interface LimitStatsDto
 */
export interface LimitStatsDto {
  /**
   *
   * @type {number}
   * @memberof LimitStatsDto
   */
  total: number;
  /**
   *
   * @type {number}
   * @memberof LimitStatsDto
   */
  used: number;
}
/**
 *
 * @export
 * @interface ListFilesItemDto
 */
export interface ListFilesItemDto {
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  path: string;
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  folderId: string;
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  nodeType: ListFilesItemDtoNodeTypeEnum;
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  bucket: string;
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  parentPath?: string;
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  url?: string;
  /**
   *
   * @type {number}
   * @memberof ListFilesItemDto
   */
  contentLength?: number;
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  contentType?: string;
  /**
   * Unix timestamp ms
   * @type {number}
   * @memberof ListFilesItemDto
   */
  updatedAt?: number;
  /**
   *
   * @type {Array<string>}
   * @memberof ListFilesItemDto
   */
  permissions?: Array<string>;
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  resourceType?: string;
  /**
   *
   * @type {string}
   * @memberof ListFilesItemDto
   */
  author?: string;
}

/**
 * @export
 */
export const ListFilesItemDtoNodeTypeEnum = {
  Item: 'item',
  Folder: 'folder',
} as const;
export type ListFilesItemDtoNodeTypeEnum =
  (typeof ListFilesItemDtoNodeTypeEnum)[keyof typeof ListFilesItemDtoNodeTypeEnum];

/**
 *
 * @export
 * @interface ListFilesResponseDto
 */
export interface ListFilesResponseDto {
  /**
   *
   * @type {string}
   * @memberof ListFilesResponseDto
   */
  bucket: string;
  /**
   *
   * @type {string}
   * @memberof ListFilesResponseDto
   */
  path: string;
  /**
   *
   * @type {Array<ListFilesItemDto>}
   * @memberof ListFilesResponseDto
   */
  items: Array<ListFilesItemDto>;
  /**
   *
   * @type {string}
   * @memberof ListFilesResponseDto
   */
  nextToken?: string;
  /**
   * READ/WRITE/SHARE permissions on the listed folder
   * @type {Array<string>}
   * @memberof ListFilesResponseDto
   */
  permissions?: Array<string>;
}
/**
 *
 * @export
 * @interface ListScheduledTasksResponseDto
 */
export interface ListScheduledTasksResponseDto {
  /**
   *
   * @type {Array<ScheduledTaskDto>}
   * @memberof ListScheduledTasksResponseDto
   */
  items: Array<ScheduledTaskDto>;
  /**
   * Total number of schedules upstream, across all pages.
   * @type {number}
   * @memberof ListScheduledTasksResponseDto
   */
  count?: number;
  /**
   * Page size used by the upstream DIAL Scheduler response.
   * @type {number}
   * @memberof ListScheduledTasksResponseDto
   */
  limit?: number;
  /**
   * Offset of `items` within the full upstream result set.
   * @type {number}
   * @memberof ListScheduledTasksResponseDto
   */
  offset?: number;
  /**
   * Upstream URL for the next page, or null if this is the last page.
   * @type {string}
   * @memberof ListScheduledTasksResponseDto
   */
  next?: string | null;
  /**
   * Upstream URL for the previous page, or null if this is the first page.
   * @type {string}
   * @memberof ListScheduledTasksResponseDto
   */
  previous?: string | null;
}
/**
 *
 * @export
 * @interface MessageCustomContentDto
 */
export interface MessageCustomContentDto {
  /**
   * DIAL API attachments to include with the message
   * @type {Array<AttachmentDto>}
   * @memberof MessageCustomContentDto
   */
  attachments?: Array<AttachmentDto>;
  /**
   * Form/button submission value (e.g. `{ button: 1 }`).
   * @type {object}
   * @memberof MessageCustomContentDto
   */
  configurationValue?: object;
  /**
   * Key-value map of form field values submitted via an embedded form widget.
   * @type {object}
   * @memberof MessageCustomContentDto
   */
  formValue?: object;
}
/**
 *
 * @export
 * @interface MessageDto
 */
export interface MessageDto {
  /**
   * Unique message identifier
   * @type {string}
   * @memberof MessageDto
   */
  id?: string;
  /**
   * Message author role
   * @type {string}
   * @memberof MessageDto
   */
  role: MessageDtoRoleEnum;
  /**
   * Message text content
   * @type {string}
   * @memberof MessageDto
   */
  content: string;
  /**
   * ISO-8601 timestamp of when the message was created
   * @type {string}
   * @memberof MessageDto
   */
  timestamp?: string;
  /**
   * Extra DIAL payload attached to the message
   * @type {MessageCustomContentDto}
   * @memberof MessageDto
   */
  customContent?: MessageCustomContentDto;
}

/**
 * @export
 */
export const MessageDtoRoleEnum = {
  System: 'system',
  User: 'user',
  Assistant: 'assistant',
} as const;
export type MessageDtoRoleEnum =
  (typeof MessageDtoRoleEnum)[keyof typeof MessageDtoRoleEnum];

/**
 *
 * @export
 * @interface ModelCapabilitiesDto
 */
export interface ModelCapabilitiesDto {
  /**
   * True if the model is a completion
   * @type {boolean}
   * @memberof ModelCapabilitiesDto
   */
  completion?: boolean;
  /**
   * True if the model is a chat completion
   * @type {boolean}
   * @memberof ModelCapabilitiesDto
   */
  chatCompletion?: boolean;
  /**
   * True if the model is an embedding
   * @type {boolean}
   * @memberof ModelCapabilitiesDto
   */
  embeddings?: boolean;
  /**
   * True if it is a fine-tuned model
   * @type {boolean}
   * @memberof ModelCapabilitiesDto
   */
  fineTune?: boolean;
  /**
   * True if the model can be deployed
   * @type {boolean}
   * @memberof ModelCapabilitiesDto
   */
  inference?: boolean;
  /**
   * Scale types of the model (defaults to ["standard"])
   * @type {Array<string>}
   * @memberof ModelCapabilitiesDto
   */
  scaleTypes?: Array<string>;
}
/**
 *
 * @export
 * @interface ModelDetailsDto
 */
export interface ModelDetailsDto {
  /**
   *
   * @type {ModelCapabilitiesDto}
   * @memberof ModelDetailsDto
   */
  capabilities?: ModelCapabilitiesDto;
  /**
   * Lifecycle status of the model
   * @type {string}
   * @memberof ModelDetailsDto
   */
  lifecycleStatus?: string;
  /**
   * Name of the model whose tokenization algorithm this model uses
   * @type {string}
   * @memberof ModelDetailsDto
   */
  tokenizerModel?: string;
  /**
   *
   * @type {ModelLimitsDto}
   * @memberof ModelDetailsDto
   */
  limits?: ModelLimitsDto;
  /**
   *
   * @type {ModelPricingDto}
   * @memberof ModelDetailsDto
   */
  pricing?: ModelPricingDto;
  /**
   *
   * @type {DeploymentFeaturesDetailsDto}
   * @memberof ModelDetailsDto
   */
  features?: DeploymentFeaturesDetailsDto;
  /**
   * Owner of the deployment as reported by DIAL Core
   * @type {string}
   * @memberof ModelDetailsDto
   */
  owner?: string;
  /**
   * Accepted MIME types for input attachments
   * @type {Array<string>}
   * @memberof ModelDetailsDto
   */
  inputAttachmentTypes?: Array<string>;
  /**
   * Default max_tokens value applied when a request omits it
   * @type {number}
   * @memberof ModelDetailsDto
   */
  defaultMaxTokens?: number;
  /**
   * Timestamp of creation time from DIAL Core (e.g. 1714768496000)
   * @type {number}
   * @memberof ModelDetailsDto
   */
  createdAt?: number;
}
/**
 *
 * @export
 * @interface ModelLimitsDto
 */
export interface ModelLimitsDto {
  /**
   * Maximum number of tokens allowed in a completion request and response combined
   * @type {number}
   * @memberof ModelLimitsDto
   */
  maxTotalTokens?: number;
  /**
   * Maximum number of tokens allowed in a completion request
   * @type {number}
   * @memberof ModelLimitsDto
   */
  maxPromptTokens?: number;
  /**
   * Maximum number of tokens allowed in a completion response
   * @type {number}
   * @memberof ModelLimitsDto
   */
  maxCompletionTokens?: number;
}
/**
 *
 * @export
 * @interface ModelPricingDto
 */
export interface ModelPricingDto {
  /**
   * The pricing unit
   * @type {string}
   * @memberof ModelPricingDto
   */
  unit?: string;
  /**
   * Per-unit price for the completion request
   * @type {string}
   * @memberof ModelPricingDto
   */
  prompt?: string;
  /**
   * Per-unit price for the completion response
   * @type {string}
   * @memberof ModelPricingDto
   */
  completion?: string;
}
/**
 *
 * @export
 * @interface MoveFilesDto
 */
export interface MoveFilesDto {
  /**
   *
   * @type {Array<MoveItemDto>}
   * @memberof MoveFilesDto
   */
  items: Array<MoveItemDto>;
}
/**
 *
 * @export
 * @interface MoveFilesResponseDto
 */
export interface MoveFilesResponseDto {
  /**
   *
   * @type {Array<MoveItemResultDto>}
   * @memberof MoveFilesResponseDto
   */
  results: Array<MoveItemResultDto>;
}
/**
 *
 * @export
 * @interface MoveItemDto
 */
export interface MoveItemDto {
  /**
   * DIAL Core bucket name
   * @type {string}
   * @memberof MoveItemDto
   */
  bucket: string;
  /**
   * Relative source path within bucket
   * @type {string}
   * @memberof MoveItemDto
   */
  sourcePath: string;
  /**
   * Relative destination path within bucket
   * @type {string}
   * @memberof MoveItemDto
   */
  destinationPath: string;
  /**
   * Whether to overwrite an existing destination resource
   * @type {boolean}
   * @memberof MoveItemDto
   */
  overwrite?: boolean;
  /**
   *
   * @type {string}
   * @memberof MoveItemDto
   */
  nodeType: MoveItemDtoNodeTypeEnum;
  /**
   * Display name (last segment) for error messages
   * @type {string}
   * @memberof MoveItemDto
   */
  name: string;
}

/**
 * @export
 */
export const MoveItemDtoNodeTypeEnum = {
  Item: 'item',
  Folder: 'folder',
} as const;
export type MoveItemDtoNodeTypeEnum =
  (typeof MoveItemDtoNodeTypeEnum)[keyof typeof MoveItemDtoNodeTypeEnum];

/**
 *
 * @export
 * @interface MoveItemResultDto
 */
export interface MoveItemResultDto {
  /**
   * Source path from request
   * @type {string}
   * @memberof MoveItemResultDto
   */
  sourcePath: string;
  /**
   * Destination path from request
   * @type {string}
   * @memberof MoveItemResultDto
   */
  destinationPath: string;
  /**
   * true when all Core moveResource calls succeeded
   * @type {boolean}
   * @memberof MoveItemResultDto
   */
  success: boolean;
  /**
   * Human-readable error reason when success is false
   * @type {string}
   * @memberof MoveItemResultDto
   */
  error?: string;
}
/**
 *
 * @export
 * @interface MovePromptDto
 */
export interface MovePromptDto {
  /**
   * Target folder path. Empty string to move to root.
   * @type {string}
   * @memberof MovePromptDto
   */
  targetFolderId: string;
}
/**
 *
 * @export
 * @interface MutatedToolsetDto
 */
export interface MutatedToolsetDto {
  /**
   *
   * @type {string}
   * @memberof MutatedToolsetDto
   */
  id: string;
}
/**
 *
 * @export
 * @interface PromptFolderResponseDto
 */
export interface PromptFolderResponseDto {
  /**
   * Folder path within the prompts namespace
   * @type {string}
   * @memberof PromptFolderResponseDto
   */
  id: string;
  /**
   * Last path segment (display name)
   * @type {string}
   * @memberof PromptFolderResponseDto
   */
  name: string;
}
/**
 *
 * @export
 * @interface PromptListResponseDto
 */
export interface PromptListResponseDto {
  /**
   *
   * @type {Array<PromptResponseDto>}
   * @memberof PromptListResponseDto
   */
  prompts: Array<PromptResponseDto>;
  /**
   *
   * @type {Array<PromptFolderResponseDto>}
   * @memberof PromptListResponseDto
   */
  folders: Array<PromptFolderResponseDto>;
  /**
   *
   * @type {Array<PromptResponseDto>}
   * @memberof PromptListResponseDto
   */
  sharedWithMe: Array<PromptResponseDto>;
}
/**
 *
 * @export
 * @interface PromptResponseDto
 */
export interface PromptResponseDto {
  /**
   * Prompt path within the prompts namespace (used as stable ID)
   * @type {string}
   * @memberof PromptResponseDto
   */
  id: string;
  /**
   * Display name
   * @type {string}
   * @memberof PromptResponseDto
   */
  name: string;
  /**
   * Optional description
   * @type {string}
   * @memberof PromptResponseDto
   */
  description?: string;
  /**
   * Prompt text content
   * @type {string}
   * @memberof PromptResponseDto
   */
  content: string;
  /**
   * Parent folder path; empty string means root
   * @type {string}
   * @memberof PromptResponseDto
   */
  folderId: string;
  /**
   * Creation timestamp (Unix ms)
   * @type {number}
   * @memberof PromptResponseDto
   */
  createdAt: number;
  /**
   * Last update timestamp (Unix ms)
   * @type {number}
   * @memberof PromptResponseDto
   */
  updatedAt: number;
}
/**
 *
 * @export
 * @interface ProviderInfoDto
 */
export interface ProviderInfoDto {
  /**
   *
   * @type {string}
   * @memberof ProviderInfoDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof ProviderInfoDto
   */
  label: string;
}
/**
 *
 * @export
 * @interface PublicPromptListResponseDto
 */
export interface PublicPromptListResponseDto {
  /**
   *
   * @type {Array<PromptResponseDto>}
   * @memberof PublicPromptListResponseDto
   */
  prompts: Array<PromptResponseDto>;
  /**
   *
   * @type {Array<PromptFolderResponseDto>}
   * @memberof PublicPromptListResponseDto
   */
  folders: Array<PromptFolderResponseDto>;
}
/**
 *
 * @export
 * @interface PublishCatalogEntityDto
 */
export interface PublishCatalogEntityDto {
  /**
   * Destination folder under the Organization/public bucket, forwarded to DIAL Core as `targetFolder`.
   * @type {string}
   * @memberof PublishCatalogEntityDto
   */
  folderPath: string;
  /**
   * Version label for this publish.
   * @type {string}
   * @memberof PublishCatalogEntityDto
   */
  version: string;
  /**
   * Access-restriction rules combined with AND; forwarded to DIAL Core unchanged. Omitted or empty means no additional restriction.
   * @type {Array<PublishRuleDto>}
   * @memberof PublishCatalogEntityDto
   */
  rules?: Array<PublishRuleDto>;
}
/**
 *
 * @export
 * @interface PublishConversationDto
 */
export interface PublishConversationDto {
  /**
   * Destination folder under the Organization/public bucket, forwarded to DIAL Core as `targetFolder`.
   * @type {string}
   * @memberof PublishConversationDto
   */
  folderPath: string;
  /**
   * Access-restriction rules combined with AND; forwarded to DIAL Core unchanged. Omitted or empty means no additional restriction.
   * @type {Array<PublishRuleDto>}
   * @memberof PublishConversationDto
   */
  rules?: Array<PublishRuleDto>;
}
/**
 *
 * @export
 * @interface PublishConversationResultDto
 */
export interface PublishConversationResultDto {
  /**
   *
   * @type {string}
   * @memberof PublishConversationResultDto
   */
  path: string;
  /**
   *
   * @type {string}
   * @memberof PublishConversationResultDto
   */
  folderPath: string;
  /**
   *
   * @type {string}
   * @memberof PublishConversationResultDto
   */
  publishedAt: string;
  /**
   *
   * @type {string}
   * @memberof PublishConversationResultDto
   */
  publishedBy: string;
}
/**
 *
 * @export
 * @interface PublishHistoryEntryDto
 */
export interface PublishHistoryEntryDto {
  /**
   *
   * @type {string}
   * @memberof PublishHistoryEntryDto
   */
  entityId: string;
  /**
   *
   * @type {string}
   * @memberof PublishHistoryEntryDto
   */
  entityType: PublishHistoryEntryDtoEntityTypeEnum;
  /**
   *
   * @type {string}
   * @memberof PublishHistoryEntryDto
   */
  folderPath: string;
  /**
   *
   * @type {string}
   * @memberof PublishHistoryEntryDto
   */
  version: string;
  /**
   *
   * @type {string}
   * @memberof PublishHistoryEntryDto
   */
  publishedAt: string;
  /**
   *
   * @type {string}
   * @memberof PublishHistoryEntryDto
   */
  publishedBy: string;
}

/**
 * @export
 */
export const PublishHistoryEntryDtoEntityTypeEnum = {
  Model: 'model',
  Toolset: 'toolset',
  Application: 'application',
} as const;
export type PublishHistoryEntryDtoEntityTypeEnum =
  (typeof PublishHistoryEntryDtoEntityTypeEnum)[keyof typeof PublishHistoryEntryDtoEntityTypeEnum];

/**
 *
 * @export
 * @interface PublishResultDto
 */
export interface PublishResultDto {
  /**
   *
   * @type {string}
   * @memberof PublishResultDto
   */
  entityId: string;
  /**
   *
   * @type {string}
   * @memberof PublishResultDto
   */
  entityType: PublishResultDtoEntityTypeEnum;
  /**
   *
   * @type {string}
   * @memberof PublishResultDto
   */
  folderPath: string;
  /**
   *
   * @type {string}
   * @memberof PublishResultDto
   */
  version: string;
  /**
   *
   * @type {string}
   * @memberof PublishResultDto
   */
  publishedAt: string;
  /**
   *
   * @type {string}
   * @memberof PublishResultDto
   */
  publishedBy: string;
}

/**
 * @export
 */
export const PublishResultDtoEntityTypeEnum = {
  Model: 'model',
  Toolset: 'toolset',
  Application: 'application',
} as const;
export type PublishResultDtoEntityTypeEnum =
  (typeof PublishResultDtoEntityTypeEnum)[keyof typeof PublishResultDtoEntityTypeEnum];

/**
 *
 * @export
 * @interface PublishRuleDto
 */
export interface PublishRuleDto {
  /**
   * Claim/category name this rule matches against.
   * @type {string}
   * @memberof PublishRuleDto
   */
  source: string;
  /**
   *
   * @type {string}
   * @memberof PublishRuleDto
   */
  function: PublishRuleDtoFunctionEnum;
  /**
   * Values combined with OR; exactly one pattern when function is REGEX.
   * @type {Array<string>}
   * @memberof PublishRuleDto
   */
  targets: Array<string>;
}

/**
 * @export
 */
export const PublishRuleDtoFunctionEnum = {
  Equal: 'EQUAL',
  Contain: 'CONTAIN',
  Regex: 'REGEX',
} as const;
export type PublishRuleDtoFunctionEnum =
  (typeof PublishRuleDtoFunctionEnum)[keyof typeof PublishRuleDtoFunctionEnum];

/**
 *
 * @export
 * @interface PublishRulesResultDto
 */
export interface PublishRulesResultDto {
  /**
   * The requested folder's own access-restriction rules, or an empty array when the folder has none configured.
   * @type {Array<PublishRuleDto>}
   * @memberof PublishRulesResultDto
   */
  rules: Array<PublishRuleDto>;
}
/**
 *
 * @export
 * @interface RateMessageDto
 */
export interface RateMessageDto {
  /**
   * Identifier of the conversation being rated
   * @type {string}
   * @memberof RateMessageDto
   */
  conversationId: string;
  /**
   * Identifier of the assistant response message being rated
   * @type {string}
   * @memberof RateMessageDto
   */
  responseId: string;
  /**
   * Model deployment ID that produced the response
   * @type {string}
   * @memberof RateMessageDto
   */
  modelId: string;
  /**
   * Rating value — 1 (like/thumbs-up) or -1 (dislike/thumbs-down). DIAL Core adds this value to the message like count.
   * @type {number}
   * @memberof RateMessageDto
   */
  rate: RateMessageDtoRateEnum;
  /**
   * Optional free-text comment from the user
   * @type {string}
   * @memberof RateMessageDto
   */
  comment?: string;
}

/**
 * @export
 */
export const RateMessageDtoRateEnum = {
  NUMBER_1: 1,
  NUMBER_MINUS_1: -1,
} as const;
export type RateMessageDtoRateEnum =
  (typeof RateMessageDtoRateEnum)[keyof typeof RateMessageDtoRateEnum];

/**
 *
 * @export
 * @interface RenameConversationBodyDto
 */
export interface RenameConversationBodyDto {
  /**
   * New title for the conversation
   * @type {string}
   * @memberof RenameConversationBodyDto
   */
  newTitle: string;
}
/**
 *
 * @export
 * @interface RenameConversationResponseDto
 */
export interface RenameConversationResponseDto {
  /**
   * Sanitised stored display name of the renamed conversation
   * @type {string}
   * @memberof RenameConversationResponseDto
   */
  name: string;
}
/**
 *
 * @export
 * @interface RenameFilesDto
 */
export interface RenameFilesDto {
  /**
   *
   * @type {Array<RenameItemDto>}
   * @memberof RenameFilesDto
   */
  items: Array<RenameItemDto>;
}
/**
 *
 * @export
 * @interface RenameFilesResponseDto
 */
export interface RenameFilesResponseDto {
  /**
   *
   * @type {Array<RenameItemResultDto>}
   * @memberof RenameFilesResponseDto
   */
  results: Array<RenameItemResultDto>;
}
/**
 *
 * @export
 * @interface RenameItemDto
 */
export interface RenameItemDto {
  /**
   * DIAL Core bucket name
   * @type {string}
   * @memberof RenameItemDto
   */
  bucket: string;
  /**
   * Relative source path within bucket
   * @type {string}
   * @memberof RenameItemDto
   */
  sourcePath: string;
  /**
   * Relative destination path within bucket
   * @type {string}
   * @memberof RenameItemDto
   */
  destinationPath: string;
  /**
   *
   * @type {string}
   * @memberof RenameItemDto
   */
  nodeType: RenameItemDtoNodeTypeEnum;
  /**
   * Display name (last segment) for error messages
   * @type {string}
   * @memberof RenameItemDto
   */
  name: string;
}

/**
 * @export
 */
export const RenameItemDtoNodeTypeEnum = {
  Item: 'item',
  Folder: 'folder',
} as const;
export type RenameItemDtoNodeTypeEnum =
  (typeof RenameItemDtoNodeTypeEnum)[keyof typeof RenameItemDtoNodeTypeEnum];

/**
 *
 * @export
 * @interface RenameItemResultDto
 */
export interface RenameItemResultDto {
  /**
   * Source path from request
   * @type {string}
   * @memberof RenameItemResultDto
   */
  sourcePath: string;
  /**
   * Destination path from request
   * @type {string}
   * @memberof RenameItemResultDto
   */
  destinationPath: string;
  /**
   * true when all Core moveResource calls succeeded
   * @type {boolean}
   * @memberof RenameItemResultDto
   */
  success: boolean;
  /**
   * Human-readable error reason when success is false
   * @type {string}
   * @memberof RenameItemResultDto
   */
  error?: string;
}
/**
 *
 * @export
 * @interface RenamePromptFolderDto
 */
export interface RenamePromptFolderDto {
  /**
   * New folder name. Must not contain a forward slash.
   * @type {string}
   * @memberof RenamePromptFolderDto
   */
  name: string;
}
/**
 *
 * @export
 * @interface ReportClientChannelDto
 */
export interface ReportClientChannelDto {
  /**
   * The `id` of the RPC request being answered.
   * @type {string}
   * @memberof ReportClientChannelDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof ReportClientChannelDto
   */
  result: ReportClientChannelDtoResultEnum;
}

/**
 * @export
 */
export const ReportClientChannelDtoResultEnum = {
  Success: 'success',
  Denied: 'denied',
} as const;
export type ReportClientChannelDtoResultEnum =
  (typeof ReportClientChannelDtoResultEnum)[keyof typeof ReportClientChannelDtoResultEnum];

/**
 *
 * @export
 * @interface ReportIssueDto
 */
export interface ReportIssueDto {
  /**
   * Short title describing the issue.
   * @type {string}
   * @memberof ReportIssueDto
   */
  title: string;
  /**
   * Detailed description of the issue.
   * @type {string}
   * @memberof ReportIssueDto
   */
  description: string;
}
/**
 *
 * @export
 * @interface RequestApiKeyDto
 */
export interface RequestApiKeyDto {
  /**
   * Project name.
   * @type {string}
   * @memberof RequestApiKeyDto
   */
  projectId: string;
  /**
   * Stream name.
   * @type {string}
   * @memberof RequestApiKeyDto
   */
  projectStream: string;
  /**
   * Email of the project tech lead.
   * @type {string}
   * @memberof RequestApiKeyDto
   */
  projectLead: string;
  /**
   * Business justification for the access request.
   * @type {string}
   * @memberof RequestApiKeyDto
   */
  businessReason: string;
  /**
   * Project end date in DD/MM/YYYY format.
   * @type {string}
   * @memberof RequestApiKeyDto
   */
  projectEnd: string;
  /**
   * Description of the access scenario.
   * @type {string}
   * @memberof RequestApiKeyDto
   */
  accessScenario: string;
  /**
   * Cost and workload description.
   * @type {string}
   * @memberof RequestApiKeyDto
   */
  workloadPattern: string;
}
/**
 *
 * @export
 * @interface RevokeAccessDto
 */
export interface RevokeAccessDto {
  /**
   *
   * @type {Array<RevokeAccessItemDto>}
   * @memberof RevokeAccessDto
   */
  items: Array<RevokeAccessItemDto>;
}
/**
 *
 * @export
 * @interface RevokeAccessItemDto
 */
export interface RevokeAccessItemDto {
  /**
   * DIAL Core bucket name
   * @type {string}
   * @memberof RevokeAccessItemDto
   */
  bucket: string;
  /**
   * Relative path within bucket
   * @type {string}
   * @memberof RevokeAccessItemDto
   */
  path: string;
}
/**
 *
 * @export
 * @interface RevokeAccessResponseDto
 */
export interface RevokeAccessResponseDto {
  /**
   * true when the Core revoke call succeeded
   * @type {boolean}
   * @memberof RevokeAccessResponseDto
   */
  success: boolean;
}
/**
 *
 * @export
 * @interface SaveConversationBodyDto
 */
export interface SaveConversationBodyDto {
  /**
   * Full conversation object to persist
   * @type {ConversationResponseDto}
   * @memberof SaveConversationBodyDto
   */
  conversation: ConversationResponseDto;
}
/**
 *
 * @export
 * @interface ScheduleCronDto
 */
export interface ScheduleCronDto {
  /**
   * Cron field map using supported Scheduler keys (year, month, day, week, day_of_week, hour, minute, second).
   * @type {{ [key: string]: string; }}
   * @memberof ScheduleCronDto
   */
  fields: { [key: string]: string };
}
/**
 *
 * @export
 * @interface ScheduleTriggerDto
 */
export interface ScheduleTriggerDto {
  /**
   *
   * @type {string}
   * @memberof ScheduleTriggerDto
   */
  date?: string;
  /**
   *
   * @type {ScheduleCronDto}
   * @memberof ScheduleTriggerDto
   */
  cron?: ScheduleCronDto;
}
/**
 *
 * @export
 * @interface ScheduledTaskDto
 */
export interface ScheduledTaskDto {
  /**
   *
   * @type {string}
   * @memberof ScheduledTaskDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof ScheduledTaskDto
   */
  displayName: string;
  /**
   *
   * @type {ScheduleTriggerDto}
   * @memberof ScheduledTaskDto
   */
  trigger: ScheduleTriggerDto;
  /**
   *
   * @type {string}
   * @memberof ScheduledTaskDto
   */
  nextRunTime?: string;
  /**
   *
   * @type {string}
   * @memberof ScheduledTaskDto
   */
  createdAt?: string;
  /**
   *
   * @type {string}
   * @memberof ScheduledTaskDto
   */
  updatedAt?: string;
  /**
   *
   * @type {string}
   * @memberof ScheduledTaskDto
   */
  triggerType?: ScheduledTaskDtoTriggerTypeEnum;
  /**
   *
   * @type {string}
   * @memberof ScheduledTaskDto
   */
  serviceId?: string;
  /**
   *
   * @type {string}
   * @memberof ScheduledTaskDto
   */
  createdBy?: string;
  /**
   *
   * @type {string}
   * @memberof ScheduledTaskDto
   */
  description?: string;
}

/**
 * @export
 */
export const ScheduledTaskDtoTriggerTypeEnum = {
  Cron: 'cron',
  Date: 'date',
} as const;
export type ScheduledTaskDtoTriggerTypeEnum =
  (typeof ScheduledTaskDtoTriggerTypeEnum)[keyof typeof ScheduledTaskDtoTriggerTypeEnum];

/**
 *
 * @export
 * @interface SendCompletionDto
 */
export interface SendCompletionDto {
  /**
   * Client-generated UUID identifying this generation attempt.
   * @type {string}
   * @memberof SendCompletionDto
   */
  generationId: string;
  /**
   * Conversation path ({deploymentId}__{name}__{uuid}). May contain slashes.
   * @type {string}
   * @memberof SendCompletionDto
   */
  path: string;
  /**
   * DIAL Core deployment name to use for completion
   * @type {string}
   * @memberof SendCompletionDto
   */
  model: string;
  /**
   * How the message should be inserted into history. append = new user+assistant turn; continue_last_user = conversation already ends with a user message; regenerate = replace assistant at messageIndex; edit = replace user message at messageIndex.
   * @type {string}
   * @memberof SendCompletionDto
   */
  mode: SendCompletionDtoModeEnum;
  /**
   * The new user message to send. May be empty when custom_content carries attachments, form_value, or configuration_value.
   * @type {string}
   * @memberof SendCompletionDto
   */
  message?: string;
  /**
   * Zero-based message index for regenerate and edit modes. Ignored for append/continue_last_user.
   * @type {number}
   * @memberof SendCompletionDto
   */
  messageIndex?: number;
  /**
   * Extra DIAL payload attached to the user message
   * @type {MessageCustomContentDto}
   * @memberof SendCompletionDto
   */
  customContent?: MessageCustomContentDto;
  /**
   * Active DIAL Core client-channel id (from `POST /v1/client-channel/subscribe`), forwarded to DIAL Core so a mid-completion `toolset/signin` event can be correlated to this request. Omitted when no channel is active yet.
   * @type {string}
   * @memberof SendCompletionDto
   */
  clientChannelId?: string;
}

/**
 * @export
 */
export const SendCompletionDtoModeEnum = {
  Append: 'append',
  ContinueLastUser: 'continue_last_user',
  Regenerate: 'regenerate',
  Edit: 'edit',
} as const;
export type SendCompletionDtoModeEnum =
  (typeof SendCompletionDtoModeEnum)[keyof typeof SendCompletionDtoModeEnum];

/**
 *
 * @export
 * @interface ShareLinkResponseDto
 */
export interface ShareLinkResponseDto {
  /**
   * Absolute shareable URL for the entity.
   * @type {string}
   * @memberof ShareLinkResponseDto
   */
  url: string;
  /**
   * Number of days the link stays active before expiring.
   * @type {number}
   * @memberof ShareLinkResponseDto
   */
  expiresInDays: number;
  /**
   * Access levels granted to holders of the share link. Edit access implies view access, so this is `[View, Edit]` rather than `[Edit]` alone.
   * @type {Array<string>}
   * @memberof ShareLinkResponseDto
   */
  access: Array<ShareLinkResponseDtoAccessEnum>;
}

/**
 * @export
 */
export const ShareLinkResponseDtoAccessEnum = {
  View: 'view',
  Edit: 'edit',
} as const;
export type ShareLinkResponseDtoAccessEnum =
  (typeof ShareLinkResponseDtoAccessEnum)[keyof typeof ShareLinkResponseDtoAccessEnum];

/**
 *
 * @export
 * @interface StopCompletionDto
 */
export interface StopCompletionDto {
  /**
   * Generation ID that was returned by the active stream.
   * @type {string}
   * @memberof StopCompletionDto
   */
  generationId: string;
  /**
   * Conversation path of the active generation.
   * @type {string}
   * @memberof StopCompletionDto
   */
  path: string;
}
/**
 *
 * @export
 * @interface ThemeConfigResponseDto
 */
export interface ThemeConfigResponseDto {
  /**
   *
   * @type {Array<ThemeDto>}
   * @memberof ThemeConfigResponseDto
   */
  themes: Array<ThemeDto>;
  /**
   *
   * @type {ThemeImagesDto}
   * @memberof ThemeConfigResponseDto
   */
  images: ThemeImagesDto;
}
/**
 *
 * @export
 * @interface ThemeDto
 */
export interface ThemeDto {
  /**
   *
   * @type {string}
   * @memberof ThemeDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof ThemeDto
   */
  displayName: string;
  /**
   *
   * @type {{ [key: string]: string; }}
   * @memberof ThemeDto
   */
  colors: { [key: string]: string };
  /**
   *
   * @type {string}
   * @memberof ThemeDto
   */
  appLogo: string;
}
/**
 *
 * @export
 * @interface ThemeImagesDto
 */
export interface ThemeImagesDto {
  /**
   *
   * @type {string}
   * @memberof ThemeImagesDto
   */
  defaultAddon: string;
  /**
   *
   * @type {string}
   * @memberof ThemeImagesDto
   */
  defaultModel: string;
  /**
   *
   * @type {string}
   * @memberof ThemeImagesDto
   */
  favicon: string;
  /**
   *
   * @type {string}
   * @memberof ThemeImagesDto
   */
  chatLogoLight?: string;
  /**
   *
   * @type {string}
   * @memberof ThemeImagesDto
   */
  chatLogoDark?: string;
  /**
   *
   * @type {string}
   * @memberof ThemeImagesDto
   */
  chatFavicon?: string;
}
/**
 *
 * @export
 * @interface ToolsetAuthResultDto
 */
export interface ToolsetAuthResultDto {
  /**
   *
   * @type {boolean}
   * @memberof ToolsetAuthResultDto
   */
  success: boolean;
}
/**
 *
 * @export
 * @interface ToolsetAuthSettingsBodyDto
 */
export interface ToolsetAuthSettingsBodyDto {
  /**
   *
   * @type {string}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  authenticationType: ToolsetAuthSettingsBodyDtoAuthenticationTypeEnum;
  /**
   *
   * @type {string}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  apiKeyHeader?: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  clientId?: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  clientSecret?: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  authorizationEndpoint?: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  tokenEndpoint?: string;
  /**
   *
   * @type {Array<string>}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  scopesSupported?: Array<string>;
  /**
   *
   * @type {string}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  redirectUri?: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  codeChallengeMethod?: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetAuthSettingsBodyDto
   */
  codeChallenge?: string;
}

/**
 * @export
 */
export const ToolsetAuthSettingsBodyDtoAuthenticationTypeEnum = {
  None: 'NONE',
  ApiKey: 'API_KEY',
  Oauth: 'OAUTH',
} as const;
export type ToolsetAuthSettingsBodyDtoAuthenticationTypeEnum =
  (typeof ToolsetAuthSettingsBodyDtoAuthenticationTypeEnum)[keyof typeof ToolsetAuthSettingsBodyDtoAuthenticationTypeEnum];

/**
 *
 * @export
 * @interface ToolsetAuthSettingsDto
 */
export interface ToolsetAuthSettingsDto {
  /**
   * Type of authentication
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  authenticationType?: ToolsetAuthSettingsDtoAuthenticationTypeEnum;
  /**
   * Whether DIAL Core dynamically registered the OAuth client instead of using user-provided client configuration
   * @type {boolean}
   * @memberof ToolsetAuthSettingsDto
   */
  dynamicallyRegistered?: boolean;
  /**
   * Whether the toolset has global (shared) credentials signed in
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  globalAuthStatus?: ToolsetAuthSettingsDtoGlobalAuthStatusEnum;
  /**
   * Whether the toolset has app-level credentials signed in
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  appLevelAuthStatus?: ToolsetAuthSettingsDtoAppLevelAuthStatusEnum;
  /**
   * Whether the current user has user-level credentials signed in
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  userLevelAuthStatus?: ToolsetAuthSettingsDtoUserLevelAuthStatusEnum;
  /**
   * OAuth scopes supported by this toolset
   * @type {Array<string>}
   * @memberof ToolsetAuthSettingsDto
   */
  scopesSupported?: Array<string>;
  /**
   * (OAuth only) Authorization endpoint
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  authorizationEndpoint?: string;
  /**
   * (OAuth only) Token endpoint
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  tokenEndpoint?: string;
  /**
   * (API key only) Header name the API key is sent in
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  apiKeyHeader?: string;
  /**
   * (OAuth only) Public OAuth client id — not a secret
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  clientId?: string;
  /**
   * (OAuth only) OAuth redirect URI
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  redirectUri?: string;
  /**
   * (OAuth only) Token endpoint authentication method
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  tokenEndpointAuthMethod?: string;
  /**
   * (OAuth/PKCE only) PKCE code challenge — the challenge itself is not secret, only the verifier is
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  codeChallenge?: string;
  /**
   * (OAuth/PKCE only) PKCE challenge method (e.g. S256)
   * @type {string}
   * @memberof ToolsetAuthSettingsDto
   */
  codeChallengeMethod?: string;
}

/**
 * @export
 */
export const ToolsetAuthSettingsDtoAuthenticationTypeEnum = {
  Oauth: 'OAUTH',
  ApiKey: 'API_KEY',
  None: 'NONE',
} as const;
export type ToolsetAuthSettingsDtoAuthenticationTypeEnum =
  (typeof ToolsetAuthSettingsDtoAuthenticationTypeEnum)[keyof typeof ToolsetAuthSettingsDtoAuthenticationTypeEnum];

/**
 * @export
 */
export const ToolsetAuthSettingsDtoGlobalAuthStatusEnum = {
  SignedIn: 'SIGNED_IN',
  SignedOut: 'SIGNED_OUT',
} as const;
export type ToolsetAuthSettingsDtoGlobalAuthStatusEnum =
  (typeof ToolsetAuthSettingsDtoGlobalAuthStatusEnum)[keyof typeof ToolsetAuthSettingsDtoGlobalAuthStatusEnum];

/**
 * @export
 */
export const ToolsetAuthSettingsDtoAppLevelAuthStatusEnum = {
  SignedIn: 'SIGNED_IN',
  SignedOut: 'SIGNED_OUT',
} as const;
export type ToolsetAuthSettingsDtoAppLevelAuthStatusEnum =
  (typeof ToolsetAuthSettingsDtoAppLevelAuthStatusEnum)[keyof typeof ToolsetAuthSettingsDtoAppLevelAuthStatusEnum];

/**
 * @export
 */
export const ToolsetAuthSettingsDtoUserLevelAuthStatusEnum = {
  SignedIn: 'SIGNED_IN',
  SignedOut: 'SIGNED_OUT',
} as const;
export type ToolsetAuthSettingsDtoUserLevelAuthStatusEnum =
  (typeof ToolsetAuthSettingsDtoUserLevelAuthStatusEnum)[keyof typeof ToolsetAuthSettingsDtoUserLevelAuthStatusEnum];

/**
 *
 * @export
 * @interface ToolsetBodyDto
 */
export interface ToolsetBodyDto {
  /**
   *
   * @type {string}
   * @memberof ToolsetBodyDto
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetBodyDto
   */
  version?: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetBodyDto
   */
  description?: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetBodyDto
   */
  iconUrl?: string;
  /**
   *
   * @type {Array<string>}
   * @memberof ToolsetBodyDto
   */
  topics?: Array<string>;
  /**
   *
   * @type {string}
   * @memberof ToolsetBodyDto
   */
  intro?: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetBodyDto
   */
  endpoint: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetBodyDto
   */
  transport: ToolsetBodyDtoTransportEnum;
  /**
   *
   * @type {Array<string>}
   * @memberof ToolsetBodyDto
   */
  allowedTools?: Array<string>;
  /**
   *
   * @type {string}
   * @memberof ToolsetBodyDto
   */
  reference?: string;
  /**
   *
   * @type {ToolsetAuthSettingsBodyDto}
   * @memberof ToolsetBodyDto
   */
  authSettings: ToolsetAuthSettingsBodyDto;
}

/**
 * @export
 */
export const ToolsetBodyDtoTransportEnum = {
  Http: 'HTTP',
  Sse: 'SSE',
} as const;
export type ToolsetBodyDtoTransportEnum =
  (typeof ToolsetBodyDtoTransportEnum)[keyof typeof ToolsetBodyDtoTransportEnum];

/**
 *
 * @export
 * @interface ToolsetDetailsDto
 */
export interface ToolsetDetailsDto {
  /**
   * Transport supported by the MCP server (HTTP or SSE)
   * @type {string}
   * @memberof ToolsetDetailsDto
   */
  transport?: string;
  /**
   * Names of tools allowed for use from this toolset
   * @type {Array<string>}
   * @memberof ToolsetDetailsDto
   */
  allowedTools?: Array<string>;
  /**
   * Names of all tools supported by the underlying MCP server, regardless of whether they are allow-listed. From GET /v1/toolset/{id}/tools.
   * @type {Array<string>}
   * @memberof ToolsetDetailsDto
   */
  allToolNames?: Array<string>;
  /**
   *
   * @type {ToolsetAuthSettingsDto}
   * @memberof ToolsetDetailsDto
   */
  authSettings?: ToolsetAuthSettingsDto;
  /**
   * Owner of the deployment as reported by DIAL Core
   * @type {string}
   * @memberof ToolsetDetailsDto
   */
  owner?: string;
  /**
   *
   * @type {DeploymentFeaturesDetailsDto}
   * @memberof ToolsetDetailsDto
   */
  features?: DeploymentFeaturesDetailsDto;
  /**
   * Timestamp of creation time from DIAL Core (e.g. 1714768496000)
   * @type {number}
   * @memberof ToolsetDetailsDto
   */
  createdAt?: number;
}
/**
 *
 * @export
 * @interface ToolsetLoginBodyDto
 */
export interface ToolsetLoginBodyDto {
  /**
   *
   * @type {string}
   * @memberof ToolsetLoginBodyDto
   */
  url: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetLoginBodyDto
   */
  credentialsLevel: ToolsetLoginBodyDtoCredentialsLevelEnum;
  /**
   *
   * @type {string}
   * @memberof ToolsetLoginBodyDto
   */
  authenticationType: ToolsetLoginBodyDtoAuthenticationTypeEnum;
  /**
   * API key value (API_KEY auth).
   * @type {string}
   * @memberof ToolsetLoginBodyDto
   */
  apiKey?: string;
  /**
   * OAuth authorization code (OAUTH auth).
   * @type {string}
   * @memberof ToolsetLoginBodyDto
   */
  code?: string;
  /**
   * OAuth redirect URI used for the code exchange.
   * @type {string}
   * @memberof ToolsetLoginBodyDto
   */
  redirectUri?: string;
}

/**
 * @export
 */
export const ToolsetLoginBodyDtoCredentialsLevelEnum = {
  Global: 'GLOBAL',
  User: 'USER',
  App: 'APP',
} as const;
export type ToolsetLoginBodyDtoCredentialsLevelEnum =
  (typeof ToolsetLoginBodyDtoCredentialsLevelEnum)[keyof typeof ToolsetLoginBodyDtoCredentialsLevelEnum];

/**
 * @export
 */
export const ToolsetLoginBodyDtoAuthenticationTypeEnum = {
  None: 'NONE',
  ApiKey: 'API_KEY',
  Oauth: 'OAUTH',
} as const;
export type ToolsetLoginBodyDtoAuthenticationTypeEnum =
  (typeof ToolsetLoginBodyDtoAuthenticationTypeEnum)[keyof typeof ToolsetLoginBodyDtoAuthenticationTypeEnum];

/**
 *
 * @export
 * @interface ToolsetLogoutBodyDto
 */
export interface ToolsetLogoutBodyDto {
  /**
   *
   * @type {string}
   * @memberof ToolsetLogoutBodyDto
   */
  url: string;
  /**
   *
   * @type {string}
   * @memberof ToolsetLogoutBodyDto
   */
  credentialsLevel: ToolsetLogoutBodyDtoCredentialsLevelEnum;
  /**
   * Authentication type used by the toolset. Optional — a caller that doesn't already have this loaded (e.g. logging out by id alone) can omit it; the server looks up the toolset's own stored authentication type instead.
   * @type {string}
   * @memberof ToolsetLogoutBodyDto
   */
  authenticationType?: ToolsetLogoutBodyDtoAuthenticationTypeEnum;
}

/**
 * @export
 */
export const ToolsetLogoutBodyDtoCredentialsLevelEnum = {
  Global: 'GLOBAL',
  User: 'USER',
  App: 'APP',
} as const;
export type ToolsetLogoutBodyDtoCredentialsLevelEnum =
  (typeof ToolsetLogoutBodyDtoCredentialsLevelEnum)[keyof typeof ToolsetLogoutBodyDtoCredentialsLevelEnum];

/**
 * @export
 */
export const ToolsetLogoutBodyDtoAuthenticationTypeEnum = {
  None: 'NONE',
  ApiKey: 'API_KEY',
  Oauth: 'OAUTH',
} as const;
export type ToolsetLogoutBodyDtoAuthenticationTypeEnum =
  (typeof ToolsetLogoutBodyDtoAuthenticationTypeEnum)[keyof typeof ToolsetLogoutBodyDtoAuthenticationTypeEnum];

/**
 *
 * @export
 * @interface ToolsetsConfigDto
 */
export interface ToolsetsConfigDto {
  /**
   * Installed toolset identifiers.
   * @type {Array<string>}
   * @memberof ToolsetsConfigDto
   */
  installed: Array<string>;
}
/**
 *
 * @export
 * @interface TranscribeAudio200Response
 */
export interface TranscribeAudio200Response {
  /**
   *
   * @type {string}
   * @memberof TranscribeAudio200Response
   */
  transcript?: string;
}
/**
 *
 * @export
 * @interface TranscribeAudioDto
 */
export interface TranscribeAudioDto {
  /**
   * DIAL storage URL of the uploaded audio file.
   * @type {string}
   * @memberof TranscribeAudioDto
   */
  audioUrl: string;
  /**
   * MIME type of the audio file (e.g. audio/webm;codecs=opus).
   * @type {string}
   * @memberof TranscribeAudioDto
   */
  mimeType: string;
}
/**
 *
 * @export
 * @interface UpdateApplicationBodyDto
 */
export interface UpdateApplicationBodyDto {
  /**
   *
   * @type {string}
   * @memberof UpdateApplicationBodyDto
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof UpdateApplicationBodyDto
   */
  description?: string;
  /**
   *
   * @type {string}
   * @memberof UpdateApplicationBodyDto
   */
  iconUrl?: string;
  /**
   *
   * @type {Array<string>}
   * @memberof UpdateApplicationBodyDto
   */
  topics?: Array<string>;
  /**
   *
   * @type {string}
   * @memberof UpdateApplicationBodyDto
   */
  intro?: string;
}
/**
 *
 * @export
 * @interface UpdateInstalledDto
 */
export interface UpdateInstalledDto {
  /**
   * Identifier of the resource to install or uninstall.
   * @type {string}
   * @memberof UpdateInstalledDto
   */
  id: string;
  /**
   * Pass `true` to install the resource, `false` to uninstall.
   * @type {boolean}
   * @memberof UpdateInstalledDto
   */
  isInstalled: boolean;
}
/**
 *
 * @export
 * @interface UpdatePinsDto
 */
export interface UpdatePinsDto {
  /**
   * Full DIAL Core resource URL of the conversation to pin or unpin (matches `id` in `ConversationListItemDto`).
   * @type {string}
   * @memberof UpdatePinsDto
   */
  path: string;
  /**
   * Pass `true` to pin the conversation, `false` to unpin.
   * @type {boolean}
   * @memberof UpdatePinsDto
   */
  isPinned: boolean;
}
/**
 *
 * @export
 * @interface UpdatePromptDto
 */
export interface UpdatePromptDto {
  /**
   * New display name. Must not contain a forward slash.
   * @type {string}
   * @memberof UpdatePromptDto
   */
  name?: string;
  /**
   * Updated description
   * @type {string}
   * @memberof UpdatePromptDto
   */
  description?: string;
  /**
   * Updated prompt text
   * @type {string}
   * @memberof UpdatePromptDto
   */
  content?: string;
}
/**
 *
 * @export
 * @interface UpdateScheduledTaskBodyDto
 */
export interface UpdateScheduledTaskBodyDto {
  /**
   *
   * @type {string}
   * @memberof UpdateScheduledTaskBodyDto
   */
  displayName: string;
  /**
   *
   * @type {ScheduleTriggerDto}
   * @memberof UpdateScheduledTaskBodyDto
   */
  trigger: ScheduleTriggerDto;
  /**
   *
   * @type {string}
   * @memberof UpdateScheduledTaskBodyDto
   */
  model: string;
  /**
   *
   * @type {string}
   * @memberof UpdateScheduledTaskBodyDto
   */
  prompt: string;
  /**
   *
   * @type {string}
   * @memberof UpdateScheduledTaskBodyDto
   */
  description?: string;
  /**
   *
   * @type {boolean}
   * @memberof UpdateScheduledTaskBodyDto
   */
  stream?: boolean;
}
/**
 *
 * @export
 * @interface UpdateSelectedDeploymentDto
 */
export interface UpdateSelectedDeploymentDto {
  /**
   * Deployment ID to set as selected, or null to clear.
   * @type {string}
   * @memberof UpdateSelectedDeploymentDto
   */
  id?: string | null;
}
/**
 *
 * @export
 * @interface UpdatedApplicationDto
 */
export interface UpdatedApplicationDto {
  /**
   *
   * @type {string}
   * @memberof UpdatedApplicationDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof UpdatedApplicationDto
   */
  displayName?: string;
  /**
   *
   * @type {string}
   * @memberof UpdatedApplicationDto
   */
  object?: string;
}
/**
 *
 * @export
 * @interface UpdatedScheduledTaskDto
 */
export interface UpdatedScheduledTaskDto {
  /**
   *
   * @type {string}
   * @memberof UpdatedScheduledTaskDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof UpdatedScheduledTaskDto
   */
  displayName: string;
  /**
   *
   * @type {ScheduleTriggerDto}
   * @memberof UpdatedScheduledTaskDto
   */
  trigger: ScheduleTriggerDto;
  /**
   *
   * @type {string}
   * @memberof UpdatedScheduledTaskDto
   */
  nextRunTime?: string;
  /**
   *
   * @type {string}
   * @memberof UpdatedScheduledTaskDto
   */
  createdAt?: string;
  /**
   *
   * @type {string}
   * @memberof UpdatedScheduledTaskDto
   */
  updatedAt?: string;
  /**
   *
   * @type {string}
   * @memberof UpdatedScheduledTaskDto
   */
  triggerType?: UpdatedScheduledTaskDtoTriggerTypeEnum;
  /**
   *
   * @type {string}
   * @memberof UpdatedScheduledTaskDto
   */
  serviceId?: string;
  /**
   *
   * @type {string}
   * @memberof UpdatedScheduledTaskDto
   */
  createdBy?: string;
  /**
   *
   * @type {string}
   * @memberof UpdatedScheduledTaskDto
   */
  description?: string;
}

/**
 * @export
 */
export const UpdatedScheduledTaskDtoTriggerTypeEnum = {
  Cron: 'cron',
  Date: 'date',
} as const;
export type UpdatedScheduledTaskDtoTriggerTypeEnum =
  (typeof UpdatedScheduledTaskDtoTriggerTypeEnum)[keyof typeof UpdatedScheduledTaskDtoTriggerTypeEnum];

/**
 *
 * @export
 * @interface UploadArchiveEntryResultDto
 */
export interface UploadArchiveEntryResultDto {
  /**
   * Destination path of the extracted entry (relative to bucket)
   * @type {string}
   * @memberof UploadArchiveEntryResultDto
   */
  path: string;
  /**
   * true when the entry was extracted and uploaded successfully
   * @type {boolean}
   * @memberof UploadArchiveEntryResultDto
   */
  success: boolean;
  /**
   * Human-readable error reason when success is false
   * @type {string}
   * @memberof UploadArchiveEntryResultDto
   */
  error?: string;
}
/**
 *
 * @export
 * @interface UploadArchiveResponseDto
 */
export interface UploadArchiveResponseDto {
  /**
   *
   * @type {Array<UploadArchiveEntryResultDto>}
   * @memberof UploadArchiveResponseDto
   */
  results: Array<UploadArchiveEntryResultDto>;
}
/**
 *
 * @export
 * @interface UserConfigDto
 */
export interface UserConfigDto {
  /**
   * User configuration schema version.
   * @type {number}
   * @memberof UserConfigDto
   */
  version: number;
  /**
   *
   * @type {ConversationsConfigDto}
   * @memberof UserConfigDto
   */
  conversations: ConversationsConfigDto;
  /**
   *
   * @type {ToolsetsConfigDto}
   * @memberof UserConfigDto
   */
  toolsets: ToolsetsConfigDto;
  /**
   *
   * @type {DeploymentsConfigDto}
   * @memberof UserConfigDto
   */
  deployments: DeploymentsConfigDto;
}
/**
 *
 * @export
 * @interface UserProfileDto
 */
export interface UserProfileDto {
  /**
   *
   * @type {string}
   * @memberof UserProfileDto
   */
  sub: string;
  /**
   *
   * @type {string}
   * @memberof UserProfileDto
   */
  providerId: string;
  /**
   * Allowlisted claims keyed by claim name. A dot-notation rolesClaim (e.g. "realm_access.roles") is stored under one flat key equal to that literal string, never as a nested object.
   * @type {{ [key: string]: unknown }}
   * @memberof UserProfileDto
   */
  claims: { [key: string]: unknown };
  /**
   *
   * @type {string}
   * @memberof UserProfileDto
   */
  bucket: string;
  /**
   * Whether the user's roles claim intersects the provider's configured adminRoles
   * @type {boolean}
   * @memberof UserProfileDto
   */
  isAdmin: boolean;
}
/**
 *
 * @export
 * @interface WatchConversationBodyDto
 */
export interface WatchConversationBodyDto {
  /**
   * Conversation sub-path (bucket-stripped), e.g. "gpt-4o__My Chat".
   * @type {string}
   * @memberof WatchConversationBodyDto
   */
  path: string;
}
