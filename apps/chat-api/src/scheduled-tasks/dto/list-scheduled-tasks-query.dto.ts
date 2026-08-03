import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
}
