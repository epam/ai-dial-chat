import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import {
  PROMPT_PATH_PATTERN,
  PROMPT_PATH_VALIDATION_MESSAGE,
} from '../../prompts/constants/prompt-path.constants';

/*
 * Prompt paths legitimately contain spaces and slashes, so the shared
 * `UpdateInstalledDto` (no-whitespace ids) cannot express them.
 */
export class UpdateInstalledPromptDto {
  @ApiProperty({
    description: 'Prompt path within the prompts namespace.',
    example: 'Work/AI/summarize',
    maxLength: 2048,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(PROMPT_PATH_PATTERN, { message: PROMPT_PATH_VALIDATION_MESSAGE })
  id!: string;

  @ApiProperty({
    description:
      'Pass `true` to favorite the prompt, `false` to unfavorite it.',
    example: true,
  })
  @IsBoolean()
  isInstalled!: boolean;
}
