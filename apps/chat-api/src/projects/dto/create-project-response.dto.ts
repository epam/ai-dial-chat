import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Response body for `POST /api/v1/projects`. */
export class CreateProjectResponseDto {
  @ApiProperty({
    example: 'projects/a1b2c3/Q4 launch',
    description:
      'DIAL Core resource id, `projects/{bucket}/{path}` without a trailing slash.',
  })
  id!: string;

  @ApiProperty({ example: 'Q4 launch' })
  name!: string;

  @ApiProperty({ example: 'a1b2c3' })
  bucket!: string;

  @ApiProperty({
    example: 'Q4 launch',
    description: 'Path of the project within its bucket.',
  })
  path!: string;

  @ApiPropertyOptional({
    description:
      'Aggregate ETag of the created project, when DIAL Core returns one.',
    example: '"9f2c0e1d"',
  })
  etag?: string;
}
