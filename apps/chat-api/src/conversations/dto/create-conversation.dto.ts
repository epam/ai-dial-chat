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

export class CreateConversationDto {
  @ApiProperty({
    description:
      'The first message to start the conversation. May be empty when custom_content carries attachments, form_value, or configuration_value.',
    example: 'Hello, how can you help me today?',
    maxLength: 4000,
  })
  @IsString()
  @MaxLength(4000)
  @IsMessageOrAttachmentsPresent()
  firstMessage!: string;

  @ApiProperty({
    description:
      'ID of the catalog item (model or application) to use for this conversation',
    example: 'anthropic.claude-v3-sonnet',
    minLength: 1,
    maxLength: 256,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @Matches(/^[\w.\-:@/]+$/)
  deploymentId!: string;

  @ApiPropertyOptional({
    description: 'Extra DIAL payload attached to the first user message',
    type: MessageCustomContentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageCustomContentDto)
  custom_content?: MessageCustomContentDto;
}
