import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ProjectSource } from './project-source.enum';

export class ProjectDto {
  @ApiProperty({
    example: 'projects/a1b2c3/marketing/q4-launch',
    description:
      'DIAL Core resource id, `projects/{bucket}/{path}` without a trailing slash.',
  })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'q4-launch' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'a1b2c3' })
  @IsString()
  bucket!: string;

  @ApiProperty({
    example: 'marketing/q4-launch',
    description: 'Path of the project within its bucket.',
  })
  @IsString()
  path!: string;

  @ApiPropertyOptional({
    example: 'marketing',
    description: 'Grouping folder path the project sits in, when nested.',
  })
  @IsOptional()
  @IsString()
  parentPath?: string;

  @ApiProperty({
    enum: ProjectSource,
    enumName: 'ProjectSource',
    example: ProjectSource.Personal,
  })
  @IsEnum(ProjectSource)
  source!: ProjectSource;

  @ApiPropertyOptional({ example: 'jane.doe' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({
    example: 1790000000000,
    description: 'Creation time, epoch milliseconds.',
  })
  @IsOptional()
  @IsInt()
  createdAt?: number;

  @ApiPropertyOptional({
    example: 1791234567000,
    description: 'Last update time, epoch milliseconds.',
  })
  @IsOptional()
  @IsInt()
  updatedAt?: number;
}
