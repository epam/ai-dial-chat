import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationMessageDto } from '../conversations/dto/conversation-message.dto';

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

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Allowlisted claims keyed by claim name. A dot-notation rolesClaim ' +
      '(e.g. "realm_access.roles") is stored under one flat key equal to ' +
      'that literal string, never as a nested object.',
  })
  claims!: Record<string, unknown>;

  @ApiProperty({ example: 'default-bucket' })
  bucket!: string;

  @ApiProperty({
    example: false,
    description:
      "Whether the user's roles claim intersects the provider's configured adminRoles",
  })
  isAdmin!: boolean;
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

  @ApiPropertyOptional({ example: false })
  chat_completion?: boolean;

  @ApiPropertyOptional({ example: false })
  responses_api?: boolean;

  @ApiPropertyOptional({ example: true })
  max_tokens_supported?: boolean;

  @ApiPropertyOptional({ example: false })
  max_completion_tokens_supported?: boolean;

  @ApiPropertyOptional({ example: true })
  custom_temperature_supported?: boolean;

  @ApiPropertyOptional({ type: [String], example: [] })
  reasoning_efforts?: string[];
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

export class DialToolsetAuthSettingsDto {
  @ApiProperty({ example: 'OAUTH', enum: ['OAUTH', 'API_KEY', 'NONE'] })
  authentication_type!: string;

  @ApiPropertyOptional({ example: 'X-Api-Key' })
  api_key_header?: string;

  @ApiPropertyOptional({ example: 'my-client-id' })
  client_id?: string;

  @ApiPropertyOptional({ example: '' })
  redirect_uri?: string;

  @ApiPropertyOptional({ example: '' })
  authorization_endpoint?: string;

  @ApiPropertyOptional({ example: '' })
  token_endpoint?: string;

  @ApiPropertyOptional({ example: 'base64-url-code-challenge' })
  code_challenge?: string;

  @ApiPropertyOptional({ example: 'S256' })
  code_challenge_method?: string;

  @ApiPropertyOptional({ type: [String], example: ['scope1', 'scope2'] })
  scopes_supported?: string[];

  @ApiPropertyOptional({
    example: 'SIGNED_OUT',
    enum: ['SIGNED_IN', 'SIGNED_OUT'],
  })
  global_auth_status?: string;

  @ApiPropertyOptional({
    example: 'SIGNED_OUT',
    enum: ['SIGNED_IN', 'SIGNED_OUT'],
  })
  user_level_auth_status?: string;
}

export class DialToolsetDto {
  @ApiProperty({
    example: 'toolsets/encrypted-bucket/folder/toolset-name',
  })
  id!: string;

  @ApiProperty({
    example: 'toolsets/encrypted-bucket/folder/toolset-name',
  })
  toolset!: string;

  @ApiPropertyOptional({ example: 'Toolset display name' })
  display_name?: string;

  @ApiPropertyOptional({ example: '0.0.1' })
  display_version?: string;

  @ApiPropertyOptional({ example: 'My toolset description' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Runs your toolset in one line.',
    maxLength: 90,
  })
  intro?: string;

  @ApiPropertyOptional({ example: '' })
  icon_url?: string;

  @ApiPropertyOptional({ example: "Owner's name" })
  owner?: string;

  @ApiPropertyOptional({ example: 'toolset' })
  object?: string;

