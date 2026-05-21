/* tslint:disable */
/* eslint-disable */
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
   * @type {number}
   * @memberof DialModelDto
   */
  created?: number;
  /**
   *
   * @type {string}
   * @memberof DialModelDto
   */
  ownedBy?: string;
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
