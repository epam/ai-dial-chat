import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  OPTIONAL_PROMPT_PATH_PATTERN,
  PROMPT_NAME_PATTERN,
  PROMPT_NAME_VALIDATION_MESSAGE,
  PROMPT_PATH_VALIDATION_MESSAGE,
} from '../constants/prompt-path.constants';

export class CreatePromptDto {
  @ApiProperty({
    description: 'Prompt name. Must not contain a forward slash.',
    example: 'My Prompt',
    maxLength: 256,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @Matches(PROMPT_NAME_PATTERN, {
    message: PROMPT_NAME_VALIDATION_MESSAGE,
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Optional description',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description: 'Prompt text. May contain {{variableName}} placeholders.',
    maxLength: 50000,
  })
  @IsString()
  @MaxLength(50000)
  content!: string;

  @ApiPropertyOptional({
    description: 'Parent folder path. Empty string or omit for root.',
    example: 'Work/AI',
  })
  @IsOptional()
  @IsString()
  @Matches(OPTIONAL_PROMPT_PATH_PATTERN, {
    message: PROMPT_PATH_VALIDATION_MESSAGE,
  })
  folderId?: string;
}
