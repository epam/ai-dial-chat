import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MessageCustomContentDto } from '../../conversations/dto/message-custom-content.dto';

export enum ChatMessageRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
}

export class MessageDto {
  @ApiPropertyOptional({
    description: 'Unique message identifier',
    example: 'cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    description: 'Message author role',
    enum: ChatMessageRole,
    example: ChatMessageRole.User,
  })
  @IsEnum(ChatMessageRole)
  role: ChatMessageRole = ChatMessageRole.User;

  @ApiProperty({
    description: 'Message text content',
    example: 'Hello, how can you help me today?',
  })
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'ISO-8601 timestamp of when the message was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Extra DIAL payload attached to the message',
    type: MessageCustomContentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageCustomContentDto)
  custom_content?: MessageCustomContentDto;
}

export class ChatCompletionDto {
  @ApiProperty({
    description:
      'DIAL Core deployment name (may contain slashes and special characters)',
    example: 'gpt-4o',
  })
  @IsString()
  @MinLength(1)
  deployment!: string;

  @ApiProperty({
    description: 'Ordered chat messages to send to DIAL Core',
    type: () => [MessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[] = [];

  @ApiPropertyOptional({
    description: 'Sampling temperature',
    example: 0.7,
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of tokens to generate',
    example: 1024,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;
}
