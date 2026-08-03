import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ScheduledTaskDto } from './scheduled-task.dto';

export class ListScheduledTasksResponseDto {
  @ApiProperty({ type: [ScheduledTaskDto] })
  @ValidateNested({ each: true })
  @Type(() => ScheduledTaskDto)
  items!: ScheduledTaskDto[];

  @ApiPropertyOptional({
    example: 4,
    description: 'Total number of schedules upstream, across all pages.',
  })
  @IsOptional()
  @IsInt()
  count?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Page size used by the upstream DIAL Scheduler response.',
  })
  @IsOptional()
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Offset of `items` within the full upstream result set.',
  })
  @IsOptional()
  @IsInt()
  offset?: number;

  @ApiPropertyOptional({
    type: String,
    example: null,
    nullable: true,
    description:
      'Upstream URL for the next page, or null if this is the last page.',
  })
  @IsOptional()
  @IsString()
  next?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: null,
    nullable: true,
    description:
      'Upstream URL for the previous page, or null if this is the first page.',
  })
  @IsOptional()
  @IsString()
  previous?: string | null;
}
