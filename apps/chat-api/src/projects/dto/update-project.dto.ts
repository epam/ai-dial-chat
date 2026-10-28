import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

/**
 * Multipart text fields for `PUT /api/v1/projects/:id`: the create fields,
 * where `fileNames` lists only the added files, plus the stored files to
 * drop. A name different from the project's last path segment renames it.
 */
export class UpdateProjectDto extends CreateProjectDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'JSON-encoded array of stored context file names to remove. Replacing a file lists its name here and in `fileNames`.',
    example: '["survey.xlsx"]',
  })
  removedFileNames?: string;
}

/** Response body for `PUT /api/v1/projects/:id`. */
export class UpdateProjectResponseDto {
  @ApiProperty({
    example: 'projects/a1b2c3/Q4 launch',
    description:
      'The project id after the save — a new id when it was renamed.',
  })
  id!: string;

  @ApiProperty({ example: 'Q4 launch' })
  name!: string;

  @ApiProperty({ example: 'a1b2c3' })
  bucket!: string;

  @ApiProperty({ example: 'Q4 launch' })
  path!: string;

  /** Absent when the renamed project's ETag could not be read back after the move. */
  @ApiPropertyOptional({
    example: '"b71e"',
    description:
      'Aggregate ETag of the saved version. Absent when the project was renamed and its new ETag could not be read back; the save itself committed, so reload the project for a fresh one.',
  })
  etag?: string;

  @ApiProperty({
    example: true,
    description: "Whether the project is in the caller's pins after the save.",
  })
  isPinned!: boolean;
}