  @ApiPropertyOptional({ example: 'succeeded' })
  status?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['keyword1', 'keyword2'],
  })
  description_keywords?: string[];

  @ApiPropertyOptional({
    example: 'ff5584b7-a82b-4f4f-bf42-5bf74a3893d6',
  })
  reference?: string;

  @ApiPropertyOptional({ example: 2 })
  max_retry_attempts?: number;

  @ApiPropertyOptional({ example: 1672534800 })
  created_at?: number;

  @ApiPropertyOptional({ example: 1672534900 })
  updated_at?: number;

  @ApiPropertyOptional({ type: () => DialModelFeaturesDto })
  features?: DialModelFeaturesDto;

  @ApiPropertyOptional({ example: 'https://my-toolset.example.com/mcp' })
  endpoint?: string;

  @ApiPropertyOptional({ example: 'HTTP' })
  transport?: string;

  @ApiPropertyOptional({ type: [String], example: ['tool1', 'tool2'] })
  allowed_tools?: string[];

  @ApiPropertyOptional({ type: () => DialToolsetAuthSettingsDto })
  auth_settings?: DialToolsetAuthSettingsDto;

  @ApiPropertyOptional({
    description: 'Whether this toolset is installed by the current user',
  })
  is_installed?: boolean;

  @ApiPropertyOptional({
    description:
      'True when the toolset id/path belongs to the current session user bucket',
  })
  is_my?: boolean;

  @ApiPropertyOptional({
    description:
      'True when the current user may edit this toolset — owns it, or was granted WRITE access via a share invitation',
  })
  can_edit?: boolean;

  @ApiPropertyOptional({
    description:
      'True when this toolset is shared with the current user (READ or WRITE) and not owned by them',
  })
  shared_with_me?: boolean;
}

export class DialToolsetListResponseDto {
  @ApiProperty({ type: () => [DialToolsetDto] })
  data!: DialToolsetDto[];
}

export class LimitStatsDto {
  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 10 })
  used!: number;
}

export class DeploymentLimitsResponseDto {
  @ApiPropertyOptional({ type: () => LimitStatsDto })
  hourRequestStats?: LimitStatsDto;

  @ApiPropertyOptional({ type: () => LimitStatsDto })
  dayRequestStats?: LimitStatsDto;

  @ApiPropertyOptional({ type: () => LimitStatsDto })
  minuteTokenStats?: LimitStatsDto;

  @ApiPropertyOptional({ type: () => LimitStatsDto })
  dayTokenStats?: LimitStatsDto;

  @ApiPropertyOptional({ type: () => LimitStatsDto })
  weekTokenStats?: LimitStatsDto;

  @ApiPropertyOptional({ type: () => LimitStatsDto })
  monthTokenStats?: LimitStatsDto;

  @ApiPropertyOptional({ type: () => LimitStatsDto })
  minuteCostStats?: LimitStatsDto;

  @ApiPropertyOptional({ type: () => LimitStatsDto })
  dayCostStats?: LimitStatsDto;

  @ApiPropertyOptional({ type: () => LimitStatsDto })
  weekCostStats?: LimitStatsDto;

  @ApiPropertyOptional({ type: () => LimitStatsDto })
  monthCostStats?: LimitStatsDto;
}

export class ThemeDto {
  @ApiProperty({ example: 'light' })
  id!: string;

  @ApiProperty({ example: 'Light Theme' })
  displayName!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'primary-color': '#ffffff' },
  })
  colors!: Record<string, string>;

  @ApiProperty({ example: 'https://example.com/logo-light.svg' })
  'app-logo'!: string;
}

export class ThemeImagesDto {
  @ApiProperty({ example: 'https://example.com/addon.png' })
  'default-addon'!: string;

  @ApiProperty({ example: 'https://example.com/model.png' })
  'default-model'!: string;

  @ApiProperty({ example: 'https://example.com/favicon.ico' })
  favicon!: string;

  @ApiPropertyOptional({ example: 'chat-logo-light.svg' })
  'chat-logo-light'?: string;

  @ApiPropertyOptional({ example: 'chat-logo-dark.svg' })
  'chat-logo-dark'?: string;

  @ApiPropertyOptional({ example: 'https://example.com/chat-favicon.png' })
  'chat-favicon'?: string;
}

export class ThemeConfigResponseDto {
  @ApiProperty({ type: () => [ThemeDto] })
  themes!: ThemeDto[];

  @ApiProperty({ type: () => ThemeImagesDto })
  images!: ThemeImagesDto;
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

  @ApiPropertyOptional({
    example: 'markdown',
    enum: ['markdown', 'plain_text'],
  })
  responseFormat?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, automatic LLM conversation naming has already run for this conversation.',
  })
  llmNamingDone?: boolean;
}
