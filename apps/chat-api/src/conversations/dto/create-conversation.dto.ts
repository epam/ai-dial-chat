import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DialAttachmentDto } from './dial-attachment.dto';

export class CreateConversationDto {
  @ApiProperty({
    description: 'The first message to start the conversation',
    example: 'Hello, how can you help me today?',
    minLength: 1,
    maxLength: 4000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  firstMessage!: string;

  @ApiPropertyOptional({
    description: 'DIAL API attachments to include with the first user message',
    type: [DialAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DialAttachmentDto)
  attachments?: DialAttachmentDto[];
}
