import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PROMPT_NAME_PATTERN,
  PROMPT_NAME_VALIDATION_MESSAGE,
} from '../constants/prompt-path.constants';

export class UpdatePromptDto {
  @ApiPropertyOptional({
    description: 'New display name. Must not contain a forward slash.',
    maxLength: 256,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @Matches(PROMPT_NAME_PATTERN, {
    message: PROMPT_NAME_VALIDATION_MESSAGE,
  })
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated prompt text',
    maxLength: 50000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;
}
