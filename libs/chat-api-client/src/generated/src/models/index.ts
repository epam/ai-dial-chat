/* tslint:disable */
/* eslint-disable */
/**
 *
 * @export
 * @interface AttachmentDto
 */
export interface AttachmentDto {
  /**
   * Position used to order attachments inside custom_content
   * @type {number}
   * @memberof AttachmentDto
   */
  index?: number;
  /**
   * MIME type of the attachment
   * @type {string}
   * @memberof AttachmentDto
   */
  type?: string;
  /**
   * Display title (usually the original filename)
   * @type {string}
   * @memberof AttachmentDto
   */
  title?: string;
  /**
   * URL of the file in DIAL storage
   * @type {string}
   * @memberof AttachmentDto
   */
  url?: string;
  /**
   * Base64-encoded inline content (mutually exclusive with url)
   * @type {string}
   * @memberof AttachmentDto
   */
  data?: string;
  /**
   * MIME type of the referenced resource for citation-style attachments
   * @type {string}
   * @memberof AttachmentDto
   */
  referenceType?: string;
  /**
   * External URL the attachment references (citations, links)
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
 * @interface ConversationMessageDto
 */
export interface ConversationMessageDto {
  /**
   *
   * @type {string}
   * @memberof ConversationMessageDto
   */
  id: string;
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
   * DIAL Core custom_content (attachments and other auxiliary data)
   * @type {CustomContentDto}
   * @memberof ConversationMessageDto
   */
  customContent?: CustomContentDto;
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
   * The first message to start the conversation
   * @type {string}
   * @memberof CreateConversationDto
   */
  firstMessage: string;
  /**
   * Attachments to include with the first user message
   * @type {Array<AttachmentDto>}
   * @memberof CreateConversationDto
   */
  attachments?: Array<AttachmentDto>;
}
/**
 *
 * @export
 * @interface CustomContentDto
 */
export interface CustomContentDto {
  /**
   * Files attached to the message
   * @type {Array<AttachmentDto>}
   * @memberof CustomContentDto
   */
  attachments?: Array<AttachmentDto>;
}
/**
 *
 * @export
 * @interface DialDeploymentDto
 */
export interface DialDeploymentDto {
  /**
   *
   * @type {string}
   * @memberof DialDeploymentDto
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof DialDeploymentDto
   */
  name?: string;
  /**
   *
   * @type {string}
   * @memberof DialDeploymentDto
   */
  type?: string;
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
 * @interface FileUploadResponseDto
 */
export interface FileUploadResponseDto {
  /**
   *
   * @type {string}
   * @memberof FileUploadResponseDto
   */
  url: string;
  /**
   *
   * @type {string}
   * @memberof FileUploadResponseDto
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof FileUploadResponseDto
   */
  contentType: string;
  /**
   *
   * @type {number}
   * @memberof FileUploadResponseDto
   */
  contentLength?: number;
}
/**
 *
 * @export
 * @interface MessageDto
 */
export interface MessageDto {
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
   * DIAL Core custom_content carrying attachments and other auxiliary data
   * @type {CustomContentDto}
   * @memberof MessageDto
   */
  customContent?: CustomContentDto;
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
   * Conversation path (uuid__name). May contain slashes.
   * @type {string}
   * @memberof SendCompletionDto
   */
  path: string;
  /**
   * The new user message to send
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
   * Attachments to send alongside the user message
   * @type {Array<AttachmentDto>}
   * @memberof SendCompletionDto
   */
  attachments?: Array<AttachmentDto>;
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
