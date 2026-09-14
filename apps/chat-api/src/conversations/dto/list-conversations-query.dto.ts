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
    description:
      'Maximum number of conversations per bucket page. Omit both limit and nextToken to return the complete history; the BFF follows Core cursors in batches of 1000. With nextToken only, the page size defaults to 100.',
    example: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => (value != null ? Number(value) : undefined))
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Pagination cursor returned in the previous response as `nextToken`. Set limit without nextToken for the first page; omit both to return the complete history.',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  nextToken?: string;
}
