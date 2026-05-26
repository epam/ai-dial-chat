import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MessageCustomContentDto } from './message-custom-content.dto';

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
    description: 'Extra DIAL payload attached to the first user message',
    type: MessageCustomContentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageCustomContentDto)
  custom_content?: MessageCustomContentDto;
}
