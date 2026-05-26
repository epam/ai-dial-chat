import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttachmentDto } from './attachment.dto';

export class CreateConversationDto {
  @ApiProperty({
    description: 'The first message to start the conversation',
    example: 'Hello, how can you help me today?',
    maxLength: 4000,
  })
  @IsString()
  @MaxLength(4000)
  firstMessage!: string;

  @ApiPropertyOptional({
    description: 'DIAL API attachments to include with the first user message',
    type: [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({
    description:
      'Configuration form values submitted with the first message. ' +
      'Keys match the property names in the deployment JSON Schema (e.g. { button: 1 }).',
    example: { button: 1 },
  })
  @IsOptional()
  @IsObject()
  configurationValue?: Record<string, unknown>;
}
