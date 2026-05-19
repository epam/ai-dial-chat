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
  ValidateNested,
} from 'class-validator';

export enum ChatMessageRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
}

export class MessageDto {
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
}

export class ChatCompletionDto {
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
