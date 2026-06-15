/* tslint:disable */
/* eslint-disable */
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
 * @interface ConversationMessageDto
 */
export interface ConversationMessageDto {
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
}

/**
 * @export
 */
export const ConversationMessageDtoRoleEnum = {
  User: 'user',
  Assistant: 'assistant',
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
   * ID of the catalog item (model or application) to use for this conversation
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
   * Interface types supported by this deployment
   * @type {Array<string>}
   * @memberof DeploymentItemDto
   */
  interfaces?: Array<string>;
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
}

/**
 * Feature flags for a deployment controlling which per-conversation settings are available.
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
   * New relative path of the renamed conversation
   * @type {string}
   * @memberof RenameConversationResponseDto
   */
  newPath: string;
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
 * @interface SendCompletionDto
 */
export interface SendCompletionDto {
  /**
   * Conversation path ({deploymentId}__{name}__{uuid}). May contain slashes.
   * @type {string}
   * @memberof SendCompletionDto
   */
  path: string;
  /**
   * The new user message to send. May be empty when custom_content carries attachments, form_value, or configuration_value.
   * @type {string}
   * @memberof SendCompletionDto
   */
  message: string;
  /**
   * DIAL Core deployment name to use for completion
   * @type {string}
   * @memberof SendCompletionDto
   */
  model: string;
  /**
   * Extra DIAL payload attached to the user message
   * @type {MessageCustomContentDto}
   * @memberof SendCompletionDto
   */
  customContent?: MessageCustomContentDto;
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
  name: string;
  /**
   *
   * @type {string}
   * @memberof ThemeDto
   */
  icon?: string;
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
   *
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
}
