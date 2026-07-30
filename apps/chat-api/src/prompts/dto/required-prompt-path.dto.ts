import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PROMPT_PATH_PATTERN,
  PROMPT_PATH_VALIDATION_MESSAGE,
} from '../constants/prompt-path.constants';

export class RequiredPromptPathDto {
  @ApiProperty({
    description: 'Prompt path within the prompts namespace',
    example: 'Work/AI/my-prompt',
    maxLength: 2048,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(PROMPT_PATH_PATTERN, {
    message: PROMPT_PATH_VALIDATION_MESSAGE,
  })
  path!: string;
}
