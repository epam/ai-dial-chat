import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderInfoDto {
  @ApiProperty({ example: 'local' })
  id!: string;

  @ApiProperty({ example: 'Local' })
  label!: string;
}

export class UserProfileDto {
  @ApiProperty({ example: 'user@example.com' })
  sub!: string;

  @ApiProperty({ example: 'local' })
  providerId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  claims!: Record<string, unknown>;

  @ApiProperty({ example: 'default-bucket' })
  bucket!: string;
}

export class DialModelFeaturesDto {
  @ApiPropertyOptional({ example: false })
  rate?: boolean;

  @ApiPropertyOptional({ example: false })
  tokenize?: boolean;

  @ApiPropertyOptional({ example: false })
  truncate_prompt?: boolean;

  @ApiPropertyOptional({ example: false })
  configuration?: boolean;

  @ApiPropertyOptional({ example: true })
  system_prompt?: boolean;

  @ApiPropertyOptional({ example: true })
  tools?: boolean;

  @ApiPropertyOptional({ example: false })
  seed?: boolean;

  @ApiPropertyOptional({ example: false })
  url_attachments?: boolean;

  @ApiPropertyOptional({ example: false })
  folder_attachments?: boolean;

  @ApiPropertyOptional({ example: true })
  allow_resume?: boolean;

  @ApiPropertyOptional({ example: true })
  accessible_by_per_request_key?: boolean;

  @ApiPropertyOptional({ example: false })
  content_parts?: boolean;

  @ApiPropertyOptional({ example: true })
  temperature?: boolean;

  @ApiPropertyOptional({ example: false })
  cache?: boolean;

  @ApiPropertyOptional({ example: false })
  auto_caching?: boolean;

  @ApiPropertyOptional({ example: true })
  parallel_tool_calls?: boolean;

  @ApiPropertyOptional({ example: true })
  assistant_attachments_in_request?: boolean;

  @ApiPropertyOptional({ example: false })
  mcp?: boolean;
}

export class DialModelCapabilitiesDto {
  @ApiPropertyOptional({ type: [String], example: ['standard'] })
  scale_types?: string[];

  @ApiPropertyOptional({ example: false })
  completion?: boolean;

  @ApiPropertyOptional({ example: true })
  chat_completion?: boolean;

  @ApiPropertyOptional({ example: false })
  embeddings?: boolean;

  @ApiPropertyOptional({ example: false })
  fine_tune?: boolean;

  @ApiPropertyOptional({ example: false })
  inference?: boolean;
}

export class DialModelLimitsDto {
  @ApiPropertyOptional({ example: 1048576 })
  max_prompt_tokens?: number;

  @ApiPropertyOptional({ example: 65535 })
  max_completion_tokens?: number;
}

export class DialModelPricingDto {
  @ApiPropertyOptional({ example: 'char_without_whitespace' })
  unit?: string;

  @ApiPropertyOptional({ example: '0.0000005' })
  prompt?: string;

  @ApiPropertyOptional({ example: '0.000003' })
  completion?: string;
}

export class DialModelDto {
  @ApiProperty({ example: 'dial.gemini-3-flash-preview' })
  id!: string;

  @ApiProperty({ example: 'model' })
  object!: string;

  @ApiPropertyOptional({ example: 'dial.gemini-3-flash-preview' })
  model?: string;

  @ApiPropertyOptional({ example: 'Gemini 3 Flash' })
  display_name?: string;

  @ApiPropertyOptional({ example: 'test' })
  display_version?: string;

  @ApiPropertyOptional({ example: 'Gemini.svg' })
  icon_url?: string;

  @ApiPropertyOptional({
    example: 'A multimodal model combining reasoning and efficiency.',
  })
  description?: string;

  @ApiPropertyOptional({ example: 'dial.gemini-3-flash-preview' })
  reference?: string;

  @ApiPropertyOptional({ example: 'organization-owner' })
  owner?: string;

  @ApiPropertyOptional({ example: 'succeeded' })
  status?: string;

  @ApiPropertyOptional({ example: 1779372048383 })
  created_at?: number;

  @ApiPropertyOptional({ example: 1779372138434 })
  updated_at?: number;

  @ApiPropertyOptional({ type: () => DialModelFeaturesDto })
  features?: DialModelFeaturesDto;

  @ApiPropertyOptional({
    type: [String],
    example: ['image/png', 'application/pdf'],
  })
  input_attachment_types?: string[];

