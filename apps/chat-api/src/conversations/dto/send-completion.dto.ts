import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MessageCustomContentDto } from './message-custom-content.dto';
import { IsMessageOrAttachmentsPresent } from './message-or-attachments.validator';

export enum CompletionMode {
  Append = 'append',
  ContinueLastUser = 'continue_last_user',
  Regenerate = 'regenerate',
  Edit = 'edit',
}

export class SendCompletionDto {
  @ApiProperty({
    description: 'Client-generated UUID identifying this generation attempt.',
    example: 'cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
    format: 'uuid',
  })
  @IsUUID('4')
  generationId!: string;

  @ApiProperty({
    description:
      'Conversation path ({deploymentId}__{name}__{uuid}). May contain slashes.',
    example: 'gpt-4o__My Conversation__cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
  })
  @IsString()
  @MinLength(1)
  @Matches(/^(?!.*\.\.)[\s\S]+$/, {
    message: 'path contains invalid characters',
  })
  path!: string;

  @ApiProperty({
    description: 'DIAL Core deployment name to use for completion',
    example: 'anthropic.claude-v3-sonnet',
    maxLength: 256,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  model!: string;

  @ApiProperty({
    enum: CompletionMode,
    description:
      'How the message should be inserted into history. append = new user+assistant turn; continue_last_user = conversation already ends with a user message; regenerate = replace assistant at messageIndex; edit = replace user message at messageIndex.',
  })
  @IsEnum(CompletionMode)
  mode!: CompletionMode;

  @ApiPropertyOptional({
    description:
      'The new user message to send. May be empty when custom_content carries attachments, form_value, or configuration_value.',
    example: 'What is the capital of France?',
    maxLength: 40000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40000)
  @IsMessageOrAttachmentsPresent()
  message?: string;

  @ApiPropertyOptional({
    description:
      'Zero-based message index for regenerate and edit modes. Ignored for append/continue_last_user.',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  messageIndex?: number;

  @ApiPropertyOptional({
    description: 'Extra DIAL payload attached to the user message',
    type: MessageCustomContentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageCustomContentDto)
  custom_content?: MessageCustomContentDto;

  @ApiPropertyOptional({
    description:
      'Active DIAL Core client-channel id (from `POST /v1/client-channel/subscribe`), forwarded to DIAL Core so a mid-completion `toolset/signin` event can be correlated to this request. Omitted when no channel is active yet.',
    example: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(/^[\w.-]+$/, {
    message: 'clientChannelId contains invalid characters',
  })
  clientChannelId?: string;
}
