import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MessageCustomContentDto } from './message-custom-content.dto';
import { IsMessageOrAttachmentsPresent } from './message-or-attachments.validator';

export class SendCompletionDto {
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
    description:
      'The new user message to send. May be empty when custom_content carries attachments, form_value, or configuration_value.',
    example: 'What is the capital of France?',
    maxLength: 4000,
  })
  @IsString()
  @MaxLength(4000)
  @IsMessageOrAttachmentsPresent()
  message!: string;

  @ApiProperty({
    description: 'DIAL Core deployment name to use for completion',
    example: 'anthropic.claude-v3-sonnet',
  })
  @IsString()
  @MinLength(1)
  model!: string;

  @ApiPropertyOptional({
    description: 'Extra DIAL payload attached to the user message',
    type: MessageCustomContentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageCustomContentDto)
  custom_content?: MessageCustomContentDto;
}