  @ApiPropertyOptional({ example: 5 })
  max_input_attachments?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  defaults?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  responses_defaults?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: [String],
    example: ['Text Generation', 'Image Recognition'],
  })
  description_keywords?: string[];

  @ApiPropertyOptional({ example: 1 })
  max_retry_attempts?: number;

  @ApiPropertyOptional({ example: 'generally-available' })
  lifecycle_status?: string;

  @ApiPropertyOptional({ type: () => DialModelCapabilitiesDto })
  capabilities?: DialModelCapabilitiesDto;

  @ApiPropertyOptional({ example: 'gpt-4' })
  tokenizer_model?: string;

  @ApiPropertyOptional({ type: () => DialModelLimitsDto })
  limits?: DialModelLimitsDto;

  @ApiPropertyOptional({ type: () => DialModelPricingDto })
  pricing?: DialModelPricingDto;

  @ApiPropertyOptional({ type: [String], example: [] })
  interfaces?: string[];
}

export class DialModelListResponseDto {
  @ApiProperty({ type: () => [DialModelDto] })
  data!: DialModelDto[];
}

export class ThemeDto {
  @ApiProperty({ example: 'light' })
  id!: string;

  @ApiProperty({ example: 'Light Theme' })
  name!: string;

  @ApiPropertyOptional({ example: 'icon-light.svg' })
  icon?: string;
}

export class ThemeConfigResponseDto {
  @ApiProperty({ type: () => [ThemeDto] })
  themes!: ThemeDto[];
}

export class ChatCompletionChoiceDto {
  @ApiProperty({ example: 0 })
  index!: number;

  @ApiProperty({
    type: 'object',
    properties: {
      role: { type: 'string', example: 'assistant' },
      content: { type: 'string', example: 'Hello!' },
    },
  })
  message!: { role: string; content: string };
}

export class ChatCompletionResponseDto {
  @ApiProperty({ example: 'chatcmpl-123' })
  id!: string;

  @ApiProperty({ example: 'chat.completion' })
  object!: string;

  @ApiProperty({ type: () => [ChatCompletionChoiceDto] })
  choices!: ChatCompletionChoiceDto[];
}

export class ConversationMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'Hello!' })
  content!: string;

  @ApiProperty({ example: '2026-05-19T16:00:00.000Z' })
  timestamp!: string;
}

export class ConversationModelDto {
  @ApiProperty({ example: 'anthropic.claude-v3-sonnet' })
  id!: string;
}

export class ConversationMetadataDto {
  @ApiProperty({ example: 'Hello' })
  name!: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  author?: string;

  @ApiProperty({ example: 'test-bucket' })
  parentPath!: string;

  @ApiProperty({ example: 'test-bucket' })
  bucket!: string;

  @ApiProperty({ example: 'files/test-bucket/uuid__Hello' })
  url!: string;

  @ApiProperty({ example: 'ITEM' })
  nodeType!: string;

  @ApiProperty({ example: 'Conversation' })
  resourceType!: string;

  @ApiPropertyOptional({ example: 'abc123' })
  etag?: string;

  @ApiPropertyOptional({ example: 1779206400000 })
  createdAt?: number;

  @ApiPropertyOptional({ example: 1779206400000 })
  updatedAt?: number;

  @ApiPropertyOptional({ type: [String], example: ['READ', 'WRITE'] })
  permissions?: string[];
}

export class ConversationResponseDto {
  @ApiProperty({ example: 'test-bucket/uuid__Hello' })
  id!: string;

  @ApiProperty({ example: 'test-bucket' })
  folderId!: string;

  @ApiProperty({ example: 'Hello' })
  name!: string;

  @ApiProperty({ type: () => ConversationModelDto })
  model!: ConversationModelDto;

  @ApiProperty({ example: '' })
  prompt!: string;

  @ApiProperty({ example: 1 })
  temperature!: number;

  @ApiProperty({ type: () => [ConversationMessageDto] })
  messages!: ConversationMessageDto[];

  @ApiProperty({ example: 1779206400000 })
  lastActivityDate!: number;

  @ApiProperty({ example: 1779206400000 })
  updatedAt!: number;

  @ApiProperty({ type: [String], example: [] })
  selectedAddons!: string[];

  @ApiProperty({ example: 'anthropic.claude-v3-sonnet' })
  assistantModelId!: string;
}
