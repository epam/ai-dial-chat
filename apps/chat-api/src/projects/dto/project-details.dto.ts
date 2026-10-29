import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProjectDto } from './project.dto';

/** One file directly under a project's `context/` folder. */
export class ProjectContextFileDto {
  @ApiProperty({ example: 'tickets.csv' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 2048, description: 'Size in bytes.' })
  @IsInt()
  @Min(0)
  size!: number;
}

/** One project's details, read as one consistent DIAL Core version. */
export class ProjectDetailsDto extends ProjectDto {
  @ApiProperty({
    example: 'Bundles the Q4 support tickets and survey results.',
    description: 'Plain-text description from `PROJECT.md`; empty when absent.',
  })
  @IsString()
  description!: string;

  @ApiProperty({
    example: '## Approach\nExplain your reasoning step by step.',
    description: 'Markdown instructions from `PROJECT.md`; empty when absent.',
  })
  @IsString()
  instructions!: string;

  @ApiProperty({
    type: [ProjectContextFileDto],
    description: 'Files directly under `context/`, sorted by name.',
  })
  @ValidateNested({ each: true })
  contextFiles!: ProjectContextFileDto[];

  @ApiProperty({
    example: '"9f2c"',
    description:
      'Aggregate ETag of the version these details were read from; send it as `If-Match` on update and delete.',
  })
  @IsString()
  etag!: string;

  @ApiProperty({
    example: true,
    description:
      "Whether the caller may edit, delete, share and publish the project — `true` only in the caller's own bucket.",
  })
  @IsBoolean()
  canEdit!: boolean;
}
