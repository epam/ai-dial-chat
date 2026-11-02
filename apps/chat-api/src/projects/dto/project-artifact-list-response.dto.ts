import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

/** One file directly under a project's `artifacts/` folder. */
export class ProjectArtifactItemDto {
  @ApiProperty({
    description: 'File name under the project `artifacts/` folder.',
    example: 'report.pdf',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Last update time, in epoch milliseconds.',
    example: 1793606400000,
  })
  @IsOptional()
  @IsInt()
  updatedAt?: number;

  @ApiPropertyOptional({
    description: "Display name of the file's last writer, from DIAL Core.",
    example: 'Jane Doe',
  })
  @IsOptional()
  @IsString()
  author?: string;
}

/** Response of `GET /api/v1/projects/:id/artifacts`. */
export class ProjectArtifactListResponseDto {
  @ApiProperty({
    type: [ProjectArtifactItemDto],
    description:
      'Files directly under `artifacts/`, newest first; nested paths are not listed.',
  })
  @ValidateNested({ each: true })
  items!: ProjectArtifactItemDto[];
}
