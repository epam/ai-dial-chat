import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/*
 * A `skills/{bucket}/{path}` DIAL Core resource URL — the same form the skill
 * listing and `CatalogItem.id` use. The bucket charset mirrors
 * `BUCKET_NAME_PATTERN`; the `(?!.*\.\.)` lookahead rejects path traversal
 * into other buckets, the same guard `SendCompletionDto.path` carries.
 */
const SKILL_URL_PATTERN = /^skills\/(?!.*\.\.)[\w.-]+\/.+$/;

/*
 * A skill referenced from `custom_content.skills` — DIAL Core's `RequestSkill`
 * schema (PR #1956): an object with a non-blank `url`.
 */
export class RequestSkillDto {
  @ApiProperty({
    description: "The skill's resource URL (skills/{bucket}/{path})",
    example: 'skills/my-bucket/team-a/docs-helper',
    maxLength: 1024,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @Matches(SKILL_URL_PATTERN, {
    message: 'url must be a DIAL skill resource path (skills/{bucket}/{path})',
  })
  url!: string;
}
