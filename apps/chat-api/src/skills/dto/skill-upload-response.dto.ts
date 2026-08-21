import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Response body for `PUT /api/v1/skills` (whole-skill upload). */
export class SkillUploadResponseDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'New aggregate ETag of the uploaded skill, when DIAL Core returns one',
    example: '"abc123"',
  })
  etag?: string;
}

/**
 * Response body for `POST /api/v1/skills/import`. Unlike `createSkill`'s
 * caller (which already knows `bucket`/`path` because it supplied them),
 * `importSkillArchive`'s caller does not know the destination path in
 * advance — it is derived server-side from the archive manifest's `name` —
 * so this DTO reports it back (design.md D2, `add-skill-archive-import`).
 */
export class SkillImportResponseDto {
  @IsString()
  @ApiProperty({
    description: "The created skill's name, derived from its manifest",
    example: 'docs-helper',
  })
  name!: string;

  @IsString()
  @ApiProperty({
    description: "The created skill's destination path within the bucket",
    example: 'docs-helper',
  })
  path!: string;

  @IsString()
  @ApiProperty({
    description: "The created skill's DIAL Core resource URL",
    example: 'skills/my-bucket/docs-helper',
  })
  url!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'New ETag of the created skill, when DIAL Core returns one',
    example: '"abc123"',
  })
  etag?: string;
}

/** Response body for `PUT /api/v1/skills/files` (single in-skill file upload). */
export class SkillFileUploadResponseDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'New ETag of the uploaded file, when DIAL Core returns one',
    example: '"def456"',
  })
  etag?: string;
}
