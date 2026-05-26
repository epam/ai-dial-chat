import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { AttachmentDto } from '../../common/dto/attachment.dto';

export class SendCompletionDto {
  @ApiProperty({
    description: 'Conversation path (uuid__name). May contain slashes.',
    example: 'cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8__My Conversation',
  })
  @IsString()
  @MinLength(1)
  @Matches(/^(?!.*\.\.)[\s\S]+$/, {
    message: 'path contains invalid characters',
  })
  path!: string;

  @ApiProperty({
    description:
      'The new user message to send. May be empty when attachments are provided.',
    example: 'What is the capital of France?',
    maxLength: 4000,
  })
  @IsString()
  @MaxLength(4000)
  message!: string;

  @ApiProperty({
    description: 'DIAL Core deployment name to use for completion',
    example: 'anthropic.claude-v3-sonnet',
  })
  @IsString()
  @MinLength(1)
  model!: string;

  @ApiPropertyOptional({
    description: 'Attachments to send alongside the user message',
    type: () => [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
