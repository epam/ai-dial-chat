import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import {
  SkillFileResourceQueryDto,
  SkillResourceQueryDto,
} from './skill-resource-query.dto';

/** Query params for `DELETE /api/v1/skills` (whole-skill deletion). */
export class DeleteSkillDto extends SkillResourceQueryDto {}

/** Query params for `DELETE /api/v1/skills/files` (single-file deletion). */
export class DeleteSkillFileDto extends SkillFileResourceQueryDto {}

/**
 * Query params for `POST /api/v1/skills/grouping-folders` and
 * `DELETE /api/v1/skills/grouping-folders`. The verified SDK schema declares
 * no request headers at all for `createSkillGroupingFolder` (design.md D2),
 * so `If-Match` is only ever read by the delete route — that asymmetry is
 * handled in `SkillsMutationService`/`SkillsController`, not here.
 */
export class SkillGroupingFolderDto extends SkillResourceQueryDto {}

/** Response body for `DELETE /api/v1/skills/files` (single-file deletion). */
export class SkillFileDeleteResponseDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'New ETag of the skill after file deletion, when DIAL Core returns one',
    example: '"ghi789"',
  })
  etag?: string;
}

/** Response body for `POST /api/v1/skills/grouping-folders` (grouping-folder creation). */
export class SkillGroupingFolderResponseDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'ETag of the created grouping folder, when DIAL Core returns one',
    example: '"jkl012"',
  })
  etag?: string;
}

/** Response body for `DELETE /api/v1/skills` and `DELETE /api/v1/skills/grouping-folders`. */
export class SkillOperationResultDto {
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Always true on success', example: true })
  success!: boolean;
}
