import { ApiPropertyOptional } from '@nestjs/swagger';
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
