import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MaxCodePoints } from '../../common/validators/max-code-points.validator';

/** Code-point cap on a project description, matching `project-description` refinement. */
export const PROJECT_DESCRIPTION_MAX_LENGTH = 4000;

/** Code-point cap on project instructions, matching `project-instructions` refinement. */
export const PROJECT_INSTRUCTIONS_MAX_LENGTH = 32000;

/**
 * Multipart text fields for `POST /api/v1/projects`. The repeated binary
 * `files` parts are read by `ProjectContextUploadInterceptor`, not modelled
 * here. `name` is only bounded here: the DIAL entity-name rule runs in
 * `ProjectsCreateService`, so its rejection can carry
 * `code: 'invalid-name'`, which a `ValidationPipe` error cannot. The target
 * bucket is always the session user's own, so there is no bucket field.
 */
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @ApiProperty({
    description:
      'Project name, used verbatim as its resource path. At most 255 UTF-8 bytes, no surrounding whitespace, no control characters or any of : ; , = / \\ { } % & ", and not a reserved name.',
    example: 'Q4 launch',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxCodePoints(PROJECT_DESCRIPTION_MAX_LENGTH)
  @ApiPropertyOptional({
    description:
      'What the project is about. Stored in the PROJECT.md frontmatter.',
    maxLength: PROJECT_DESCRIPTION_MAX_LENGTH,
    example: 'Bundles the Q4 support tickets and survey results.',
  })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxCodePoints(PROJECT_INSTRUCTIONS_MAX_LENGTH)
  @ApiPropertyOptional({
    description:
      'Markdown instructions, stored verbatim as the PROJECT.md body.',
    maxLength: PROJECT_INSTRUCTIONS_MAX_LENGTH,
    example: '## Approach\nExplain your reasoning step by step.',
  })
  instructions?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      "JSON-encoded array of the context files' names, positionally paired with the repeated `files` parts. Authoritative over each part's own filename.",
    example: '["tickets.csv","survey.xlsx"]',
  })
  fileNames?: string;
}
