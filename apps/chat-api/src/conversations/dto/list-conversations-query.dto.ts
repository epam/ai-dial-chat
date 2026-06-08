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

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of conversations to return.',
    example: 100,
    minimum: 1,
    maximum: 1000,
    default: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => (value != null ? Number(value) : undefined))
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Pagination cursor returned in the previous response as `nextToken`. Omit for the first page.',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  nextToken?: string;

  @ApiPropertyOptional({
    description:
      'DIAL Core subfolder path to scope the listing. Omit or pass an empty string to list all conversations from the bucket root ("My Files").',
    example: 'work/project-x',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  path?: string;
}
