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

export class MessageDto {
  @IsEnum(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant' = 'user';

  @IsString()
  content?: string;
}

export class ChatCompletionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[] = [];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;
}
