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

export class CreatePromptFolderDto {
  @ApiProperty({
    description: 'Folder name. Must not contain a forward slash.',
    example: 'AI',
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
    description: 'Parent folder path. Omit or leave empty to create at root.',
    example: 'Work',
  })
  @IsOptional()
  @IsString()
  @Matches(OPTIONAL_PROMPT_PATH_PATTERN, {
    message: PROMPT_PATH_VALIDATION_MESSAGE,
  })
  parentId?: string;
}
