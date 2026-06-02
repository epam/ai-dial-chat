import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of conversations to return.',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Pagination cursor returned in the previous response as `nextToken`. Omit for the first page.',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9',
  })
  @IsOptional()
  @IsString()
  nextToken?: string;
}
