import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SKILL_RESOURCE_URL_PATTERN,
  SKILL_RESOURCE_URL_VALIDATION_MESSAGE,
} from '../../skills/constants/skill-resource.constants';

/*
 * A skill favorite is keyed by its full `skills/{bucket}/{path}` resource URL
 * rather than a bucket-relative path: the catalog lists two buckets, and the
 * same relative path can exist in both.
 */
export class UpdateInstalledSkillDto {
  @ApiProperty({
    description: 'Full skill resource URL.',
    example: 'skills/my-bucket/analysis/revenue-skill',
    maxLength: 2048,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(SKILL_RESOURCE_URL_PATTERN, {
    message: SKILL_RESOURCE_URL_VALIDATION_MESSAGE,
  })
  id!: string;

  @ApiProperty({
    description: 'Pass `true` to favorite the skill, `false` to unfavorite it.',
    example: true,
  })
  @IsBoolean()
  isInstalled!: boolean;
}
