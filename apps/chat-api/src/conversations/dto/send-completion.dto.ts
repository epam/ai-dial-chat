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
    minLength: 1,
    maxLength: 4000,
  })
  @IsString()
  @MinLength(1)
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
    description: 'Extra DIAL payload attached to the user message',
    type: MessageCustomContentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageCustomContentDto)
  custom_content?: MessageCustomContentDto;
}
