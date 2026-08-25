import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { SkillResourceQueryDto } from './skill-resource-query.dto';

/**
 * Multipart form fields for `POST /api/v1/skills` (atomic whole-skill
 * create). `bucket`/`path` are inherited from `SkillResourceQueryDto`. The
 * repeated binary `files` parts are handled by an interceptor, not modeled
 * here. No `If-Match`/`If-None-Match` request header is read for this
 * endpoint — the BFF always sends `If-None-Match: '*'` to DIAL Core.
 */
export class CreateSkillDto extends SkillResourceQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_048_576)
  @ApiProperty({
    description:
      'The complete SKILL.md text (YAML frontmatter plus instructions)',
    example:
      '---\nname: docs-helper\ndescription: Explains our docs\n---\n\nUse this skill to...',
  })
  skillManifest!: string;

  @IsString()
  @ApiProperty({
    description:
      "JSON-encoded array of the supporting files' relative paths, positionally paired with the repeated `files` parts",
    example: '["scripts/run.sh","assets/icon.png"]',
  })
  filePaths!: string;
}
