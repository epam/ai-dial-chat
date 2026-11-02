import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, ValidateNested } from 'class-validator';
import { ProjectSource } from './project-source.enum';
import { ProjectDto } from './project.dto';

export class ListProjectsResponseDto {
  @ApiProperty({
    type: [ProjectDto],
    description:
      'Every project visible to the caller across the personal, organization and shared sources, de-duplicated by id. Order is unspecified.',
  })
  @ValidateNested({ each: true })
  @Type(() => ProjectDto)
  items!: ProjectDto[];

  @ApiProperty({
    enum: ProjectSource,
    enumName: 'ProjectSource',
    isArray: true,
    example: [],
    description:
      'Sources that failed or were truncated at the page cap, so `items` may be missing projects from them. Empty when every source answered in full.',
  })
  @IsEnum(ProjectSource, { each: true })
  incompleteSources!: ProjectSource[];
}
