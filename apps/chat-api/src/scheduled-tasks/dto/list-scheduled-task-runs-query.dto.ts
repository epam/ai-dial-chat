import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListScheduledTaskRunsQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of runs to return.',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value != null ? Number(value) : undefined))
  limit?: number;

  @ApiPropertyOptional({
    description: 'Offset of the first run to return.',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => (value != null ? Number(value) : undefined))
  offset?: number;
}
