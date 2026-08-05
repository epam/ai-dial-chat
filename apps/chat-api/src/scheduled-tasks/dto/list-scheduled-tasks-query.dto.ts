import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Sort order for the scheduled tasks list, matching the frontend toolbar's sort options. */
export enum ScheduledTasksSortKey {
  /** Order by upstream `next_run_time` ascending — earliest next run first. */
  FirstToRun = 'firstToRun',
  /** Order by upstream `next_run_time` descending — latest next run first. */
  LastToRun = 'lastToRun',
  /** Order by upstream `created_at` descending — most recently created first. */
  Newest = 'newest',
  /** Order by upstream `name` ascending. */
  NameAZ = 'nameAZ',
}

export class ListScheduledTasksQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of scheduled tasks to return.',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value != null ? Number(value) : undefined))
  limit?: number;

  @ApiPropertyOptional({
    description: 'Offset of the first scheduled task to return.',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => (value != null ? Number(value) : undefined))
  offset?: number;

  @ApiPropertyOptional({
    description:
      'Case-insensitive substring match against the scheduled task display name. ' +
      'Trimmed before use; an empty or whitespace-only value is treated as omitted.',
    example: 'daily',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({
    description:
      'Sort order for the returned scheduled tasks. Defaults to `firstToRun`.',
    enum: ScheduledTasksSortKey,
    example: ScheduledTasksSortKey.FirstToRun,
  })
  @IsOptional()
  @IsEnum(ScheduledTasksSortKey)
  sort?: ScheduledTasksSortKey;
}
