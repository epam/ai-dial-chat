import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import {
  PROMPT_ID_PATTERN,
  PROMPT_ID_VALIDATION_MESSAGE,
} from '../../prompts/constants/prompt-path.constants';

/*
 * A prompt favorite is keyed by its full `prompts/{bucket}/{path}` resource
 * id rather than a bucket-relative path — the same full-id shape
 * `CatalogItem.id` already carries end to end, and the same convention
 * `UpdateInstalledSkillDto` uses for skill favorites.
 */
export class UpdateInstalledPromptDto {
  @ApiProperty({
    description: 'Full prompt resource path (`prompts/{bucket}/{path}`).',
    example: 'prompts/my-bucket/Work/AI/summarize',
    maxLength: 2048,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(PROMPT_ID_PATTERN, { message: PROMPT_ID_VALIDATION_MESSAGE })
  id!: string;

  @ApiProperty({
    description:
      'Pass `true` to favorite the prompt, `false` to unfavorite it.',
    example: true,
  })
  @IsBoolean()
  isInstalled!: boolean;
}
