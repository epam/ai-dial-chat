import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import {
  OPTIONAL_PROMPT_PATH_PATTERN,
  PROMPT_PATH_VALIDATION_MESSAGE,
} from '../constants/prompt-path.constants';

export class MovePromptDto {
  @ApiProperty({
    description: 'Target folder path. Empty string to move to root.',
    example: 'Work/AI',
  })
  @IsString()
  @Matches(OPTIONAL_PROMPT_PATH_PATTERN, {
    message: PROMPT_PATH_VALIDATION_MESSAGE,
  })
  targetFolderId!: string;
}
