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

export class DialDeploymentDto {
  @ApiProperty({ example: 'gpt-4o' })
  id!: string;

  @ApiPropertyOptional({ example: 'GPT-4o' })
  name?: string;

  @ApiPropertyOptional({ example: 'model' })
  type?: string;
}

export class DialModelDto {
  @ApiProperty({ example: 'gpt-4o' })
  id!: string;

  @ApiProperty({ example: 'model' })
  object!: string;

  @ApiPropertyOptional({ example: 1712345678 })
  created?: number;

  @ApiPropertyOptional({ example: 'openai' })
  owned_by?: string;
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
  @ApiProperty({ example: '7c20f2e0-83d9-45aa-9fdc-bf3eb9f16bf8' })
  id!: string;

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
