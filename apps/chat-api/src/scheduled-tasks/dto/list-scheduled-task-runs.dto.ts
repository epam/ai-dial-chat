import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ScheduledTaskRunDto } from './scheduled-task-run.dto';

export class ListScheduledTaskRunsResponseDto {
  @ApiProperty({ type: [ScheduledTaskRunDto] })
  @ValidateNested({ each: true })
  @Type(() => ScheduledTaskRunDto)
  items!: ScheduledTaskRunDto[];

  @ApiPropertyOptional({
    example: 242,
    description: 'Total number of runs upstream, across all pages.',
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
    example: 40,
    description: 'Offset of `items` within the full upstream result set.',
  })
  @IsOptional()
  @IsInt()
  offset?: number;

  @ApiPropertyOptional({
    type: String,
    example: '/schedules/sched_123/runs?limit=20&offset=60',
    nullable: true,
    description:
      'Upstream URL for the next page, or null if this is the last page.',
  })
  @IsOptional()
  @IsString()
  next?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '/schedules/sched_123/runs?limit=20&offset=20',
    nullable: true,
    description:
      'Upstream URL for the previous page, or null if this is the first page.',
  })
  @IsOptional()
  @IsString()
  previous?: string | null;
}
