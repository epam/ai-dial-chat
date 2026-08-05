import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PROMPT_NAME_PATTERN,
  PROMPT_NAME_VALIDATION_MESSAGE,
} from '../constants/prompt-path.constants';

export class RenamePromptFolderDto {
  @ApiProperty({
    description: 'New folder name. Must not contain a forward slash.',
    example: 'Machine Learning',
    maxLength: 256,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @Matches(PROMPT_NAME_PATTERN, {
    message: PROMPT_NAME_VALIDATION_MESSAGE,
  })
  name!: string;
}
