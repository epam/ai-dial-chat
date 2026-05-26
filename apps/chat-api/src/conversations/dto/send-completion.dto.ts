import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AttachmentDto } from './attachment.dto';

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
    description: 'The new user message to send',
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
    description: 'DIAL API attachments to include with the user message',
    type: [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({
    description:
      'Configuration form values submitted with the message. ' +
      'Keys match the property names in the deployment JSON Schema (e.g. { button: 1 }).',
    example: { button: 1 },
  })
  @IsOptional()
  @IsObject()
  configurationValue?: Record<string, unknown>;
}
